const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
console.log('Imported pdf-parse:', pdf);

const filePath = '/Users/akihironishi/x-autoup/00memo/x投稿元データ用.pdf';

async function testDirectRead() {
    console.log(`Reading file: ${filePath}`);
    try {
        if (!fs.existsSync(filePath)) {
            console.log('File does not exist!');
            return;
        }
        const dataBuffer = fs.readFileSync(filePath);
        console.log(`Buffer size: ${dataBuffer.length} bytes`);

        console.log('Parsing PDF...');
        const data = await pdf(dataBuffer);

        console.log('--- PDF Info ---');
        console.log('Pages:', data.numpages);
        console.log('Info:', data.info);
        console.log('--- Text Snippet ---');
        console.log(data.text.substring(0, 200));

    } catch (error) {
        console.error('Error parsing PDF:', error);
    }
}

testDirectRead();
