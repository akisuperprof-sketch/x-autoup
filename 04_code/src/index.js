
const schedulerService = require('./services/scheduler_service');
const dataService = require('./services/data_service');
const logger = require('./utils/logger');
const env = require('./config/env');

async function main() {
    logger.info('Initializing X Auto Publisher...');
    logger.info('Configuration:', {
        dryRun: env.DRY_RUN,
        port: env.PORT
    });

    try {
        // Initialize Data Service (Connect to Sheets if configured)
        await dataService.init();

        schedulerService.start();
        logger.info('System started successfully. Waiting for scheduled tasks...');

        // Keep process alive
        process.on('SIGINT', () => {
            logger.info('Shutting down...');
            process.exit(0);
        });
    } catch (error) {
        logger.error('Failed to start system', error);
        process.exit(1);
    }
}

main();
