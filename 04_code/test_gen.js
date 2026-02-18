const contentGeneratorService = require('./src/services/content_generator_service');
const dataService = require('./src/services/data_service');
const logger = require('./src/utils/logger');
const pollenService = require('./src/services/pollen_service');

async function test() {
    process.env.ADMIN_PASSWORD = 'airfuture2026';
    process.env.RUN_MODE = 'development';

    await dataService.init();

    const count = 3;
    const days = 1;
    const startDate = '2026-03-01';

    const posts = await dataService.getPosts();
    const totalCount = parseInt(days) * parseInt(count);

    const context = {
        season: 'Spring',
        tokyoPollen: 'Low',
        isPollenSeason: false,
        trend: 'General',
        count: totalCount,
        targetStage: 'S1',
        productMentionAllowed: true,
        storyMode: true,
        memoContent: 'Local Test',
        recentPosts: posts.slice(-15)
    };

    console.log('Generating drafts...');
    const drafts = await contentGeneratorService.generateDrafts(context, { enemies: [], tags: [], trends: [], ng_words: [], safe_phrases: [] }, {});
    console.log(`Generated ${drafts.length} drafts.`);

    const saved = [];
    const timeSlots = ['08:00:00', '12:00:00', '20:00:00'];
    const stages = ['S1', 'S2', 'S3', 'S4'];

    for (let i = 0; i < drafts.length; i++) {
        const dayOffset = Math.floor(i / count);
        const slotIndex = i % count;

        let baseDate = new Date(startDate + 'T00:00:00+09:00');
        baseDate.setDate(baseDate.getDate() + dayOffset);

        const dateStr = baseDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }).replace(/-/g, '/');
        const timeStr = timeSlots[slotIndex % timeSlots.length];

        const rotatedStage = stages[i % stages.length];
        const abVersion = (i % 2 === 0) ? 'A' : 'B';

        console.log(`Adding post for ${dateStr} ${timeStr}...`);
        const result = await dataService.addPost({
            ...drafts[i],
            stage: drafts[i].stage || rotatedStage,
            ab_version: drafts[i].ab_version || abVersion,
            status: drafts[i].is_mock ? 'draft_ai' : 'scheduled',
            scheduled_at: `${dateStr} ${timeStr}`
        });

        if (result && !result.skipped) {
            console.log('Successfully saved.');
            saved.push(drafts[i]);
        } else {
            console.log(`Skipped: ${result.reason}`);
        }
    }
    console.log(`Final count: ${saved.length}`);
}

test();
