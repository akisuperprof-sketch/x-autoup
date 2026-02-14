const googleSheetService = require('../services/google_sheet_service');
const logger = require('../utils/logger');

async function main() {
    console.log('Testing Google Sheets connection...');
    try {
        const success = await googleSheetService.init();
        if (success) {
            console.log('✅ Connection Successful!');
            console.log('Sheet Title:', googleSheetService.doc.title);
        } else {
            console.log('❌ Connection Failed (Check logs for details)');
        }
    } catch (error) {
        console.error('❌ Critical Error:', error);
    }
}

main();
