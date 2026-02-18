const contentGeneratorService = require('./src/services/content_generator_service');
const pollenService = require('./src/services/pollen_service');

async function test() {
    const memo = '【トピック重視: 3Dプリンター有害ガス対策】\n';
    const pollenInfo = await pollenService.getPollenForecast();
    const context = {
        season: 'Spring',
        tokyoPollen: pollenInfo.tokyo,
        isPollenSeason: pollenInfo.isPollenSeason,
        trend: 'General',
        count: 3,
        targetStage: 'S1',
        productMentionAllowed: true,
        storyMode: false,
        memoContent: memo,
        recentPosts: []
    };

    const dictionaries = {
        enemies: ['Pollution', 'Pollen', 'Odor', 'Virus'],
        tags: ['#AirFuture', '#空気清浄機'],
        safe_phrases: ['心地よい空間', '快適な暮らし'],
        ng_words: []
    };
    const feedback = { recent_sales_count: 0 };

    try {
        console.log('Sending prompt to Gemini...');
        const drafts = await contentGeneratorService.generateDrafts(context, dictionaries, feedback);
        console.log('Gemini Response:');
        console.log(JSON.stringify(drafts, null, 2));
    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
