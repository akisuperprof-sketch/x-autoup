const newsService = require('./src/services/news_service');
const contentGeneratorService = require('./src/services/content_generator_service');

async function test() {
    console.log("Searching news...");
    const news = await newsService.getLatestNews();
    console.log("News found:", news);

    const context = {
        season: 'Spring',
        newsTopics: news,
        memoContent: 'Testing uniqueness',
        prohibitedPrefixes: ['今日気づいたんですが']
    };

    console.log("Generating drafts...");
    const drafts = await contentGeneratorService.generateDrafts(context);
    console.log("Drafts:", JSON.stringify(drafts, null, 2));
}

test();
