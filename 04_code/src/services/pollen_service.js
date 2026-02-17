const axios = require('axios');
const logger = require('../utils/logger');

class PollenService {
    constructor() {
        this.cache = null;
        this.lastFetched = null;
    }

    async getPollenForecast() {
        const today = new Date().toLocaleDateString('ja-JP');
        if (this.cache && this.lastFetched === today) {
            return this.cache;
        }

        try {
            // we use the expectation page which includes daily levels for major cities
            const url = 'https://tenki.jp/pollen/expectation/';
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const html = response.data;

            // Simple parsing for Tokyo as a representative
            // Looking for something like "東京都(千代田区) 少ない"
            const tokyoMatch = html.match(/東京都\(千代田区\)\s*([\s\S]*?)<\/a>/);
            let tokyoLevel = '不明';
            if (tokyoMatch) {
                const inner = tokyoMatch[1];
                if (inner.includes('非常に多い')) tokyoLevel = '非常に多い';
                else if (inner.includes('多い')) tokyoLevel = '多い';
                else if (inner.includes('やや多い')) tokyoLevel = 'やや多い';
                else if (inner.includes('少ない')) tokyoLevel = '少ない';
                else if (inner.includes('飛散開始前')) tokyoLevel = '飛散開始前';
            }

            const info = {
                date: today,
                tokyo: tokyoLevel,
                isPollenSeason: tokyoLevel !== '飛散開始前' && tokyoLevel !== '不明',
                source: 'tenki.jp'
            };

            this.cache = info;
            this.lastFetched = today;
            logger.info(`Pollen forecast fetched: Tokyo=${tokyoLevel}`);
            return info;
        } catch (e) {
            logger.error('Failed to fetch pollen forecast', e.message);
            return { date: today, tokyo: '不明', isPollenSeason: true, error: true };
        }
    }
}

module.exports = new PollenService();
