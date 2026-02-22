const contentGeneratorService = require('../src/services/content_generator_service');
const dataService = require('../src/services/data_service');
const logger = require('../src/utils/logger');

const env = require('../src/config/env');
const pollenService = require('../src/services/pollen_service');

const newsService = require('../src/services/news_service');

module.exports = async (req, res) => {
    // Simple Auth
    const authHeader = req.headers['x-admin-password'] || req.query.pw;
    if (env.ADMIN_PASSWORD && authHeader !== env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await dataService.init();

        const { count = 3, stage = 'S1', memo = '', startDate } = req.body;

        // Fetch Dictionaries & Analysis for v2 Prompt
        const dictionaries = await dataService.getDictionaries();
        const posts = await dataService.getPosts();

        // UNIQUE CONTENT PROTECTION: Get first 10 chars of ALL past posts
        const prohibitedPrefixes = posts
            .filter(p => p.draft)
            .map(p => p.draft.substring(0, 10));

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
        const pollenInfo = await pollenService.getPollenForecast();
        const newsTopics = await newsService.getLatestNews();

        // Count is now TOTAL posts to generate
        const totalCount = parseInt(count);

        const context = {
            season: _getSeason(today),
            tokyoPollen: pollenInfo.tokyo,
            isPollenSeason: pollenInfo.isPollenSeason,
            newsTopics: newsTopics,
            trend: 'General',
            count: totalCount,
            targetStage: stage,
            productMentionAllowed: true,
            storyMode: false,
            memoContent: memo, // User provided free text
            recentPosts: posts.slice(-15), // Prevent similarity/duplicates
            prohibitedPrefixes: prohibitedPrefixes // Strict rule: No matching first 10 chars
        };

        const drafts = await contentGeneratorService.generateDrafts(context, { ...dictionaries, templates, patterns }, feedback);
        if (drafts.length === 0) {
            return res.status(200).json({ success: true, count: 0, message: "AI generation returned 0 drafts. Check prompt or API keys." });
        }

        // Save drafts with spreading logic
        const saved = [];
        const skippedReasons = [];

        // Base date for scheduling
        let startBase;
        if (startDate) {
            startBase = new Date(startDate + 'T00:00:00+09:00');
        } else {
            startBase = new Date();
        }

        // SMART SCHEDULING LOGIC
        // 1. Map existing occupied slots (By date and hour to account for jitter)
        const occupiedHourSlots = new Set();
        posts.forEach(p => {
            if ((p.status === 'scheduled' || p.status === 'posted') && p.scheduled_at) {
                // Formatting: "YYYY/MM/DD HH:mm:ss"
                const parts = p.scheduled_at.split(' ');
                const datePart = parts[0].replace(/-/g, '/');
                const hourPart = parts[1].split(':')[0]; // Just the hour
                occupiedHourSlots.add(`${datePart} ${hourPart}`);
            }
        });

        // 2. Find available slots for new drafts (8:00 and 12:00 only)
        const baseTimeSlots = ['08:00:00', '12:00:00'];
        const stages = ['S1', 'S2', 'S3', 'S4'];

        let currentDate = new Date(startBase.getTime());

        let assignedCount = 0;
        let dayLoop = 0;

        while (assignedCount < drafts.length && dayLoop < 90) { // Look ahead up to 90 days
            const jst = getJstDate(currentDate);
            const dateStr = jst.toISOString().split('T')[0].replace(/-/g, '/');

            for (const timeStr of baseTimeSlots) {
                if (assignedCount >= drafts.length) break;

                const baseHour = timeStr.split(':')[0];
                const hourSlotKey = `${dateStr} ${baseHour}`;

                if (!occupiedHourSlots.has(hourSlotKey)) {
                    // Available slot found! Add Jitter (20-40 minutes offset)
                    const draft = drafts[assignedCount];
                    const rotatedStage = stages[assignedCount % stages.length];
                    const abVersion = (assignedCount % 2 === 0) ? 'A' : 'B';

                    // Random Jitter within 20-40 minutes range to avoid "exact hour" patterns
                    const [h, m, s] = timeStr.split(':');
                    const baseTime = new Date(`${dateStr.replace(/\//g, '-')}T${h}:${m}:${s}+09:00`);
                    const jitterMS = (Math.floor(Math.random() * 60) - 30) * 60 * 1000;
                    const jitteredDate = new Date(baseTime.getTime() + jitterMS);

                    const jDateStr = getJstDate(jitteredDate).toISOString().split('T')[0].replace(/-/g, '/');
                    const jTimeStr = getJstDate(jitteredDate).toISOString().split('T')[1].split('.')[0];
                    const finalScheduledAt = `${jDateStr} ${jTimeStr}`;

                    const result = await dataService.addPost({
                        ...draft,
                        stage: draft.stage || rotatedStage,
                        ab_version: draft.ab_version || abVersion,
                        status: 'scheduled',
                        scheduled_at: finalScheduledAt
                    });

                    if (result && !result.skipped) {
                        saved.push(draft);
                        occupiedHourSlots.add(hourSlotKey);
                        assignedCount++;
                    } else if (result && (result.reason === 'duplicate_hash' || result.reason === 'similarity_too_high')) {
                        assignedCount++; // Skip this faulty draft
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
            dayLoop++;
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
