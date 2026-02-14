const dataService = require('../services/data_service');
const contentGeneratorService = require('../services/content_generator_service');
const logger = require('../utils/logger');

async function shortenPastPosts() {
    logger.info('🚀 Starting Bulk Shorten for past posts (> 140 chars)...');

    await dataService.init();
    const posts = await dataService.getPosts();

    const overLimitPosts = posts.filter(p => (p.draft || '').length > 140);
    logger.info(`Found ${overLimitPosts.length} posts over 140 characters.`);

    for (const post of overLimitPosts) {
        logger.info(`Shortening post ID: ${post.id} (Current len: ${post.draft.length})...`);
        try {
            const shortened = await contentGeneratorService.shortenDraft(post.draft);

            // Validate length (hard truncate if AI failed)
            let finalDraft = shortened;
            if (finalDraft.length > 140) {
                finalDraft = finalDraft.substring(0, 137) + '...';
            }

            await dataService.updatePost(post.id, {
                draft: finalDraft,
                updated_at: new Date().toISOString()
            });
            logger.info(`✅ Shortened ID: ${post.id} (New len: ${finalDraft.length})`);
        } catch (e) {
            logger.error(`Failed to shorten post ${post.id}`, e.message);
        }
    }

    logger.info('✨ Bulk Shorten Complete!');
    process.exit(0);
}

shortenPastPosts();
