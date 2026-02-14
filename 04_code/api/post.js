const xService = require('../src/services/x_service');
const dataService = require('../src/services/data_service');
const logger = require('../src/utils/logger');

module.exports = async (req, res) => {
    try {
        const { id } = req.body; // Expect JSON body { id: "post_id" }

        if (!id) {
            return res.status(400).json({ error: 'Post ID is required' });
        }

        logger.info(`Manual force post triggered for ID: ${id}`);
        await dataService.init();

        // 1. Get the post
        const posts = await dataService.getPosts();
        // Since IDs are strings but might be passed as numbers or strings, handle carefully.
        // And sheet IDs are strings.
        const targetPost = posts.find(p => String(p.id) === String(id));

        if (!targetPost) {
            logger.warn(`Post with ID ${id} not found`);
            return res.status(404).json({ error: `Post with ID ${id} not found` });
        }

        // 2. Post to X
        // Assuming media_url handling is inside postTweet or ignored for now if null
        // Media upload logic might need to be verified, but let's assume basic text first.
        // If media_url exists, we might need logic to upload it first. 
        // xService.postTweet handles `mediaIds` array, not URL directly usually.
        // Let's check xService.postTweet signature. It takes text and mediaIds.
        // If targetPost has media_url, we might need to fetch and upload it.
        // For now, let's just post text to be safe or mock media.

        // TODO: Media upload from URL if needed.
        const result = await xService.postTweet(targetPost.draft);

        if (result && (result.data?.id || result.id)) { // result.id for mock
            // 3. Update status
            await dataService.updatePostStatus(id, 'posted', {
                posted_at: new Date().toISOString(),
                tweet_id: result.data?.id || result.id
            });

            logger.info(`Successfully force posted ID: ${id}`);
            res.status(200).json({ success: true, tweet_id: result.data?.id || result.id });
        } else {
            throw new Error('Failed to post to X (No ID returned)');
        }

    } catch (error) {
        logger.error('Force post failed', error);
        res.status(500).json({ error: error.message });
    }
};
