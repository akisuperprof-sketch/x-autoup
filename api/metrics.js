const schedulerService = require('../src/services/scheduler_service');
const dataService = require('../src/services/data_service');
const logger = require('../src/utils/logger');

module.exports = async (req, res) => {
    try {
        await dataService.init();
        logger.info('Metrics API triggered');

        // Background execution
        schedulerService.runCronSequence('check_metrics');

        res.status(200).json({
            success: true,
            message: 'Metrics check triggered in background.'
        });
    } catch (error) {
        logger.error('Metrics API failed', error);
        res.status(500).json({ error: error.message });
    }
};
