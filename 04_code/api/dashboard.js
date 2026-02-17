const dataService = require('../src/services/data_service');
const googleSheetService = require('../src/services/google_sheet_service');
const env = require('../src/config/env');

module.exports = async (req, res) => {
    // Simple Auth
    const authHeader = req.headers['x-admin-password'] || req.query.pw;
    if (env.ADMIN_PASSWORD && authHeader !== env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { human_only, lp, period } = req.query;
    const isHumanOnly = human_only === 'true';
    const selectedLP = lp || 'all';

    try {
        await dataService.init();
        const posts = await dataService.getPosts();

        // 1. Fetch and process Event Logs
        const eventStats = {};
        const clicksBySource = {};
        const cvBySource = {};
        let totalClicks = 0;
        let totalCV = 0;
        let totalRevenue = 0;

        const now = new Date();
        const jstOffset = 9 * 60 * 60 * 1000;
        const nowJST = new Date(now.getTime() + jstOffset);

        let cutoffDate = null;
        if (period === 'today') {
            cutoffDate = new Date(nowJST.getFullYear(), nowJST.getMonth(), nowJST.getDate());
        } else if (period === '7d') {
            cutoffDate = new Date(nowJST.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (period === '30d') {
            cutoffDate = new Date(nowJST.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        const kpi = { internal: { bot_clicks: 0, dev_clicks: 0 } };

        let logRows = [];
        if (dataService.useSheets) {
            try {
                logRows = await googleSheetService.getRows('logs');
                for (const row of logRows) {
                    const ts_str = row.get('ts') || row.get('timestamp');
                    if (!ts_str || ts_str === '記録日時') continue;

                    const row_pid = (row.get('post_id') || row.get('pid') || '').trim();
                    const action = row.get('action');
                    const row_lp = (row.get('lp_id') || 'default_lp').trim();

                    // Robust Detection (v4.4 compliant)
                    const isBotStr = (row.get('is_bot') || '').toString().toUpperCase();
                    const isDevStr = (row.get('is_dev') || '').toString();

                    const row_is_bot = isBotStr.match(/BOT|TRUE|1/);
                    const row_is_dev = isDevStr.match(/開発者|管理者|TRUE|1/);

                    // Date filter
                    if (cutoffDate) {
                        try {
                            const row_date = new Date(ts_str.replace(' ', 'T'));
                            if (row_date < cutoffDate) continue;
                        } catch (e) { continue; }
                    }

                    // Internal stats Tracking
                    if (row_is_bot && action === 'click') kpi.internal.bot_clicks++;
                    if (row_is_dev && action === 'click') kpi.internal.dev_clicks++;

                    // Critical Filter: Skip based on user preference
                    if (isHumanOnly && (row_is_bot || row_is_dev)) continue;

                    // LP Filter
                    if (selectedLP !== 'all' && row_lp !== selectedLP) continue;

                    // Aggregate Totals
                    if (!clicksBySource[row_lp]) clicksBySource[row_lp] = 0;
                    if (!cvBySource[row_lp]) cvBySource[row_lp] = { count: 0, revenue: 0 };

                    const row_revenue = parseFloat(row.get('revenue') || 0);

                    if (action === 'click') {
                        clicksBySource[row_lp]++;
                        totalClicks++;
                        if (row_pid) {
                            if (!eventStats[row_pid]) eventStats[row_pid] = { clicks: 0, cv: 0, revenue: 0 };
                            eventStats[row_pid].clicks++;
                        }
                    } else if (action === 'cv') {
                        cvBySource[row_lp].count++;
                        cvBySource[row_lp].revenue += row_revenue;
                        totalCV++;
                        totalRevenue += row_revenue;
                        if (row_pid) {
                            if (!eventStats[row_pid]) eventStats[row_pid] = { clicks: 0, cv: 0, revenue: 0 };
                            eventStats[row_pid].cv++;
                            eventStats[row_pid].revenue += row_revenue;
                        }
                    }
                }
            } catch (e) {
                console.warn('Logs sheet process error:', e.message);
            }
        }

        // Calculations
        const epc = totalClicks > 0 ? (totalRevenue / totalClicks).toFixed(1) : 0;
        const aov = totalCV > 0 ? (totalRevenue / totalCV).toFixed(1) : 0;
        const cvr = totalClicks > 0 ? ((totalCV / totalClicks) * 100).toFixed(1) : 0;

        const twentyFourHoursAgo = new Date(nowJST.getTime() - 24 * 60 * 60 * 1000);
        const todayStart = new Date(nowJST.getFullYear(), nowJST.getMonth(), nowJST.getDate());

        Object.assign(kpi, {
            queued: posts.filter(p => p.status === 'scheduled' || p.status === 'draft_ai').length,
            posted_total: posts.filter(p => p.status === 'posted').length,
            posted_today: posts.filter(p => p.status === 'posted' && p.posted_at && new Date(p.posted_at) >= todayStart).length,
            failed_24h: posts.filter(p => (p.status === 'failed' || p.last_error) && p.updated_at && new Date(p.updated_at) >= twentyFourHoursAgo).length,
            autopost_status: 'ACTIVE',
            total_clicks: totalClicks,
            total_cv: totalCV,
            total_revenue: totalRevenue,
            epc,
            aov,
            cvr,
            clicks_by_source: clicksBySource,
            cv_by_source: cvBySource
        });

        // Visitor Journeys
        const journeysByVisitor = {};
        const sortedLogs = [...logRows].filter(r => {
            const ts = r.get('ts');
            return r.get('action') === 'click' && ts && ts !== '記録日時';
        }).sort((a, b) => new Date(a.get('ts')) - new Date(b.get('ts')));

        sortedLogs.forEach(row => {
            const visitor = row.get('visitor_label');
            const lp_id = row.get('lp_id') || 'default_lp';
            if (visitor) {
                if (!journeysByVisitor[visitor]) journeysByVisitor[visitor] = [];
                if (journeysByVisitor[visitor][journeysByVisitor[visitor].length - 1] !== lp_id) {
                    journeysByVisitor[visitor].push(lp_id);
                }
            }
        });

        const topJourneys = Object.entries(
            Object.values(journeysByVisitor).reduce((acc, path) => {
                if (path.length > 0) {
                    const readable = path.map(id => dataService.getLpName(id)).join(' → ');
                    acc[readable] = (acc[readable] || 0) + 1;
                }
                return acc;
            }, {})
        ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, count]) => ({ path, count }));

        // Cron Logs
        let cronLogs = [];
        try {
            const cRows = await googleSheetService.getRows('cron_logs');
            cronLogs = cRows.slice(-5).reverse().map(l => ({
                action: l.get('action'),
                status: l.get('status'),
                timestamp: l.get('timestamp') || l.get('ts')
            }));
        } catch (e) { }

        const cleanPosts = posts.map(p => {
            const { _row, ...clean } = p;
            const stats = eventStats[clean.id] || { clicks: 0, cv: 0, revenue: 0 };
            return {
                ...clean,
                click_count: stats.clicks,
                cv_count: stats.cv,
                revenue: stats.revenue,
                cvr: stats.clicks > 0 ? ((stats.cv / stats.clicks) * 100).toFixed(1) : '0.0'
            };
        });

        res.status(200).json({
            storage_status: dataService.useSheets ? 'CONNECTED' : 'LOCAL',
            kpi,
            posts: cleanPosts.filter(p => !['posted', 'deleted'].includes(p.status)).slice(-100).reverse(),
            recent_posted: cleanPosts.filter(p => p.status === 'posted').slice(-10).reverse(),
            topJourneys,
            cronLogs,
            filters: { human_only: isHumanOnly, lp: selectedLP, period: period || 'all' }
        });

    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).json({ error: error.message });
    }
};
