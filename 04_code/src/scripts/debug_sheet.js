const dataService = require('../services/data_service');
const logger = require('../utils/logger');

async function checkSheet() {
    try {
        await dataService.init();
        const posts = await dataService.getPosts();

        console.log('--- Spreadsheet Status Report ---');
        console.log(`Total Rows (Posts): ${posts.length}`);

        // Count by status
        const counts = {};
        posts.forEach(p => {
            const s = p.status || '(empty)';
            counts[s] = (counts[s] || 0) + 1;
        });

        console.log('Status Counts:');
        console.table(counts);

        console.log('\n--- Latest 3 Posts (Bottom of Sheet) ---');
        const last3 = posts.slice(-3);
        last3.forEach((p, i) => {
            console.log(`[${posts.length - 2 + i}] ID: ${p.id}, Status: ${p.status}, Date: ${p.scheduled_at}, Draft: ${p.draft.substring(0, 20)}...`);
        });

        console.log('\n--- Upcoming Queue (Logic Check) ---');
        const queued = posts.filter(p => p.status === 'scheduled' || p.status === 'draft_ai');
        console.log(`System considers ${queued.length} posts as 'Queued' (Stock).`);

    } catch (error) {
        console.error('Error checking sheet:', error);
    }
}

checkSheet();
