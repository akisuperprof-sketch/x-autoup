const dataService = require('../services/data_service');
const logger = require('../utils/logger');

async function main() {
    const now = new Date();
    // Schedule for 1 minute ago so it gets picked up immediately
    const scheduledTime = new Date(now.getTime() - 60000).toISOString();

    const post = {
        draft: 'This is a test post from the automated system! 🚀 #AirFuture #Test',
        stage: 'S1',
        season: 'Winter',
        hashtags: ['#AirFuture', '#Test'],
        status: 'scheduled',
        scheduled_at: scheduledTime
    };

    logger.info('Adding test post...', post);
    await dataService.addPost(post);
    logger.info('Test post added successfully.');
}

main();
