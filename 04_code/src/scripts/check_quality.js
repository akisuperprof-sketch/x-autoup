const dataService = require('../services/data_service');
const logger = require('../utils/logger');

async function checkQuality() {
    console.log('Starting Quality Check...');
    await dataService.init();

    const posts = await dataService.getPosts();
    const drafts = posts.map(p => p.draft);

    console.log(`Total posts: ${drafts.length}`);

    // 1. Check for English words (simple regex)
    // Allow hashtags and emojis, check for English sentences
    const englishRegex = /[A-Za-z]{3,}/g;

    console.log('\n--- English Word Check ---');
    drafts.forEach((draft, i) => {
        // Exclude hashtags and URLs
        const cleanDraft = draft.replace(/#\w+/g, '').replace(/http\S+/g, '');
        const matches = cleanDraft.match(englishRegex);
        if (matches) {
            // Filter out common allowed words like "AirFuture", "Mock"
            const badMatches = matches.filter(w => !['AirFuture', 'Mock'].includes(w));
            if (badMatches.length > 0) {
                console.log(`[Row ${i + 2}] Contains English: ${badMatches.join(', ')}`);
                console.log(`  -> "${draft}"`);
            }
        }
    });

    // 2. Check for Duplicates / Similarity
    console.log('\n--- Similarity Check ---');
    for (let i = 0; i < drafts.length; i++) {
        for (let j = i + 1; j < drafts.length; j++) {
            if (drafts[i] === drafts[j]) {
                console.log(`[Row ${i + 2} & ${j + 2}] EXACT DUPLICATE`);
                console.log(`  -> "${drafts[i]}"`);
            } else {
                // Simple similarity check (start with same 10 chars)
                if (drafts[i].substring(0, 20) === drafts[j].substring(0, 20)) {
                    console.log(`[Row ${i + 2} & ${j + 2}] High Similarity (Starts same)`);
                    console.log(`  -> A: "${drafts[i]}"`);
                    console.log(`  -> B: "${drafts[j]}"`);
                }
            }
        }
    }

    console.log('\nCheck Complete.');
}

checkQuality();
