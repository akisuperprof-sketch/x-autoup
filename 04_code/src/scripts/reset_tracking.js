const dataService = require('../services/data_service');
const googleSheetService = require('../services/google_sheet_service');
const logger = require('../utils/logger');

async function resetTracking() {
    logger.info('Starting tracking data reset...');

    try {
        await dataService.init();

        if (!dataService.useSheets) {
            logger.error('Reset script only works with Google Sheets mode.');
            return;
        }

        // 1. Reset Logs Sheet
        logger.info('Resetting logs sheet...');
        const logHeaders = ['ts', 'post_id', 'action', 'pid', 'lp_id', 'dest_url', 'ref', 'ua', 'ip_hash', 'is_bot', 'revenue', 'order_id', 'data'];
        const logSheet = googleSheetService.doc.sheetsByTitle['logs'];
        if (logSheet) {
            await logSheet.clear();
            await logSheet.setHeaderRow(logHeaders);
            logger.info('✓ Logs sheet cleared.');
        }

        // 2. Reset Cron Logs Sheet
        logger.info('Resetting cron_logs sheet...');
        const cronHeaders = ['run_id', 'timestamp', 'action', 'status', 'duration_ms', 'processed_count', 'success_count', 'failed_count', 'skipped_count', 'error'];
        const cronSheet = googleSheetService.doc.sheetsByTitle['cron_logs'];
        if (cronSheet) {
            await cronSheet.clear();
            await cronSheet.setHeaderRow(cronHeaders);
            logger.info('✓ Cron logs sheet cleared.');
        }

        // 3. Reset Post Counts
        logger.info('Resetting metrics in posts sheet...');
        const postRows = await googleSheetService.getRows('posts');
        let count = 0;
        for (const row of postRows) {
            row.set('click_count', '0');
            row.set('cv_count', '0');
            row.set('revenue', '0');
            row.set('metrics_like', '0');
            row.set('metrics_rt', '0');
            row.set('metrics_reply', '0');
            row.set('metrics_checked_at_1h', '');
            row.set('metrics_checked_at_24h', '');
            await row.save();
            count++;
        }
        logger.info(`✓ Reset metrics for ${count} posts.`);

        // 4. (Optional) Reset Locks
        const lockSheet = googleSheetService.doc.sheetsByTitle['locks'];
        if (lockSheet) {
            await lockSheet.clear();
            await lockSheet.setHeaderRow(['key', 'locked_at', 'expires_at']);
            logger.info('✓ Locks sheet cleared.');
        }

        logger.info('Tracking data reset completed successfully.');
        process.exit(0);
    } catch (error) {
        logger.error('Failed to reset tracking data:', error);
        process.exit(1);
    }
}

resetTracking();
