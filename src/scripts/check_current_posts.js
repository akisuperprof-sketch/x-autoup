const dataService = require('../services/data_service');

async function checkPosts() {
    await dataService.init();
    const posts = await dataService.getPosts();

    // Filter for scheduled posts and draft_ai posts
    const scheduled = posts.filter(p => p.status === 'scheduled');
    const drafts = posts.filter(p => p.status === 'draft_ai');

    console.log(`\n--- Status Report ---`);
    console.log(`Total Posts in DB: ${posts.length}`);
    console.log(`Scheduled: ${scheduled.length}`);
    console.log(`Drafts (AI): ${drafts.length}`);
    console.log(`\n--- Details of Scheduled Posts ---`);

    if (scheduled.length > 0) {
        scheduled.forEach(p => {
            console.log(`ID: ${p.id}`);
            console.log(`Time: ${p.scheduled_at}`);
            console.log(`Content: ${p.draft.substring(0, 30)}...`);
            console.log('---');
        });
    } else {
        console.log("No posts are currently scheduled.");
    }
}

checkPosts();
