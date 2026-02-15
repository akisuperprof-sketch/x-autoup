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

        // Primary Execution: Posting (High Priority)
        // Default behavior (no action param) is ONLY to process scheduled posts to save API quota
        const action = req.query.action || 'scheduled_post';

        if (action === 'scheduled_post') {
            try {
                await schedulerService.runCronSequence('scheduled_post');
            } catch (e) {
                logger.error('Scheduled post task failed in Cron sequence', e);
            }
        } else if (action === 'all') {
            // "all" still exists if manually triggered or specially configured
            await schedulerService.runCronSequence('scheduled_post');
            await schedulerService.runCronSequence('generate_drafts');
            await schedulerService.runCronSequence('check_metrics');
        } else {
            // Specific action like generate_drafts or check_metrics
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
