/**
 * Metrics Guardian: Analytics Infrastructure Verification Script
 * This script ensures that the tracking methods are present and functional in DataService.
 * RUN THIS AFTER ANY MODIFICATION TO src/services/data_service.js
 */

const dataService = require('./src/services/data_service');
const logger = require('./src/utils/logger');

async function verify() {
    console.log('--- [GUARDIAN] Analytics Infrastructure Verification ---');

    const requiredMethods = [
        'addEventLog', 'isBot', 'getIpHash', 'incrementClick', 'getLpName',
        'acquireLock', 'releaseLock', 'addCronLog'
    ];
    let failed = false;

    for (const method of requiredMethods) {
        if (typeof dataService[method] === 'function') {
            console.log(`✅ Method [${method}] is PRESENT.`);
        } else {
            console.error(`❌ Method [${method}] is MISSING or NOT a function!`);
            failed = true;
        }
    }

    if (failed) {
        console.error('--- CRITICAL FAILURE: Analytics infrastructure is broken! ---');
        process.exit(1);
    }

    // Attempt a safe mock log (without Sheets if possible, or just checking if it doesn't crash)
    try {
        console.log('--- Testing addEventLog execution (Local Mode) ---');
        // Temporarily disable Sheets for this test to avoid polluting actual logs if run locally
        const originalUseSheets = dataService.useSheets;
        dataService.useSheets = false;

        await dataService.addEventLog('check', {
            pid: 'guardian_test',
            lp_id: 'mini_lp',
            ua: 'GuardianBot/1.0',
            ip: '127.0.0.1'
        });

        console.log('✅ addEventLog executed without crashing.');
        dataService.useSheets = originalUseSheets;
    } catch (e) {
        console.error('❌ addEventLog CRASHED:', e.message);
        process.exit(1);
    }

    console.log('--- ALL SYSTEMS GREEN: Analytics Infrastructure is SAFE ---');
}

verify();
