const dataService = require('../services/data_service');
const logger = require('../utils/logger');
const crypto = require('crypto');

async function fixIds() {
    console.log('🔍 Checking for missing IDs in Spreadsheet...');
    await dataService.init();

    if (!dataService.useSheets) {
        console.log('Skipping: Not using Google Sheets.');
        return;
    }

    const posts = await dataService.getPosts();
    let fixedCount = 0;

    for (const post of posts) {
        if (!post.id || post.id === 'undefined') {
            const newId = 'post_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

            // post._row is the GoogleSpreadsheetRow object
            if (post._row) {
                post._row.set('id', newId);
                await post._row.save(); // Save back to sheet
                console.log(`✅ Fixed Row ${post._row.rowIndex}: Assigned ID ${newId}`);
                fixedCount++;
                // Wait a bit to avoid rate limits
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }

    if (fixedCount === 0) {
        console.log('✨ No missing IDs found. All good!');
    } else {
        console.log(`🎉 Fixed ${fixedCount} rows.`);
    }
}

fixIds();
