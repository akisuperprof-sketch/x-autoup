const dataService = require('../services/data_service');
const googleSheetService = require('../services/google_sheet_service');

async function checkLogs() {
    try {
        await dataService.init();
        const sheet = googleSheetService.doc.sheetsByTitle['logs'];
        const rows = await sheet.getRows();

        console.log('--- Logs Sheet Check ---');
        console.log(`Total Log Rows: ${rows.length}`);

        console.log('\n--- Latest 5 Logs ---');
        const latest = rows.slice(-5);
        latest.forEach(row => {
            console.log(`[${row.get('timestamp')}] Type: ${row.get('type')}, ID: ${row.get('post_id')}, LP: ${row.get('lp_id')}, IP: ${row.get('ip_hash')}`);
        });
    } catch (error) {
        console.error('Error checking logs:', error);
    }
}

checkLogs();
