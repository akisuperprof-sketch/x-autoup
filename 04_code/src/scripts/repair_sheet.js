const googleSheetService = require('../services/google_sheet_service');
const logger = require('../utils/logger');

const TARGET_SCHEMA = [
    'id', 'status', 'scheduled_at', 'draft', 'stage', 'enemy', 'season', 'hashtags',
    'cta_type', 'media_type', 'media_prompt', 'dedupe_hash', 'priority', 'retry_count',
    'last_error', 'tweet_id', 'posted_at', 'metrics_like', 'metrics_rt', 'metrics_reply',
    'metrics_checked_at_1h', 'metrics_checked_at_24h', 'created_at', 'updated_at', 'ai_model',
    'lp_priority', 'post_type', 'click_count', 'cv_count'
];

async function repair() {
    logger.info('🔧 Starting Spreadsheet ID Sequential Repair...');
    const initialized = await googleSheetService.init();
    if (!initialized) return;

    const sheet = googleSheetService.doc.sheetsByTitle['posts'];
    if (!sheet) {
        logger.error('Posts sheet not found.');
        return;
    }

    await sheet.loadHeaderRow();
    const headers = sheet.headerValues;
    const rows = await sheet.getRows();
    logger.info(`Found ${rows.length} rows to repair.`);

    // 1. Sort by creation date if available, otherwise by their current raw ID or position
    const sortedData = rows.map(row => {
        const obj = {};
        headers.forEach(h => { obj[h] = row.get(h); });

        // Ensure defaults
        obj.lp_priority = obj.lp_priority || 'low';
        obj.post_type = obj.post_type || '解説型';
        obj.status = obj.status || 'draft_ai';
        obj.draft = obj.draft || row.get('draft') || '';
        obj.created_at = obj.created_at || new Date().toISOString();

        // Temporarily store original ID for chronological logic if it was timestamp-based
        obj._originalId = row.get('id') || row.get('c') || '0';

        return obj;
    }).sort((a, b) => {
        // Sort by created_at first
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        if (dateA !== dateB) return dateA - dateB;
        // Fallback to original ID if timestamps are same
        return (parseInt(a._originalId) || 0) - (parseInt(b._originalId) || 0);
    });

    // 2. Assign sequential IDs
    const repairedData = sortedData.map((obj, index) => {
        obj.id = (100001 + index).toString();
        delete obj._originalId;
        return obj;
    });

    // 3. Clear and Rewrite
    logger.info('Clearing sheet and resetting headers...');
    await sheet.clear();
    await sheet.setHeaderRow(TARGET_SCHEMA);

    logger.info('Restoring aligned sequential data...');
    for (let i = 0; i < repairedData.length; i += 50) {
        const chunk = repairedData.slice(i, i + 50);
        await sheet.addRows(chunk);
    }

    logger.info('✨ Sequential ID Repair Complete!');
    process.exit(0);
}

repair();
