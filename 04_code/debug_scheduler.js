/**
 * Debug Scheduler: Test processScheduledPosts locally
 */
const schedulerService = require('./src/services/scheduler_service');
const dataService = require('./src/services/data_service');
const logger = require('./src/utils/logger');

async function debug() {
    console.log('--- [DEBUG] Testing Scheduler Filtering ---');
    await dataService.init();

    const posts = await dataService.getPosts();
    const nowJST = schedulerService._getNowJST();
    console.log('Current Time (UTC):', nowJST.toISOString());
    console.log('Current Time (JST Approx):', new Date(nowJST.getTime() + 9 * 3600000).toISOString());

    const scheduledPosts = posts.filter(p => p.status === 'scheduled' || p.status === 'retry');
    console.log(`Total Scheduled/Retry: ${scheduledPosts.length}`);

    const bufferMS = 15 * 60 * 1000;

    const toPost = posts.filter(p => {
        if (!p.scheduled_at) return false;
        const scheduledDateJST = schedulerService._parseJST(p.scheduled_at);
        const ageMS = nowJST.getTime() - scheduledDateJST.getTime();

        console.log(`Checking ID ${p.id}: ${p.scheduled_at} -> Parsed: ${scheduledDateJST.toISOString()} | Age: ${(ageMS / 3600000).toFixed(2)}h`);

        if (ageMS > 24 * 60 * 60 * 1000 && p.status === 'scheduled') {
            console.log(`  -> SKIP: Stale (>24h)`);
            return false;
        }

        const isDue = (p.status === 'scheduled' || p.status === 'retry') &&
            scheduledDateJST.getTime() <= (nowJST.getTime() + bufferMS) &&
            (p.retry_count || 0) < 5;

        console.log(`  -> isDue: ${isDue}`);
        return isDue;
    });

    console.log(`\nItems in toPost: ${toPost.length}`);

    const uniqueSlots = [];
    const filteredToPost = toPost.sort((a, b) => schedulerService._parseJST(a.scheduled_at) - schedulerService._parseJST(b.scheduled_at))
        .filter(post => {
            const scheduledAt = schedulerService._parseJST(post.scheduled_at);
            const slotKey = `${scheduledAt.getUTCFullYear()}-${scheduledAt.getUTCMonth()}-${scheduledAt.getUTCDate()}-${scheduledAt.getUTCHours()}`;

            const alreadyPostedThisSlot = posts.some(p => {
                const pScheduledAt = schedulerService._parseJST(p.scheduled_at);
                return p.status === 'posted' &&
                    pScheduledAt.getUTCFullYear() === scheduledAt.getUTCFullYear() &&
                    pScheduledAt.getUTCMonth() === scheduledAt.getUTCMonth() &&
                    pScheduledAt.getUTCDate() === scheduledAt.getUTCDate() &&
                    pScheduledAt.getUTCHours() === scheduledAt.getUTCHours();
            });

            if (alreadyPostedThisSlot) {
                console.log(`  -> ID ${post.id} SKIP: Slot ${slotKey} already posted.`);
                return false;
            }
            if (uniqueSlots.includes(slotKey)) {
                console.log(`  -> ID ${post.id} SKIP: Slot ${slotKey} duplicate in current run.`);
                return false;
            }
            uniqueSlots.push(slotKey);
            return true;
        });

    console.log(`\nItems in filteredToPost: ${filteredToPost.length}`);
    if (filteredToPost.length > 0) {
        console.log('Top match:', filteredToPost[0].id);
    }
}

debug();
