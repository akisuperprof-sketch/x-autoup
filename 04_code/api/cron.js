const schedulerService = require('../src/services/scheduler_service');
const dataService = require('../src/services/data_service');
const logger = require('../src/utils/logger');

const env = require('../src/config/env');

module.exports = async (req, res) => {
    // Allow if it's Vercel's internal cron OR if password matches
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const authHeader = req.headers['x-admin-password'] || req.query.pw;
    const isAuth = env.ADMIN_PASSWORD && authHeader === env.ADMIN_PASSWORD;

    if (!isVercelCron && !isAuth) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await dataService.init();

        // Multi-action support from query param or default sequence
        const action = req.query.action || 'scheduled_post';

        // Primary Execution: Posting (High Priority)
        try {
            await schedulerService.runCronSequence('scheduled_post');
        } catch (e) {
            logger.error('Scheduled post task failed in Cron sequence', e);
        }

        // Secondary Executions (Lower Priority/Heavier Tasks)
        if (action === 'all' || !req.query.action) {
            try {
                await schedulerService.runCronSequence('generate_drafts');
            } catch (e) {
                logger.error('Generate drafts task failed in Cron sequence', e);
            }
            try {
                await schedulerService.runCronSequence('check_metrics');
            } catch (e) {
                logger.error('Check metrics task failed in Cron sequence', e);
            }
        } else if (action !== 'scheduled_post') {
            await schedulerService.runCronSequence(action);
        }

        res.status(200).json({
            success: true,
            message: `Cron action(s) completed.`
        });
    } catch (error) {
        logger.error('Cron API failed', error);
        res.status(500).json({ error: error.message });
    }
};
