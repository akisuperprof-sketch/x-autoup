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

        // 1. Fetch and process Event Logs (The Source of Truth)
        const eventStats = {}; // { pid: { clicks: 0, cv: 0, revenue: 0 } }
        const clicksBySource = {};
        const cvBySource = {};
        let totalClicks = 0;
        let totalCV = 0;
        let totalRevenue = 0;

        // Date filter constants
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
                logRows.forEach(row => {
                    const row_pid = (row.get('post_id') || row.get('pid') || '').trim();
                    const action = row.get('action');
                    const row_lp = (row.get('lp_id') || 'default_lp').trim();
                    const row_is_bot = row.get('is_bot') === 'BOT' || row.get('is_bot') === 'TRUE';
                    const row_is_dev = row.get('is_dev') === '開発者' || row.get('is_dev') === 'TRUE';
                    const row_ts_str = row.get('ts') || row.get('timestamp');
                    const row_revenue = parseFloat(row.get('revenue') || 0);

                    // Date filter
                    if (cutoffDate && row_ts_str && row_ts_str !== '記録日時') {
                        const row_date = new Date(row_ts_str.replace(' ', 'T'));
                        if (row_date < cutoffDate) return;
                    }

                    // Internal stats
                    if (row_is_bot && action === 'click') kpi.internal.bot_clicks++;
                    if (row_is_dev && action === 'click') kpi.internal.dev_clicks++;

                    // Main Filter: Skip bots and devs
                    if (row_is_bot || row_is_dev) return;

                    // LP Filter (Optional for specific views)
                    if (selectedLP !== 'all' && row_lp !== selectedLP) return;

                    // Source Breakdown (Always count even if no pid)
                    if (!clicksBySource[row_lp]) clicksBySource[row_lp] = 0;
                    if (!cvBySource[row_lp]) cvBySource[row_lp] = { count: 0, revenue: 0 };

                    if (action === 'click') {
                        clicksBySource[row_lp]++;
                        totalClicks++; // Move out of row_pid check
                    } else if (action === 'cv') {
                        cvBySource[row_lp].count++;
                        cvBySource[row_lp].revenue += row_revenue;
                        totalCV++;
                        totalRevenue += row_revenue;
                    }

                    // Only skip for per-post detailed stats
                    if (!row_pid) return;

                    if (!eventStats[row_pid]) eventStats[row_pid] = { clicks: 0, cv: 0, revenue: 0 };

                    if (action === 'click') {
                        eventStats[row_pid].clicks++;
                    } else if (action === 'cv') {
                        eventStats[row_pid].cv++;
                        eventStats[row_pid].revenue += row_revenue;
                    }
                });
            } catch (e) {
                console.warn('Logs sheet error:', e.message);
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
            posted_today: posts.filter(p => p.status === 'posted' && p.posted_at && new Date(p.posted_at.replace(' ', 'T')) >= todayStart).length,
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

        // Analysis: Visitor Journeys (Reconstruct sequence per visitor)
        const journeysByVisitor = {};
        const sortedLogs = [...logRows].filter(r => {
            const ts = r.get('ts');
            return r.get('action') === 'click' && ts && ts !== '記録日時';
        }).sort((a, b) => {
            return new Date(a.get('ts')) - new Date(b.get('ts'));
        });

        sortedLogs.forEach(row => {
            const visitor = row.get('visitor_label');
            const lp = row.get('lp_id') || 'default_lp';
            if (visitor && visitor !== '記録日時') { // Skip explanation row
                if (!journeysByVisitor[visitor]) journeysByVisitor[visitor] = [];
                const lastLp = journeysByVisitor[visitor][journeysByVisitor[visitor].length - 1];
                if (lastLp !== lp) {
                    journeysByVisitor[visitor].push(lp);
                }
            }
        });

        const pathCounts = {};
        Object.values(journeysByVisitor).forEach(path => {
            if (path.length === 0) return;
            // Map IDs to readable names for better display
            const readablePath = path.map(id => dataService.getLpName(id)).join(' → ');
            pathCounts[readablePath] = (pathCounts[readablePath] || 0) + 1;
        });

        const topJourneys = Object.entries(pathCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([path, count]) => ({ path, count }));

        // Latest Cron Logs
        let cronLogs = [];
        if (dataService.useSheets) {
            try {
                const logs = await googleSheetService.getRows('cron_logs');
                cronLogs = logs.slice(-5).reverse().map(l => ({
                    action: l.get('action'),
                    status: l.get('status'),
                    timestamp: l.get('timestamp') || l.get('ts'),
                    processed: l.get('processed_count')
                }));
            } catch (e) { }
        }

        // Merge event stats into posts for UI
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
            storage_status: dataService.useSheets ? 'CONNECTED' : (dataService.lastError ? 'ERROR' : 'LOCAL_ONLY'),
            storage_error: dataService.lastError || null,
            sheet_id: env.GOOGLE_SHEET_ID ? env.GOOGLE_SHEET_ID.substring(0, 10) + '...' : 'NONE',
            log_count: totalClicks + totalCV,
            kpi,
            posts: cleanPosts.filter(p => p.status !== 'posted' && p.status !== 'deleted').slice(-100).reverse(),
            recent_posted: cleanPosts.filter(p => p.status === 'posted').slice(-10).reverse(),
            topJourneys,
            cronLogs,
            filters: { human_only: isHumanOnly, lp: selectedLP, period: period || 'all' }
        });

    } catch (error) {
        console.error('Dashboard API Error:', error);
        res.status(500).json({ error: error.message });
    }
};
