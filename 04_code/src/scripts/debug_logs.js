const googleSheetService = require('../services/google_sheet_service');
const dataService = require('../services/data_service');

async function debugLogs() {
    try {
        await dataService.init();
        const rows = await googleSheetService.getRows('logs');

        const counts = {};
        const lpIds = new Set();

        rows.forEach(row => {
            const lpId = row.get('lp_id') || 'null';
            const action = row.get('action');
            const isBot = row.get('is_bot');

            const key = `${lpId} | ${action} | Bot=${isBot}`;
            counts[key] = (counts[key] || 0) + 1;
            lpIds.add(lpId);
        });

        console.log('--- Logs Statistics ---');
        console.table(counts);
        console.log('\nUnique LP IDs found:', Array.from(lpIds));

    } catch (e) {
        console.error(e);
    }
}

debugLogs();
