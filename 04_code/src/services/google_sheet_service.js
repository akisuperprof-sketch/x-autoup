const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const env = require('../config/env');
const logger = require('../utils/logger');

class GoogleSheetService {
    constructor() {
        this.doc = null;
        this.initialized = false;
    }

    async init() {
        if (!env.GOOGLE_SHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
            logger.warn('Google Sheets credentials missing. Running in local JSON mode only.');
            return false;
        }

        try {
            // Robust Key Parsing: Handle various Vercel environment variable formats
            let key = env.GOOGLE_PRIVATE_KEY;

            // 1. Remove surrounding quotes if they exist (sometimes added by manual copy-paste in Vercel UI)
            if (key.startsWith('"') && key.endsWith('"')) {
                key = key.substring(1, key.length - 1);
            }
            if (key.startsWith("'") && key.endsWith("'")) {
                key = key.substring(1, key.length - 1);
            }

            // 2. Unescape newlines (essential for multiline private keys stored as single strings)
            key = key.replace(/\\n/g, '\n');

            const serviceAccountAuth = new JWT({
                email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: key,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            this.doc = new GoogleSpreadsheet(env.GOOGLE_SHEET_ID, serviceAccountAuth);
            await this.doc.loadInfo();
            this.initialized = true;
            logger.info(`Connected to Google Sheet: ${this.doc.title}`);
            return true;
        } catch (error) {
            logger.error('Failed to initialize Google Sheets connection', {
                message: error.message,
                email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                sheet_id: env.GOOGLE_SHEET_ID,
                key_preview: env.GOOGLE_PRIVATE_KEY ? (env.GOOGLE_PRIVATE_KEY.substring(0, 30) + '...') : 'MISSING'
            });
            return false;
        }
    }

    async getRows(sheetTitle) {
        if (!this.initialized) return [];
        const sheet = this.doc.sheetsByTitle[sheetTitle];
        if (!sheet) return [];
        return await sheet.getRows();
    }

    async addRow(sheetTitle, rowData) {
        if (!this.initialized) return;
        const sheet = this.doc.sheetsByTitle[sheetTitle];
        if (!sheet) return;
        await sheet.addRow(rowData);
    }

    async deleteRow(sheetTitle, rowId) {
        if (!this.initialized) return;
        const sheet = this.doc.sheetsByTitle[sheetTitle];
        if (!sheet) return;

        const rows = await sheet.getRows();
        const row = rows.find(r => (r.get('id') || r.get('c')) === rowId);
        if (row) {
            await row.delete();
            logger.info(`Deleted row with ID ${rowId} from ${sheetTitle}`);
        } else {
            logger.warn(`Row with ID ${rowId} not found in ${sheetTitle}`);
        }
    }

    /**
     * Management: Ensures a sheet exists with the given headers and enough capacity.
     */
    async ensureSheet(title, headers) {
        if (!this.initialized) return;

        let sheet = this.doc.sheetsByTitle[title];
        if (!sheet) {
            logger.info(`Creating missing sheet: ${title}`);
            sheet = await this.doc.addSheet({
                title,
                headerValues: headers,
                gridProperties: { columnCount: Math.max(26, headers.length + 5) }
            });
        } else {
            // Check if headers need updating
            await sheet.loadHeaderRow();
            const existingHeaders = sheet.headerValues;
            const missingHeaders = headers.filter(h => !existingHeaders.includes(h));

            const totalTargetCols = Math.max(existingHeaders.length + missingHeaders.length, headers.length);

            // Auto-Resize if needed
            if (sheet.gridProperties.columnCount < totalTargetCols) {
                logger.info(`Resizing sheet ${title} to ${totalTargetCols + 2} columns`);
                await sheet.updateProperties({
                    gridProperties: { columnCount: totalTargetCols + 2 }
                });
            }

            if (missingHeaders.length > 0) {
                logger.info(`Updating headers for ${title}. Adding: ${missingHeaders}`);
                const newHeaders = [...existingHeaders, ...missingHeaders];
                await sheet.setHeaderRow(newHeaders);
            }
        }
        return sheet;
    }
}

module.exports = new GoogleSheetService();
