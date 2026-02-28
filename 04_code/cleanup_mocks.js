const dataService = require('./src/services/data_service');
const logger = require('./src/utils/logger');

async function cleanupMocks() {
    try {
        await dataService.init();
        const posts = await dataService.getPosts();

        // Identify repetitive mock posts
        // We look for same draft text or IDs mentioned by user
        const mockTexts = [
            "3Dプリンターのレジン臭、実は「慣れ」が一番危険。",
            "家族に「臭い」と言われて3Dプリンターを諦めていませんか？",
            "【実験データ】レジン硬化時のPM2.5濃度は",
            "玄関で服を払っても、花粉の40%は室内に侵入しています。",
            "「朝起きた瞬間のくしゃみ」が辛いなら",
            "空気清浄機のフィルター交換、高くないですか？",
            "ペットのトイレ臭をごまかす芳香剤は",
            "猫のフケや毛によるアレルギー反応。",
            "来客時に「ウチ、ペット臭う？」と心配する必要はもうありません。"
        ];

        let count = 0;
        for (const post of posts) {
            const isMockText = mockTexts.some(m => post.draft && post.draft.startsWith(m));
            const isScheduled = post.status === 'scheduled';

            // Only clean up the ones that are scheduled but look like repetitive mocks
            // (Keeping the ones with high IDs if needed, but safer to mark duplicated as deleted)
            if (isMockText && isScheduled) {
                await dataService.updatePost(post.id, { status: 'deleted' });
                console.log(`CLEANED: ID ${post.id} (Status set to deleted)`);
                count++;
            }
        }

        console.log(`\n✅ Cleanup complete. ${count} mock posts moved to 'deleted' status.`);
        process.exit(0);
    } catch (e) {
        console.error("Cleanup failed:", e);
        process.exit(1);
    }
}

cleanupMocks();
