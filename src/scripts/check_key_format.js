const fs = require('fs');
require('dotenv').config();

console.log('--- Checking Private Key Format ---');

const key = process.env.GOOGLE_PRIVATE_KEY;

if (!key) {
    console.error('❌ GOOGLE_PRIVATE_KEY not found');
    process.exit(1);
}

console.log('Key starts with:', key.substring(0, 50));
console.log('Key ends with:', key.substring(key.length - 50));
console.log('Key length:', key.length);
console.log('Contains \\n:', key.includes('\\n'));
console.log('Contains actual newlines:', key.includes('\n'));

// Try to format it correctly
const formattedKey = key.replace(/\\n/g, '\n');
console.log('\n--- After formatting ---');
console.log('Formatted key starts with:', formattedKey.substring(0, 50));
console.log('Contains actual newlines now:', formattedKey.includes('\n'));

// Check if it's valid JSON
try {
    const keyObj = JSON.parse(`{"key": "${key}"}`);
    console.log('✅ Key is valid JSON string');
} catch (e) {
    console.log('❌ Key has JSON parsing issues');
}
