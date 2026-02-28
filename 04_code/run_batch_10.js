const dataService = require('./src/services/data_service');
const contentGeneratorService = require('./src/services/content_generator_service');
const newsService = require('./src/services/news_service');
const pollenService = require('./src/services/pollen_service');
const logger = require('./src/utils/logger');

async function runRealBatch() {
    try {
        console.log("🚀 Starting generation of 10 posts for scheduling...");
        await dataService.init();

        const posts = await dataService.getPosts();
        // UNIQUE CONTENT PROTECTION: Get first 10 chars of ALL past posts
        const prohibitedPrefixes = posts
            .filter(p => p.draft)
            .map(p => p.draft.substring(0, 10));

        const pollenInfo = await pollenService.getPollenForecast();
        const news = await newsService.getLatestNews();

        const context = {
            season: 'Spring (Late February)',
            tokyoPollen: pollenInfo.tokyo,
            isPollenSeason: pollenInfo.isPollenSeason,
            newsTopics: news,
            trend: 'Live Human-likeness Production Batch',
            count: 10,
            targetStage: 'S1',
            memoContent: 'Focus on early pollen symptoms and the need for non-chemical air purification.',
            prohibitedPrefixes: prohibitedPrefixes
        };

        console.log("📡 Requesting 10 unique drafts from AI...");
        const drafts = await contentGeneratorService.generateDrafts(context);

        console.log(`✅ AI returned ${drafts.length} drafts.`);

        // Setup scheduling slots (find available)
        const timeSlots = ['08:00:00', '12:00:00'];
        const occupiedHourSlots = new Set();
        posts.forEach(p => {
            if ((p.status === 'scheduled' || p.status === 'posted') && p.scheduled_at) {
                const parts = p.scheduled_at.split(' ');
                const datePart = parts[0].replace(/-/g, '/');
                const hourPart = parts[1].split(':')[0];
                occupiedHourSlots.add(`${datePart} ${hourPart}`);
            }
        });

        let savedCount = 0;
        let currentDate = new Date();
        // JST calculation
        const jstNow = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
        currentDate = new Date(jstNow.toISOString().split('T')[0] + 'T00:00:00+09:00');

        let dayLoop = 0;
        while (savedCount < drafts.length && dayLoop < 30) {
            const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '/');

            for (const timeStr of timeSlots) {
                if (savedCount >= drafts.length) break;

                const baseHour = timeStr.split(':')[0];
                const hourSlotKey = `${dateStr} ${baseHour}`;

                if (!occupiedHourSlots.has(hourSlotKey)) {
                    const draft = drafts[savedCount];

                    // Add Jitter
                    const [h, m, s] = timeStr.split(':');
                    const baseTime = new Date(`${dateStr.replace(/\//g, '-')}T${h}:${m}:${s}+09:00`);
                    const jitterMS = (Math.floor(Math.random() * 60) - 30) * 60 * 1000;
                    const jitteredDate = new Date(baseTime.getTime() + jitterMS);

                    // Format for Sheet
                    const jstYear = jitteredDate.getFullYear();
                    const jstMonth = jitteredDate.getMonth() + 1;
                    const jstDay = jitteredDate.getDate();
                    const jstHour = jitteredDate.getHours();
                    const jstMin = jitteredDate.getMinutes();
                    const jstSec = jitteredDate.getSeconds();

                    const finalScheduledAt = `${jstYear}/${jstMonth}/${jstDay} ${jstHour.toString().padStart(2, '0')}:${jstMin.toString().padStart(2, '0')}:${jstSec.toString().padStart(2, '0')}`;

                    const result = await dataService.addPost({
                        ...draft,
                        status: 'scheduled',
                        scheduled_at: finalScheduledAt,
                        stage: 'S1',
                        ab_version: savedCount % 2 === 0 ? 'A' : 'B'
                    });

                    if (result.success) {
                        savedCount++;
                        occupiedHourSlots.add(hourSlotKey);
                        console.log(`[${savedCount}/10] Scheduled for ${finalScheduledAt}: ${draft.draft.substring(0, 30)}...`);
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
            dayLoop++;
        }

        console.log(`\n🎉 Batch Complete! Prepared and scheduled ${savedCount} posts.`);
        process.exit(0);
    } catch (e) {
        console.error("❌ Batch failed:", e);
        process.exit(1);
    }
}

runRealBatch();
