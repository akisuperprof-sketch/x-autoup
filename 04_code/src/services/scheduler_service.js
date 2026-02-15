const cron = require('node-cron');
const dataService = require('./data_service');
const xService = require('./x_service');
const contentGeneratorService = require('./content_generator_service');
const logger = require('../utils/logger');
const axios = require('axios');
const env = require('../config/env');

class SchedulerService {
    constructor() {
        this.consecutiveFailures = 0;
        this.CIRCUIT_BREAKER_THRESHOLD = 5;
    }

    start() {
        if (process.env.RUN_MODE === 'local') {
            logger.info('Starting local scheduler (node-cron)...');
            // Process Scheduled Posts (Every 5 minutes for safety in local)
            cron.schedule('*/5 * * * *', async () => {
                await this.runCronSequence('scheduled_post');
            });

            // Generate Daily Drafts (Every day at 23:00 UTC = 08:00 JST)
            cron.schedule('0 23 * * *', async () => {
                await this.runCronSequence('generate_drafts');
            });

            // Metrics Check (Every hour)
            cron.schedule('30 * * * *', async () => {
                await this.runCronSequence('check_metrics');
            });
        } else {
            logger.info('Scheduler started in production mode (Vercel Cron expected).');
        }
    }

    /**
     * Unified entry point for cron tasks with locking and logging
     */
    async runCronSequence(action) {
        const lockKey = `cron_${action}`;
        // CRITICAL: Lock TTL should be long enough for AI gen but short enough to recover.
        // We use 60s as a safe middle ground.
        const hasLock = await dataService.acquireLock(lockKey, 60);
        if (!hasLock) {
            logger.warn(`[CRON] Failed to acquire lock for ${action}. Another process may be running.`);
            return;
        }

        const startTime = Date.now();
        let stats = { processed_count: 0, success_count: 0, failed_count: 0, skipped_count: 0 };

        try {
            logger.info(`[CRON] Starting action: ${action}`);

            if (action === 'scheduled_post') {
                stats = await this.processScheduledPosts();
            } else if (action === 'generate_drafts') {
                stats = await this.generateDailyDrafts();
            } else if (action === 'check_metrics') {
                stats = await this.checkMetrics();
            }

            await dataService.addCronLog({
                action,
                status: 'success',
                duration_ms: Date.now() - startTime,
                ...stats
            });
        } catch (error) {
            logger.error(`[CRON] Fatal error in ${action}`, error);
            await dataService.addCronLog({
                action,
                status: 'fatal_error',
                duration_ms: Date.now() - startTime,
                error: error.message
            });
            await this.notifyWebhook(`🚨 Cron Fatal Error: ${action}\n${error.message}`);
        } finally {
            await dataService.releaseLock(lockKey);
        }
    }

    async processScheduledPosts() {
        if (this.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
            logger.warn('Circuit breaker active. Skipping posting.');
            return { skipped_count: 1, reason: 'circuit_breaker' };
        }

        const stats = { processed_count: 0, success_count: 0, failed_count: 0, skipped_count: 0 };
        const posts = await dataService.getPosts();
        const nowJST = this._getNowJST();

        // Filter posts to be posted (using JST timezone)
        const toPost = posts.filter(p => {
            if (!p.scheduled_at) return false;

            // Parse scheduled_at as JST
            const scheduledDateJST = this._parseJST(p.scheduled_at);

            // Measure 2: Skip stale posts (more than 24 hours old)
            // If its too old, its better to skip it and post the next fresh one.
            const ageMS = nowJST.getTime() - scheduledDateJST.getTime();
            if (ageMS > 24 * 60 * 60 * 1000 && p.status === 'scheduled') {
                logger.warn(`Skipping stale post ID: ${p.id} (Scheduled at: ${p.scheduled_at})`);
                return false;
            }

            // Measure 1: Look-ahead buffer (Allow posting if scheduled within next 10 minutes)
            // Combined with 10-min cron, this ensures no post is missed even with jitter.
            const bufferMS = 10 * 60 * 1000;
            const isDue = (p.status === 'scheduled' || p.status === 'retry') &&
                scheduledDateJST.getTime() <= (nowJST.getTime() + bufferMS) &&
                (p.retry_count || 0) < 5; // Increased retry limit slightly

            return isDue;
        }).sort((a, b) => this._parseJST(a.scheduled_at) - this._parseJST(b.scheduled_at))
            .slice(0, 5); // Safety: max 5 per run

        stats.processed_count = toPost.length;

        // One-Post-Per-Slot Guard: Filter toPost to ensure we only pick the first one for each hour slot
        const uniqueSlots = [];
        const filteredToPost = toPost.filter(post => {
            const scheduledAt = this._parseJST(post.scheduled_at);
            const slotKey = `${scheduledAt.getFullYear()}-${scheduledAt.getMonth()}-${scheduledAt.getDate()}-${scheduledAt.getHours()}`;

            // Check if we already have a 'posted' item for this slot in the database
            const alreadyPostedThisSlot = posts.some(p => {
                const pScheduledAt = this._parseJST(p.scheduled_at);
                return p.status === 'posted' &&
                    pScheduledAt.getFullYear() === scheduledAt.getFullYear() &&
                    pScheduledAt.getMonth() === scheduledAt.getMonth() &&
                    pScheduledAt.getDate() === scheduledAt.getDate() &&
                    pScheduledAt.getHours() === scheduledAt.getHours();
            });

            if (alreadyPostedThisSlot) {
                logger.info(`[GUARD] Already posted for slot ${post.scheduled_at}. Skipping ID: ${post.id}`);
                return false;
            }

            // Also check if we've already picked an item for this slot in CURRENT run's filtered list
            if (uniqueSlots.includes(slotKey)) {
                logger.warn(`[GUARD] Multiple scheduled items for same slot ${post.scheduled_at}. Picking only the first one found. Skipping ID: ${post.id}`);
                return false;
            }
            uniqueSlots.push(slotKey);
            return true;
        });

        if (filteredToPost.length === 0 && toPost.length > 0) {
            logger.info('[CRON] All due items for this slot were already posted or deduplicated.');
            return stats;
        }

        if (filteredToPost.length === 0) {
            logger.info(`[CRON] No due posts to process. Current JST: ${this._formatJST(nowJST)}`);
            const currentHour = nowJST.getHours();
            if ([8, 12, 20].includes(currentHour)) {
                // Safety: Check if we ALREADY posted for this specific hour slot to avoid duplicate emergency gens (especially with 10-min crons)
                const alreadyPostedThisSlot = posts.some(p => {
                    const scheduledAt = this._parseJST(p.scheduled_at);
                    return p.status === 'posted' &&
                        scheduledAt.getFullYear() === nowJST.getFullYear() &&
                        scheduledAt.getMonth() === nowJST.getMonth() &&
                        scheduledAt.getDate() === nowJST.getDate() &&
                        scheduledAt.getHours() === currentHour;
                });

                if (alreadyPostedThisSlot) {
                    logger.info(`[CRON] Already posted for the ${currentHour}:00 slot. Skipping emergency gen.`);
                    return stats;
                }

                logger.warn(`[EMERGENCY] No posts found for ${currentHour}:00 slot (JST). Generating on the fly...`);

                try {
                    await dataService.init();
                    const dictionaries = await dataService.getDictionaries();
                    const dayOfWeek = nowJST.getDay();
                    const stage = ['S5', 'S1', 'S2', 'S3', 'S1', 'S2', 'S4'][dayOfWeek];

                    const context = {
                        season: this._getSeason(nowJST),
                        trend: 'Emergency Failover Posting',
                        count: 1,
                        targetStage: stage,
                        productMentionAllowed: true
                    };

                    const drafts = await contentGeneratorService.generateDrafts(context, dictionaries);
                    if (drafts && drafts.length > 0) {
                        const emergencyPost = drafts[0];
                        logger.info(`[EMERGENCY] Posting newly generated content: ${emergencyPost.draft.substring(0, 20)}...`);

                        const result = await xService.postTweet(emergencyPost.draft);

                        const randomSeconds = Math.floor(Math.random() * 60);
                        const randomMins = Math.floor(Math.random() * 5); // Add minor offset even for emergency
                        const scheduledTime = this._formatJST(nowJST).split(' ')[1]; // Current time like 08:02:15

                        await dataService.addPost({
                            ...emergencyPost,
                            status: 'posted',
                            tweet_id: result.id,
                            posted_at: new Date().toISOString(),
                            scheduled_at: this._formatJST(nowJST).split(' ')[0].replace(/-/g, '/') + ` ${scheduledTime}`
                        });

                        await this.notifyWebhook(`🚨 【緊急自動生成】\n${currentHour}時用の予約がなかったため、AIがその場で記事を生成して投稿を完了しました。`);
                        stats.success_count++;
                        return stats;
                    }
                } catch (genError) {
                    logger.error('[EMERGENCY] Failed to generate failover post', genError);
                    await this.notifyWebhook(`🛑 【緊急自動生成失敗】\n${currentHour}時の投稿が不能です。手動での対応をお願いします。\nError: ${genError.message}`);
                }
            }
        }

        for (const post of filteredToPost) {
            try {
                // Safety: Daily limit check (hard limit 5)
                const todayJSTStr = this._formatJST(nowJST).split(' ')[0]; // "2026-02-13"
                // Check against JST date of posted_at (if stored in a way we can parse)
                // Actually posted_at is ISO string, so we need to convert it to JST for comparison
                const todayPosts = posts.filter(p => {
                    if (p.status !== 'posted' || !p.posted_at) return false;
                    const pDateJST = this._formatJST(new Date(p.posted_at)).split(' ')[0];
                    return pDateJST === todayJSTStr;
                });

                if (todayPosts.length >= 5) {
                    logger.warn(`Daily post limit reached (${todayPosts.length}/5). Skipping post ${post.id}.`);
                    stats.skipped_count++;
                    continue;
                }

                logger.info(`Posting tweet ID: ${post.id}`);
                const result = await xService.postTweet(post.draft);

                await dataService.updatePost(post.id, {
                    status: 'posted',
                    tweet_id: result.id,
                    posted_at: new Date().toISOString(),
                    last_error: ''
                });

                this.consecutiveFailures = 0;
                stats.success_count++;
            } catch (error) {
                this.consecutiveFailures++;
                stats.failed_count++;
                const newRetryCount = (post.retry_count || 0) + 1;
                const nextStatus = newRetryCount >= 5 ? 'failed' : 'retry';

                logger.error(`Failed to post tweet ID: ${post.id}. Retry: ${newRetryCount}`, error);
                await dataService.updatePost(post.id, {
                    status: nextStatus,
                    retry_count: newRetryCount,
                    last_error: error.message
                });

                if (this.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
                    await this.notifyWebhook(`🛑 【致命的エラー】システムが連続${this.consecutiveFailures}回投稿に失敗しました。サーキットブレーカーを発動し、一時停止します。`);
                } else {
                    await this.notifyWebhook(`⚠️ 【投稿失敗】ID: ${post.id} (試行:${newRetryCount}回目)\nエラー: ${error.message}`);
                }
            }
        }
        return stats;
    }

    async generateDailyDrafts(count = 3) {
        const stats = { processed_count: 0, success_count: 0, failed_count: 0 };
        try {
            await dataService.init();
            const dictionaries = await dataService.getDictionaries();
            const templates = await dataService.getContentTemplates();
            const patterns = await dataService.getPostPatterns();
            const posts = await dataService.getPosts();

            // Look ahead for Today (D+0), Tomorrow (D+1) and Day after tomorrow (D+2)
            const targetDays = [0, 1, 2];
            const timeSlots = ['08:00:00', '12:00:00', '20:00:00'];
            const stages = ['S1', 'S2', 'S3', 'S1', 'S2', 'S4']; // Stage rotation candidates

            for (const offset of targetDays) {
                // FIXED: Use JST for date calculation
                const now = new Date();
                const jstString = now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
                const targetDate = new Date(jstString);
                targetDate.setDate(targetDate.getDate() + offset);
                const targetStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }).replace(/-/g, '/');

                // Check if posts already exist for this day (at least 3 recommended)
                const existingInDay = posts.filter(p => {
                    if (!p.scheduled_at || !['scheduled', 'posted', 'retry'].includes(p.status)) return false;
                    const pDate = this._parseJST(p.scheduled_at);
                    return pDate.getFullYear() === targetDate.getFullYear() &&
                        pDate.getMonth() === targetDate.getMonth() &&
                        pDate.getDate() === targetDate.getDate();
                });

                if (existingInDay.length < count) {
                    const existingHours = existingInDay.map(p => this._parseJST(p.scheduled_at).getHours());

                    const missingSlots = timeSlots.filter(slot => {
                        const hour = parseInt(slot.split(':')[0]);
                        return !existingHours.includes(hour);
                    }).slice(0, count - existingInDay.length);

                    if (missingSlots.length > 0) {
                        logger.info(`[AUTO-GEN] Found ${existingInDay.length}/${count} posts for ${targetStr}. Filling ${missingSlots.length} missing slots.`);
                        await this.notifyWebhook(`⚡ 【補充型AI生成】\n${targetStr}の予約が不足（${existingInDay.length}/${count}）していたため、AIが欠けている時間枠（${missingSlots.join(', ')}）を生成しました。`);

                        const dayOfWeek = targetDate.getDay();
                        const baseStage = ['S5', 'S1', 'S2', 'S3', 'S1', 'S2', 'S4'][dayOfWeek];

                        const recentPosts = posts.slice(-10); // Provide last 10 for diversity
                        const context = {
                            season: this._getSeason(targetDate),
                            trend: 'Automated Daily Fill-in',
                            count: missingSlots.length,
                            targetStage: baseStage,
                            productMentionAllowed: true,
                            recentPosts: recentPosts
                        };
                        const drafts = await contentGeneratorService.generateDrafts(context, { ...dictionaries, templates, patterns });

                        for (let i = 0; i < drafts.length; i++) {
                            const time = missingSlots[i] || '12:00:00';
                            const rotatedStage = stages[(dayOfWeek + i) % stages.length];
                            const abVersion = i % 2 === 0 ? 'A' : 'B';

                            // Level 2: Time Jitter (Add 0-7 minutes random delay)
                            const [h, m, s] = time.split(':');
                            const baseTime = new Date(`${targetStr.replace(/\//g, '-')}T${h}:${m}:${s}+09:00`);
                            const jitteredDate = new Date(baseTime.getTime() + Math.floor(Math.random() * 8 * 60 * 1000));
                            const jitteredTime = this._formatJST(jitteredDate).split(' ')[1];

                            const result = await dataService.addPost({
                                ...drafts[i],
                                status: 'scheduled',
                                scheduled_at: `${targetStr} ${jitteredTime}`,
                                stage: drafts[i].stage || rotatedStage,
                                ab_version: drafts[i].ab_version || abVersion
                            });
                            if (result && result.success) stats.success_count++;
                        }
                        stats.processed_count += drafts.length;
                    }
                } else {
                    logger.info(`[AUTO-GEN] Sufficient posts (${existingInDay.length}) exist for ${targetStr}. Skipping.`);
                }
            }

            // Stock Check Alert
            const remainingCount = posts.filter(p => p.status === 'scheduled' || p.status === 'draft_ai').length;
            if (remainingCount < 6) { // Less than 2 days
                await this.notifyWebhook(`⚠️ 【記事在庫アラート】\n予約リストの残りが${remainingCount}件（約2日分以下）です。新しく記事を生成するか、トピックを指定して補充してください。`);
            }
        } catch (error) {
            logger.error('Error in generating drafts', error);
            stats.failed_count = 1;
        }
        return stats;
    }

    async checkMetrics() {
        const stats = { processed_count: 0, success_count: 0, failed_count: 0 };
        const posts = await dataService.getPosts();
        const now = new Date();

        // Check posts from last 48 hours that are posted but missing 24h metrics
        const candidates = posts.filter(p =>
            p.status === 'posted' &&
            p.tweet_id &&
            (!p.metrics_checked_at_24h)
        );

        for (const post of candidates) {
            const postedAt = new Date(post.posted_at);
            const ageHours = (now - postedAt) / 3600000;

            let update = null;
            if (ageHours >= 24) {
                logger.info(`Checking 24h metrics for ${post.tweet_id}`);
                const data = await xService.getTweetMetrics(post.tweet_id);
                if (data && data.public_metrics) {
                    update = {
                        metrics_like: data.public_metrics.like_count,
                        metrics_rt: data.public_metrics.retweet_count,
                        metrics_reply: data.public_metrics.reply_count,
                        metrics_checked_at_24h: now.toISOString()
                    };
                }
            } else if (ageHours >= 1 && !post.metrics_checked_at_1h) {
                logger.info(`Checking 1h metrics for ${post.tweet_id}`);
                const data = await xService.getTweetMetrics(post.tweet_id);
                if (data && data.public_metrics) {
                    update = {
                        metrics_like: data.public_metrics.like_count,
                        metrics_rt: data.public_metrics.retweet_count,
                        metrics_reply: data.public_metrics.reply_count,
                        metrics_checked_at_1h: now.toISOString()
                    };
                }
            }

            if (update) {
                await dataService.updatePost(post.id, update);
                stats.success_count++;
            }
            stats.processed_count++;
        }
        return stats;
    }

    async notifyWebhook(message) {
        if (!env.WEBHOOK_URL) return;
        try {
            await axios.post(env.WEBHOOK_URL, { text: message });
        } catch (e) {
            logger.error('Webhook notification failed', e.message);
        }
    }

    /**
     * Get current time in JST (Japan Standard Time)
     * @returns {Date} Current time as JST Date object
     */
    _getNowJST() {
        // Return current time as a real UTC date object.
        // We will compare it with the UTC dates returned by _parseJST.
        return new Date();
    }

    /**
     * Parse scheduled_at string as JST and return as UTC Date
     * @param {string} scheduledAtStr - Format: "2026/2/12 8:00:00" or "2026/2/12 8:00"
     * @returns {Date} Date object (UTC)
     */
    _parseJST(scheduledAtStr) {
        if (!scheduledAtStr) return new Date(0);

        // Normalize separators
        const normalized = scheduledAtStr.trim().replace(/\//g, '-');

        // Enhanced regex to handle optional seconds
        const parts = normalized.match(/(\d+)-(\d+)-(\d+)\s+(\d+):(\d+)(?::(\d+))?/);
        if (!parts) {
            logger.warn(`Invalid scheduled_at format: ${scheduledAtStr}`);
            return new Date(0);
        }

        const [, year, month, day, hour, minute, second] = parts;

        // Create a Date object interpreting the numbers as JST
        // We use the browser/server independent way: string parsing with timezone
        const jstIsoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${(second || '00').padStart(2, '0')}+09:00`;
        const dt = new Date(jstIsoString);

        if (isNaN(dt.getTime())) {
            logger.error(`Failed to parse JST string: ${jstIsoString}`);
            return new Date(0);
        }
        return dt;
    }

    /**
     * Format Date as JST string
     * @param {Date} date 
     * @returns {string} Format: "2026-02-12 08:00:00"
     */
    _formatJST(date) {
        const jstString = date.toLocaleString('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        // "2026/02/12 08:00:00" -> "2026-02-12 08:00:00"
        return jstString.replace(/\//g, '-');
    }

    _getSeason(date) {
        const month = date.getMonth() + 1;
        if (month >= 3 && month <= 5) return 'Spring';
        if (month >= 6 && month <= 8) return 'Summer';
        if (month >= 9 && month <= 11) return 'Autumn';
        return 'Winter';
    }
}

module.exports = new SchedulerService();
