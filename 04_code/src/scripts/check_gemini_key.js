require('dotenv').config();

console.log('--- Checking Gemini API Key Format ---');

const key = process.env.GEMINI_API_KEY;

if (!key) {
    console.error('❌ GEMINI_API_KEY not found');
    process.exit(1);
}

console.log('Key length:', key.length);
console.log('Key starts with:', key.substring(0, 4) + '...');
// Gemini keys usually start with AIza
if (key.startsWith('AIza')) {
    console.log('✅ Key format looks correct (starts with AIza)');
} else {
    console.log('⚠️ Key format might be incorrect (usually starts with AIza)');
}
