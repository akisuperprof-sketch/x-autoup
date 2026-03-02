/**
 * Force Post: Manually trigger posting for a specific ID
 */
const schedulerService = require('./src/services/scheduler_service');
const dataService = require('./src/services/data_service');
const xService = require('./src/services/x_service');
const logger = require('./src/utils/logger');

async function forcePost(postId) {
    console.log(`--- [FORCE POST] ID: ${postId} ---`);
    await dataService.init();

    const posts = await dataService.getPosts();
    const post = posts.find(p => p.id === postId);

    if (!post) {
        console.error('Post not found');
        return;
    }

    console.log('Post Status:', post.status);
    console.log('Post Content:', post.draft.substring(0, 30));

    try {
        // Mocking the check limits for this test
        console.log('Simulating postTweet...');
        const result = await xService.postTweet(post.draft);
        console.log('Post Result:', result);

        await dataService.updatePost(post.id, {
            status: 'posted',
            tweet_id: result.id,
            posted_at: new Date().toISOString()
        });
        console.log('Update successful');
    } catch (e) {
        console.error('FAILED:', e.message);
    }
}

// Get the top ID from command line or default to 100127
const targetId = process.argv[2] || '100127';
forcePost(targetId);
