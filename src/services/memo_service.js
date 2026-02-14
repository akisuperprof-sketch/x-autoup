const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const logger = require('../utils/logger');

const MEMO_DIR = path.resolve(__dirname, '../../../00memo');

class MemoService {
    /**
     * Retrieves the content of ALL valid files (text, markdown, pdf, or no extension) in the 00memo directory.
     * @returns {Promise<string>} Combined content of all memos.
     */
    async getAllMemos() {
        try {
            if (!fs.existsSync(MEMO_DIR)) {
                logger.warn(`Memo directory not found: ${MEMO_DIR}`);
                return '';
            }

            const files = fs.readdirSync(MEMO_DIR);

            // Accepted extensions. 
            // We also accept empty string '' for files like "事業計画テキストデータ"
            const acceptedExtensions = ['.txt', '.md', '.pdf', ''];

            const targetFiles = files
                .filter(file => !file.startsWith('.')) // Ignore hidden files like .DS_Store
                .map(file => {
                    const filePath = path.join(MEMO_DIR, file);
                    return {
                        name: file,
                        path: filePath,
                        ext: path.extname(file).toLowerCase(),
                        stats: fs.statSync(filePath)
                    };
                })
                .filter(fileObj => fileObj.stats.isFile() && acceptedExtensions.includes(fileObj.ext));

            if (targetFiles.length === 0) {
                logger.info('No relevant memo files found in 00memo.');
                return '';
            }

            logger.info(`Found ${targetFiles.length} memo files. combining contents...`);

            let combinedContent = '';

            for (const fileObj of targetFiles) {
                let fileContent = '';
                try {
                    if (fileObj.ext === '.pdf') {
                        const dataBuffer = fs.readFileSync(fileObj.path);
                        const pdfData = await pdf(dataBuffer);
                        fileContent = pdfData.text.trim();
                    } else {
                        // Assume text/utf-8 for .txt, .md, and no-extension files
                        fileContent = fs.readFileSync(fileObj.path, 'utf-8').trim();
                    }

                    if (fileContent) {
                        combinedContent += `\n\n--- SOURCE: ${fileObj.name} ---\n${fileContent}\n`;
                    }
                } catch (err) {
                    logger.error(`Failed to read file ${fileObj.name}:`, err);
                }
            }

            return combinedContent;

        } catch (error) {
            logger.error('Error reading memos:', error);
            return '';
        }
    }
}

module.exports = new MemoService();
