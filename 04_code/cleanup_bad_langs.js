const dataService = require('./src/services/data_service');

async function cleanupForeignAndHashtags() {
    try {
        await dataService.init();
        const posts = await dataService.getPosts();

        // Regex for non-Japanese/ASCII characters (roughly targeting Cyrillic/etc)
        // Also checking for '#'
        const cyrillicPattern = /[\u0400-\u04FF]/;
        const hashtagPattern = /#/;

        let count = 0;
        for (const post of posts) {
            if (post.status === 'scheduled') {
                const hasCyrillic = cyrillicPattern.test(post.draft);
                const hasHashtag = hashtagPattern.test(post.draft);

                if (hasCyrillic || hasHashtag) {
                    await dataService.updatePost(post.id, { status: 'deleted' });
                    console.log(`CLEANED: ID ${post.id} (Reason: ${hasCyrillic ? 'Cyrillic' : 'Hashtag'})`);
                    count++;
                }
            }
        }

        console.log(`\n✅ Cleanup complete. ${count} bad posts moved to 'deleted'.`);
        process.exit(0);
    } catch (e) {
        console.error("Cleanup failed:", e);
        process.exit(1);
    }
}

cleanupForeignAndHashtags();
