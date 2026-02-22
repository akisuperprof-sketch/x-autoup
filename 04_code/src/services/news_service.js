const axios = require('axios');
const logger = require('../utils/logger');

class NewsService {
    constructor() {
        this.cache = [];
        this.lastFetched = 0;
        this.TTL = 1000 * 60 * 60; // 1 hour
    }

    async getLatestNews() {
        const now = Date.now();
        if (this.cache.length > 0 && (now - this.lastFetched) < this.TTL) {
            return this.cache;
        }

        try {
            // Broader query to ensure we get results
            const query = encodeURIComponent('空気清浄機 OR 花粉症 OR 3Dプリンター 有害性 OR 室内環境');
            const url = `https://news.google.com/rss/search?q=${query}+when:7d&hl=ja&gl=JP&ceid=JP:ja`;
            const response = await axios.get(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const xml = response.data;
            // Extract <title> content from <item>
            const matches = xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g);
            const news = [];
            for (const match of matches) {
                // Clean up title (remove " - Source" at the end)
                const title = match[1].replace(/ - .*$/, '').trim();
                news.push(title);
                if (news.length >= 10) break;
            }

            if (news.length > 0) {
                this.cache = news;
                this.lastFetched = now;
                logger.info(`Fetched ${news.length} news items for trend context.`);
            }
            return news;
        } catch (e) {
            logger.error('Failed to fetch news trends', e.message);
            return this.cache; // Return stale cache if error
        }
    }
}

module.exports = new NewsService();
