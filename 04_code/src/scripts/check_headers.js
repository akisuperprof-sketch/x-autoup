const dataService = require('../services/data_service');
const googleSheetService = require('../services/google_sheet_service');

async function checkHeaders() {
    try {
        await dataService.init();
        const sheet = googleSheetService.doc.sheetsByTitle['logs'];
        await sheet.loadHeaderRow();
        console.log('Headers:', sheet.headerValues);

        const rows = await sheet.getRows();
        if (rows.length > 0) {
            console.log('First row raw data:', rows[0].toObject());
        }
    } catch (error) {
        console.error(error);
    }
}

checkHeaders();
