const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
    console.log('--- Listing Available Gemini Models ---');
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // Note: listModels is a method on the GoogleGenerativeAI instance in some versions,
        // or accessed via a model manager. Let's try the standard way.
        // If the SDK version is recent, we might need to use a specific endpoint or just try a simple generation to a known stable model.
        // But let's try to see if we can get a specific error message that is more descriptive.

        // Actually, the error "models/gemini-1.5-flash is not found" usually means the API is enabled but the specific model isn't available to this key,
        // OR the API itself is disabled.

        console.log('Checking API accessibility...');
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        // Just try a very simple prompt
        await model.generateContent('Hi');
        console.log('✅ gemini-pro is working (unexpectedly based on previous logs)');

    } catch (error) {
        console.error('❌ Error details:');
        console.error(error.message);

        if (error.message.includes('API has not been used in project')) {
            console.log('\n💡 HINT: The Generative Language API is not enabled for your project.');
            console.log('Please visit: https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview');
        }
    }
}

listModels();
