const dataService = require('../services/data_service');
const logger = require('../utils/logger');

async function fixExistingCTAs() {
    logger.info('🚀 Starting CTA Fix for existing posts...');

    await dataService.init();
    const posts = await dataService.getPosts();

    const postsToFix = posts.filter(p => (p.draft || '').includes('詳細はこちら👇'));
    logger.info(`Found ${postsToFix.length} posts with old CTA.`);

    for (const post of postsToFix) {
        logger.info(`Fixing post ID: ${post.id}...`);
        try {
            const fixedDraft = post.draft.replace(/詳細はこちら👇/g, '詳細はプロフをみてね');

            await dataService.updatePost(post.id, {
                draft: fixedDraft,
                updated_at: new Date().toISOString()
            });
            logger.info(`✅ Fixed ID: ${post.id}`);
        } catch (e) {
            logger.error(`Failed to fix post ${post.id}`, e.message);
        }
    }

    logger.info('✨ CTA Fix Complete!');
    process.exit(0);
}

fixExistingCTAs();
