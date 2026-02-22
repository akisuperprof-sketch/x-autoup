const dataService = require('./src/services/data_service');
const contentGeneratorService = require('./src/services/content_generator_service');
const newsService = require('./src/services/news_service');
const pollenService = require('./src/services/pollen_service');
const logger = require('./src/utils/logger');

async function runTest20() {
    try {
        console.log("🚀 Starting generation test for 20 posts with status 'test'...");
        await dataService.init();

        const posts = await dataService.getPosts();
        // Get all past prefixes for uniqueness check
        const prohibitedPrefixes = posts
            .filter(p => p.draft)
            .map(p => p.draft.substring(0, 10));

        const pollenInfo = await pollenService.getPollenForecast();
        const news = await newsService.getLatestNews();

        const context = {
            season: 'Spring',
            tokyoPollen: pollenInfo.tokyo,
            isPollenSeason: pollenInfo.isPollenSeason,
            newsTopics: news,
            trend: '20-Post Batch Quality Test',
            count: 20,
            targetStage: 'S1',
            memoContent: 'Testing total uniqueness and trend integration over 20 items.',
            prohibitedPrefixes: prohibitedPrefixes
        };

        console.log("📡 Requesting 20 unique drafts from AI...");
        const drafts = await contentGeneratorService.generateDrafts(context);

        console.log(`✅ AI returned ${drafts.length} drafts.`);

        let savedCount = 0;
        for (const draft of drafts) {
            const result = await dataService.addPost({
                ...draft,
                status: 'test', // Mark as test as requested
                scheduled_at: null,
                is_mock: draft.is_mock || false
            });
            if (result.success) {
                savedCount++;
                console.log(`[${savedCount}/20] Saved: ${draft.draft.substring(0, 30)}...`);
            } else {
                console.log(`[SKIPPED] Reason: ${result.reason}`);
            }
        }

        console.log(`\n🎉 Test Complete! Saved ${savedCount} posts with status 'test'.`);
        process.exit(0);
    } catch (e) {
        console.error("❌ Test failed:", e);
        process.exit(1);
    }
}

runTest20();
