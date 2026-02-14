const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testGemini() {
    console.log('--- Testing Gemini API ---');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not found in .env');
        return;
    }

    console.log(`API Key length: ${apiKey.length}`);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        // Try different model names
        const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];

        for (const modelName of models) {
            console.log(`\nTrying model: ${modelName}...`);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('こんにちは！テストです。');
                const response = await result.response;
                const text = response.text();
                console.log(`✅ ${modelName} works!`);
                console.log(`Response: ${text.substring(0, 100)}...`);
                break; // Success, exit loop
            } catch (error) {
                console.log(`❌ ${modelName} failed: ${error.message}`);
            }
        }

    } catch (error) {
        console.error('❌ Critical Error:', error);
    }
}

testGemini();
