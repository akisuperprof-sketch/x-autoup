const dataService = require('./src/services/data_service');
const contentGeneratorService = require('./src/services/content_generator_service');
const newsService = require('./src/services/news_service');
const pollenService = require('./src/services/pollen_service');
const logger = require('./src/utils/logger');

async function runDiversifiedTest() {
    try {
        console.log("🚀 Starting Diversified 5-Pattern Quality Test...");
        await dataService.init();

        const posts = await dataService.getPosts();
        const prohibitedPrefixes = posts.filter(p => p.draft).map(p => p.draft.substring(0, 10));

        const news = await newsService.getLatestNews();
        // Force pollen info to NOT dominate if needed, but we'll use actual data and verify AI focuses on the specific themes
        const pollenInfo = await pollenService.getPollenForecast();

        const patterns = [
            { id: 'pattern_3d', theme: '3Dプリンターの作業環境とVOC（揮発性物質）への気づき' },
            { id: 'pattern_pet', theme: 'ペット（猫・犬）と暮らす中でのニオイの慣れと、実は大切な空気質' },
            { id: 'pattern_sleep', theme: '朝起きた時のスッキリ感と、寝室の二酸化炭素や密閉空間の違和感' },
            { id: 'pattern_work', theme: 'デスクワーク集中力の維持と、目に見えない空気の汚れの関係' },
            { id: 'pattern_tech', theme: 'フィルターのない空気清浄機の経済性と、ゴミを出さないサステナブルな視点' }
        ];

        console.log(`📡 Requesting unique drafts for ${patterns.length} distinct patterns...`);

        for (const p of patterns) {
            console.log(`\n--- Pattern: ${p.id} (${p.theme}) ---`);
            const context = {
                count: 1,
                season: 'Spring',
                tokyoPollen: pollenInfo.tokyo,
                newsTopics: news,
                trend: 'Diversified Deep Testing',
                memoContent: p.theme,
                prohibitedPrefixes: prohibitedPrefixes
            };

            const drafts = await contentGeneratorService.generateDrafts(context);
            if (drafts.length > 0) {
                const draft = drafts[0];
                console.log(`✅ Result: ${draft.draft}`);

                // Save to Sheet with status 'test_diversified'
                await dataService.addPost({
                    ...draft,
                    status: 'test_diversified',
                    memo: p.theme,
                    ai_model: 'gemini-2.0-flash'
                });
            }
        }

        console.log("\n🎉 Diversified 5-Pattern Test Complete! Results saved to Sheet.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Test failed:", e);
        process.exit(1);
    }
}

runDiversifiedTest();
