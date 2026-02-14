const contentGeneratorService = require('../services/content_generator_service');
const dataService = require('../services/data_service');
const memoService = require('../services/memo_service'); // Added import
const logger = require('../utils/logger');

async function generateWeeklyDrafts() {
    console.log('Starting Weekly Draft Generation...');

    // Initialize data service (connect to sheet)
    await dataService.init();

    const today = new Date();
    const scheduleTimes = [
        { hour: 8, minute: 0 },
        { hour: 12, minute: 30 },
        { hour: 20, minute: 0 }
    ];

    // Generate for next 30 days
    // 1. Get Base Memos
    let memoContent = await memoService.getAllMemos();

    // 2. Get Hashtags from Sheet
    const sheetHashtags = await dataService.getHashtagsFromSheet();
    if (sheetHashtags.length > 0) {
        console.log(`📝 Found ${sheetHashtags.length} hashtags in Sheet. Adding to knowledge base.`);
        memoContent += `\n\n# HASHTAG LIST (from Spreadsheet): \nUse these tags preferentially:\n` + sheetHashtags.join('\n');
    }

    if (memoContent) {
        console.log('📝 Knowledge Base ready (Memos + Hashtags).');
    }

    for (let i = 1; i <= 7; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);

        console.log(`Generating drafts for Day ${i} (${targetDate.toLocaleDateString('ja-JP')})...`);

        // Determine season/trend (simplified)
        const month = targetDate.getMonth() + 1;
        let season = 'Winter';
        if (month >= 3 && month <= 5) season = 'Spring';
        else if (month >= 6 && month <= 8) season = 'Summer';
        else if (month >= 9 && month <= 11) season = 'Autumn';

        // Removed hardcoded "Influenza" check. Trend is now generic unless specific season logic is desired.
        // We keep the season logic as a fallback base.
        let trend = '空気の悩み全般';
        if (season === 'Winter') trend = '冬の空気対策';
        if (season === 'Spring') trend = '花粉・新生活';
        if (season === 'Summer') trend = '湿気・カビ';
        if (season === 'Autumn') trend = '秋のアレルギー';

        // Integrate memo content:
        // Use memo preferentially. If memo exists, we can append it to the trend or pass it explicitly.
        // We updated contentGeneratorService to accept 'memoContent'.

        // Product mention logic: 2日に1回 (Once every 2 days).
        // Let's say Day 1, 3, 5... are Allowed. Day 2, 4, 6... are Restricted.
        const productMentionAllowed = (i % 2 !== 0);

        const context = {
            season,
            trend,
            count: 3,
            memoContent: memoContent, // Pass the memo content
            productMentionAllowed: productMentionAllowed
        };
        const drafts = await contentGeneratorService.generateDrafts(context);

        // Special handling for Day 1, first post: Replace with Self-Introduction
        if (i === 1 && drafts.length > 0) {
            drafts[0] = {
                draft: `はじめまして！ボクは48世紀から来た空気の守護神、AirFutureくん！🚀✨\n\nみんなの部屋を「森のような空気」にするのが使命だよ🌲\n\n医療レベルの技術でウイルス・花粉・ニオイを撃退！👊💥\n\n空気の悩み、なんでも相談してね！(中の人はいないよ、ボクだよ！)\n\n#AirFuture #空気清浄機 #自己紹介`,
                stage: 'S1', // Introduction fits S1 (Empathy/Connection)
                hashtags: ['#AirFuture', '#空気清浄機', '#自己紹介'],
                season: season
            };
            console.log('  -> Set first post to Self-Introduction.');
        }

        // Schedule them
        for (let j = 0; j < drafts.length; j++) {
            if (j >= scheduleTimes.length) break;

            const time = scheduleTimes[j];
            const scheduledAt = new Date(targetDate);
            scheduledAt.setHours(time.hour, time.minute, 0, 0);

            // Format to JST string: YYYY/MM/DD HH:mm:ss
            const y = scheduledAt.getFullYear();
            const m = String(scheduledAt.getMonth() + 1).padStart(2, '0');
            const d = String(scheduledAt.getDate()).padStart(2, '0');
            const h = String(scheduledAt.getHours()).padStart(2, '0');
            const min = String(scheduledAt.getMinutes()).padStart(2, '0');
            const formattedTime = `${y}/${m}/${d} ${h}:${min}:00`;

            const charCount = drafts[j].draft.length;

            await dataService.addPost({
                ...drafts[j],
                status: 'draft_ai',
                scheduled_at: formattedTime,
                char_count: charCount
            });
        }
    }

    await dataService.addLog({
        action: 'generate_drafts',
        status: 'success',
        result: `Generated drafts for 7 days (Total ~21 posts)`
    });

    console.log('✅ Weekly generation complete! Check your spreadsheet.');
}

generateWeeklyDrafts();
