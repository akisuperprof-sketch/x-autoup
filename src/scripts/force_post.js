const xService = require('../services/x_service');
const dataService = require('../services/data_service');
const logger = require('../utils/logger');

async function forcePost(postId) {
    console.log(`🚀 Force posting ID: ${postId} ...`);
    await dataService.init();

    // 1. Get the post
    const posts = await dataService.getPosts();
    const targetPost = posts.find(p => p.id === postId);

    if (!targetPost) {
        console.error('❌ Post not found!');
        return;
    }

    console.log(`Found post: ${targetPost.draft.substring(0, 30)}...`);

    // 2. Post to X
    try {
        const result = await xService.postTweet(targetPost.draft, targetPost.media_url);

        if (result && result.data && result.data.id) {
            console.log(`✅ Posted successfully! Tweet ID: ${result.data.id}`);

            // 3. Update status
            await dataService.updatePostStatus(postId, 'posted', {
                posted_at: new Date().toISOString(),
                tweet_id: result.data.id
            });
            console.log('📝 Status updated in Sheet.');

            // Add log
            await dataService.addLog({
                action: 'post',
                status: 'success',
                result: { id: result.data.id, text: targetPost.draft },
                context: { manual: true }
            });

        } else {
            console.error('❌ Failed to post (No ID returned)');
            console.error(result);
        }
    } catch (error) {
        console.error('❌ Error posting tweet:', error);
    }
}

// Get ID from command line arg
const id = process.argv[2];
if (id) {
    forcePost(id);
} else {
    console.error('Please provide a post ID. Usage: node force_post.js <ID>');
}
