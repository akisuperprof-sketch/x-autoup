const dataService = require('../services/data_service');

async function testSlotLock() {
    try {
        await dataService.init();

        const timestamp = '2026/02/16 08:00:00';
        console.log(`Attempting to add a post for ${timestamp}...`);

        const result = await dataService.addPost({
            draft: `Unique content test ${Date.now()}`,
            scheduled_at: timestamp,
            status: 'scheduled'
        });

        if (result.skipped) {
            console.log('✅ Success: Post was SKIPPED as expected.');
            console.log('Reason:', result.reason);
            console.log('Slot ID:', result.slot_id);
        } else {
            console.log('❌ Failure: Post was added despite potentially existing slot.');
        }
    } catch (error) {
        console.error('Test error:', error);
    }
}

testSlotLock();
