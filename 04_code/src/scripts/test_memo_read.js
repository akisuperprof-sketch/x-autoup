const memoService = require('../services/memo_service');
const logger = require('../utils/logger');

async function testMemoRead() {
    console.log('Testing MemoService (getAllMemos)...');
    try {
        const content = await memoService.getAllMemos();
        if (content) {
            console.log('✅ Successfully read ALL memos!');
            console.log('--- Combined Content Length ---');
            console.log(content.length + ' characters');
            console.log('--- Content Preview (First 500 chars) ---');
            console.log(content.substring(0, 500));
            console.log('... (truncated)');
        } else {
            console.log('❌ No content found.');
        }
    } catch (error) {
        console.error('❌ Error during test:', error);
    }
}

testMemoRead();
