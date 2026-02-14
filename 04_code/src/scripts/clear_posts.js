const dataService = require('../services/data_service');
const logger = require('../utils/logger');

// Usage: node clear_posts.js [all | drafts | failed]
// Example: node clear_posts.js drafts

async function clearPosts() {
    const args = process.argv.slice(2);
    const target = args[0] || 'drafts'; // default to clearing new drafts

    console.log(`🗑️ Clearing posts with target: ${target}`);
    console.log('NOTE: If using Google Sheets, this script currently cannot DELETE rows via API due to library limitations (append/update only).');
    console.log('For Google Sheets, please manually delete rows in the browser.');
    console.log('If using Local JSON, this will work.');

    await dataService.init();

    if (dataService.useSheets) {
        console.log('⚠️  Operation aborted. Automatic deletion from Google Sheets is risky/not fully implemented. Please clear rows 2+ manually in the sheet.');
        return;
    }

    try {
        let posts = await dataService.getPosts();
        const initialCount = posts.length;

        if (target === 'all') {
            posts = [];
        } else if (target === 'drafts') {
            posts = posts.filter(p => p.status !== 'draft_ai');
        } else if (target === 'failed') {
            posts = posts.filter(p => p.status !== 'failed');
        }

        await dataService.savePosts(posts);
        console.log(`✅ Cleared. Count: ${initialCount} -> ${posts.length}`);

    } catch (error) {
        console.error('Error clearing posts:', error);
    }
}

clearPosts();
