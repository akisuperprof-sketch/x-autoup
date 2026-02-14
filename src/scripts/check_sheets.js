const googleSheetService = require('../services/google_sheet_service');
const logger = require('../utils/logger');

async function checkSheets() {
    console.log("Connecting to Spreadsheet...");
    const connected = await googleSheetService.init();
    if (!connected) {
        console.log("Could not connect.");
        return;
    }

    const doc = googleSheetService.doc;
    console.log(`Title: ${doc.title}`);
    console.log("Sheets available:");

    let hashtagSheetExists = false;
    doc.sheetsByIndex.forEach(sheet => {
        console.log(` - ${sheet.title} (RowCount: ${sheet.rowCount})`);
        if (sheet.title.toLowerCase().includes('hashtag')) {
            hashtagSheetExists = true;
        }
    });

    if (hashtagSheetExists) {
        console.log("\n✅ Found a sheet that looks like 'hashtags'. I will configure the system to read from it.");
    } else {
        console.log("\n⚠️ No 'hashtags' sheet found. Please create one named 'hashtags' if you want to manage tags there.");
    }
}

checkSheets();
