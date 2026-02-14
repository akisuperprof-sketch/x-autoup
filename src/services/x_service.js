const { TwitterApi } = require('twitter-api-v2');
const env = require('../config/env');
const logger = require('../utils/logger');

class XService {
    constructor() {
        if (env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET) {
            this.client = new TwitterApi({
                appKey: env.X_API_KEY,
                appSecret: env.X_API_SECRET,
                accessToken: env.X_ACCESS_TOKEN,
                accessSecret: env.X_ACCESS_SECRET,
            });
            this.rwClient = this.client.readWrite;
        } else {
            logger.warn('X API credentials missing. XService initialized in mock mode.');
            this.client = null;
        }
    }

    async postTweet(text, mediaIds = []) {
        if (env.DRY_RUN) {
            logger.info('[DRY RUN] Would post tweet:', { text, mediaIds });
            return { id: 'mock_id_' + Date.now(), text };
        }

        if (!this.client) {
            throw new Error('X API client not initialized');
        }

        try {
            const tweet = await this.rwClient.v2.tweet({
                text: text,
                media: mediaIds.length > 0 ? { media_ids: mediaIds } : undefined
            });
            logger.info('Tweet posted successfully', tweet);
            return tweet.data;
        } catch (error) {
            logger.error('Error posting tweet', error);
            throw error;
        }
    }

    async deleteTweet(tweetId) {
        if (env.DRY_RUN) {
            logger.info('[DRY RUN] Would delete tweet:', tweetId);
            return { deleted: true };
        }

        if (!this.client) {
            throw new Error('X API client not initialized');
        }

        try {
            const result = await this.rwClient.v2.deleteTweet(tweetId);
            logger.info('Tweet deleted successfully', result);
            return result.data;
        } catch (error) {
            logger.error('Error deleting tweet', error);
            throw error;
        }
    }

    async getTweetMetrics(tweetId) {
        if (env.DRY_RUN || !this.client) {
            return {
                public_metrics: {
                    like_count: Math.floor(Math.random() * 10),
                    retweet_count: Math.floor(Math.random() * 2),
                    reply_count: 0,
                    quote_count: 0
                }
            };
        }

        try {
            const tweet = await this.client.v2.singleTweet(tweetId, {
                "tweet.fields": ["public_metrics", "created_at"]
            });
            return tweet.data;
        } catch (error) {
            logger.error(`Error fetching metrics for tweet ${tweetId}`, error);
            throw error;
        }
    }

    async uploadMedia(buffer, mimeType) {
        if (env.DRY_RUN || !this.client) {
            logger.info('[DRY RUN] Would upload media');
            return 'mock_media_id';
        }
        try {
            const mediaId = await this.client.v1.uploadMedia(buffer, { mimeType });
            return mediaId;
        } catch (error) {
            logger.error('Error uploading media', error);
            throw error;
        }
    }
}

module.exports = new XService();
