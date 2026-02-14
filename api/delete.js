const dataService = require('../src/services/data_service');
const logger = require('../src/utils/logger');

module.exports = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Post ID is required' });
        }

        logger.info(`Request to delete post ID: ${id}`);
        await dataService.init();
        await dataService.deletePost(id);

        res.status(200).json({ success: true, message: `Post ${id} deleted` });

    } catch (error) {
        logger.error('Delete post failed', error);
        res.status(500).json({ error: error.message });
    }
};
