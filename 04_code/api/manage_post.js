const dataService = require('../src/services/data_service');
const xService = require('../src/services/x_service');
const env = require('../src/config/env');

module.exports = async (req, res) => {
    // Simple Auth
    const authHeader = req.headers['x-admin-password'] || req.query.pw;
    if (env.ADMIN_PASSWORD && authHeader !== env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action, id } = req.query;

    try {
        await dataService.init();

        if (action === 'delete') {
            if (!id) return res.status(400).json({ error: 'ID required' });
            await dataService.updatePost(id, { status: 'deleted', updated_at: new Date().toISOString() });
            return res.status(200).json({ success: true, message: `Post ${id} marked as deleted.` });
        }

        if (action === 'force_post') {
            if (!id) return res.status(400).json({ error: 'ID required' });
            const posts = await dataService.getPosts();
            const post = posts.find(p => p.id === id);
            if (!post) return res.status(404).json({ error: 'Post not found' });

            // Post to X
            const result = await xService.postTweet(post.draft);
            await dataService.updatePost(id, {
                status: 'posted',
                tweet_id: result.id,
                posted_at: new Date().toISOString(),
                last_error: ''
            });

            return res.status(200).json({ success: true, message: `Post ${id} posted successfully.`, tweet_id: result.id });
        }

        if (action === 'toggle_status') {
            if (!id) return res.status(400).json({ error: 'ID required' });
            const posts = await dataService.getPosts();
            const post = posts.find(p => p.id === id);
            if (!post) return res.status(404).json({ error: 'Post not found' });

            const nextStatus = post.status === 'paused' ? 'scheduled' : 'paused';
            await dataService.updatePost(id, { status: nextStatus, updated_at: new Date().toISOString() });
            return res.status(200).json({ success: true, message: `Post ${id} status changed to ${nextStatus}.` });
        }

        res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
        console.error('Manage Post API Error:', error);
        res.status(500).json({ error: error.message });
    }
};
