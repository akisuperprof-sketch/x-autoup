const contentGeneratorService = require('../src/services/content_generator_service');
const dataService = require('../src/services/data_service');
const logger = require('../src/utils/logger');

const env = require('../src/config/env');
const pollenService = require('../src/services/pollen_service');

module.exports = async (req, res) => {
    // Simple Auth
    const authHeader = req.headers['x-admin-password'] || req.query.pw;
    if (env.ADMIN_PASSWORD && authHeader !== env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await dataService.init();

        const { count = 3, stage = 'S1', storyMode = false, days = 1, memo = '', startDate } = req.body;

        // Fetch Dictionaries & Analysis for v2 Prompt
        const dictionaries = await dataService.getDictionaries();
        const posts = await dataService.getPosts();

        // --- Sales Inhibition Logic (80/20 Rule) ---
        const recentPosts = posts.filter(p => p.status === 'posted' || p.status === 'scheduled').slice(-10);
        const recentSalesCount = recentPosts.filter(p => p.post_type === '誘導型' || p.lp_priority === 'high').length;

        const feedback = {
            recent_sales_count: recentSalesCount,
            top_patterns: "Empathy/Pain-point reproduction is key for Z-gen",
            top_stages: "S1, S2"
        };

        const templates = await dataService.getContentTemplates();
        const patterns = await dataService.getPostPatterns();

        const today = new Date();
        const totalCount = parseInt(days) * parseInt(count);

        const pollenInfo = await pollenService.getPollenForecast();
        const context = {
            season: _getSeason(today),
            tokyoPollen: pollenInfo.tokyo,
            isPollenSeason: pollenInfo.isPollenSeason,
            trend: storyMode ? 'Story Mode' : 'General',
            count: totalCount,
            targetStage: stage,
            productMentionAllowed: true,
            storyMode: storyMode,
            memoContent: memo, // User provided free text
            recentPosts: posts.slice(-15) // Prevent similarity/duplicates
        };

        const drafts = await contentGeneratorService.generateDrafts(context, { ...dictionaries, templates, patterns }, feedback);

        // Save drafts with spreading logic
        const saved = [];
        const timeSlots = ['08:00:00', '12:00:00', '20:00:00'];
        const stages = ['S1', 'S2', 'S3', 'S4'];

        for (let i = 0; i < drafts.length; i++) {
            const dayOffset = Math.floor(i / count);
            const slotIndex = i % count;

            // FIXED: Use startDate if provided, otherwise use current JST date
            let baseDate;
            if (startDate) {
                // Parse startDate (YYYY-MM-DD format) as JST
                baseDate = new Date(startDate + 'T00:00:00+09:00');
            } else {
                // Use current JST time
                const now = new Date();
                const jstString = now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
                baseDate = new Date(jstString);
            }

            baseDate.setDate(baseDate.getDate() + dayOffset);

            // Format as YYYY/MM/DD in JST
            const dateStr = baseDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }).replace(/-/g, '/');
            const timeStr = timeSlots[slotIndex % timeSlots.length];

            const rotatedStage = stages[i % stages.length];
            const abVersion = (i % 2 === 0) ? 'A' : 'B';

            const result = await dataService.addPost({
                ...drafts[i],
                stage: drafts[i].stage || rotatedStage,
                ab_version: drafts[i].ab_version || abVersion,
                status: drafts[i].is_mock ? 'draft_ai' : 'scheduled',
                scheduled_at: `${dateStr} ${timeStr}`
            });
            if (result && !result.skipped) saved.push(drafts[i]);
        }

        res.status(200).json({
            success: true,
            count: saved.length,
            message: `Generated ${saved.length} drafts for over ${days} day(s).`
        });

    } catch (error) {
        logger.error('Generate API failed', error);
        res.status(500).json({ error: error.message });
    }
};

function _getSeason(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    if (month === 2 && day >= 15) return 'Spring (Early Pollen Season)';
    if (month >= 3 && month <= 5) return 'Spring';
    if (month >= 6 && month <= 8) return 'Summer';
    if (month >= 9 && month <= 11) return 'Autumn';
    return 'Winter';
}
