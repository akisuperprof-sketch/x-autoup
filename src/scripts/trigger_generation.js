const schedulerService = require('../services/scheduler_service');
const dataService = require('../services/data_service');
const logger = require('../utils/logger');

async function main() {
    // Initialize data service first
    await dataService.init();

    logger.info('Manually triggering daily draft generation...');
    await schedulerService.generateDailyDrafts();
    logger.info('Done.');
}

main();
