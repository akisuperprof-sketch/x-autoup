const googleSheetService = require('../services/google_sheet_service');
const logger = require('../utils/logger');

async function setupSheet() {
    console.log('Initializing Sheet Setup...');

    const connected = await googleSheetService.init();
    if (!connected) {
        console.error('❌ Failed to connect to sheet.');
        return;
    }

    const doc = googleSheetService.doc;

    // 1. Setup 'posts' sheet
    let postsSheet = doc.sheetsByTitle['posts'];
    if (!postsSheet) {
        console.log('Creating "posts" sheet...');
        postsSheet = await doc.addSheet({ title: 'posts' });
    }

    // Set headers for posts
    await postsSheet.setHeaderRow([
        'id', 'draft', 'stage', 'season', 'hashtags', 'status', 'scheduled_at', 'media_url', 'result', 'ai_comment'
    ]);
    console.log('✅ "posts" sheet headers set.');

    // 2. Setup 'logs' sheet
    let logsSheet = doc.sheetsByTitle['logs'];
    if (!logsSheet) {
        console.log('Creating "logs" sheet...');
        logsSheet = await doc.addSheet({ title: 'logs' });
    }
    await logsSheet.setHeaderRow(['timestamp', 'post_id', 'action', 'status', 'result', 'error', 'context']);
    console.log('✅ "logs" sheet headers set.');

    // 3. Add a test post
    const now = new Date();
    const scheduledTime = new Date(now.getTime() + 5 * 60000).toISOString(); // 5 mins later

    const testPost = {
        id: Date.now().toString(),
        draft: 'これはシステムによる自動セットアップテスト投稿です！🚀 #AirFuture #SystemTest',
        stage: 'S1',
        season: 'Winter',
        hashtags: JSON.stringify(['#AirFuture', '#SystemTest']),
        status: 'scheduled',
        scheduled_at: scheduledTime,
        media_url: '',
        result: '',
        ai_comment: 'Initial test'
    };

    await postsSheet.addRow(testPost);
    console.log(`✅ Added test post scheduled for ${scheduledTime}`);
    console.log('Setup Complete! 🚀');
}

setupSheet();
