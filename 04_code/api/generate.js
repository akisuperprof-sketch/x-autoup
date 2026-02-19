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

        const JST_OFFSET = 9 * 60 * 60 * 1000;
        const getJstDate = (d) => new Date(d.getTime() + JST_OFFSET);
        const getJstDateStr = (d) => getJstDate(d).toISOString().split('T')[0];

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
        const skippedReasons = [];
        const timeSlots = ['08:00:00', '12:00:00', '20:00:00'];
        const stages = ['S1', 'S2', 'S3', 'S4'];

        // Base date for scheduling
        let startBase;
        if (startDate) {
            startBase = new Date(startDate + 'T00:00:00+09:00');
        } else {
            startBase = new Date();
        }

        for (let i = 0; i < drafts.length; i++) {
            const dayOffset = Math.floor(i / (parseInt(count) || 3));
            const slotIndex = i % (parseInt(count) || 3);

            const targetDate = new Date(startBase.getTime());
            targetDate.setDate(targetDate.getDate() + dayOffset);

            const jst = getJstDate(targetDate);
            const dateStr = jst.toISOString().split('T')[0].replace(/-/g, '/');
            const timeStr = timeSlots[slotIndex % timeSlots.length];

            const rotatedStage = stages[i % stages.length];
            const abVersion = (i % 2 === 0) ? 'A' : 'B';

            const result = await dataService.addPost({
                ...drafts[i],
                stage: drafts[i].stage || rotatedStage,
                ab_version: drafts[i].ab_version || abVersion,
                status: 'scheduled',
                scheduled_at: `${dateStr} ${timeStr}`
            });

            if (result && !result.skipped) {
                saved.push(drafts[i]);
            } else {
                skippedReasons.push(result ? result.reason : 'unknown');
            }
        }

        const distinctReasons = [...new Set(skippedReasons)];
        res.status(200).json({
            success: true,
            count: saved.length,
            message: `Generated ${saved.length} drafts. (Skipped ${skippedReasons.length} posts due to: ${distinctReasons.join(', ') || 'none'})`
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
