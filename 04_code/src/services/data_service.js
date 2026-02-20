const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const googleSheetService = require('./google_sheet_service');

const DATA_DIR = path.join(__dirname, '../../data');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

class DataService {
    constructor() {
        this.useSheets = false;
    }

    async init() {
        try {
            this.useSheets = await googleSheetService.init();
            if (this.useSheets) {
                logger.info('DataService v2 initialized with Google Sheets storage.');
            } else {
                logger.warn('DataService initialized in LOCAL mode (Sheets failed). Be aware of Vercel R/O filesystem.');
            }
        } catch (e) {
            logger.error('DataService init failed hard', e);
            this.useSheets = false;
        }
    }

    // --- Core Data Access ---

    async getPosts() {
        if (this.useSheets) {
            try {
                const rows = await googleSheetService.getRows('posts');
                return rows.map(row => this._mapRowToPost(row));
            } catch (error) {
                logger.error('Error fetching posts from Sheet', error);
                return [];
            }
        } else {
            try {
                // Ensure data directory exists in local mode
                await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => { });
                const data = await fs.readFile(POSTS_FILE, 'utf8').catch(async () => {
                    await fs.writeFile(POSTS_FILE, '[]').catch(() => { });
                    return '[]';
                });
                return JSON.parse(data);
            } catch (err) {
                logger.error('Error reading posts JSON', err);
                return [];
            }
        }
    }

    _mapRowToPost(row) {
        return {
            id: row.get('id') || row.get('c'),
            status: row.get('status'),
            scheduled_at: row.get('scheduled_at'),
            draft: row.get('draft'),
            stage: row.get('stage'),
            enemy: row.get('enemy'),
            season: row.get('season'),
            hashtags: this._safeParseJson(row.get('hashtags'), []),
            cta_type: row.get('cta_type'),
            media_type: row.get('media_type') || 'none',
            media_prompt: row.get('media_prompt'),
            dedupe_hash: row.get('dedupe_hash'),
            priority: parseInt(row.get('priority') || '0'),
            retry_count: parseInt(row.get('retry_count') || '0'),
            last_error: row.get('last_error'),
            tweet_id: row.get('tweet_id'),
            posted_at: row.get('posted_at'),
            metrics_like: parseInt(row.get('metrics_like') || '0'),
            metrics_rt: parseInt(row.get('metrics_rt') || '0'),
            metrics_reply: parseInt(row.get('metrics_reply') || '0'),
            metrics_checked_at_1h: row.get('metrics_checked_at_1h'),
            metrics_checked_at_24h: row.get('metrics_checked_at_24h'),
            created_at: row.get('created_at'),
            updated_at: row.get('updated_at'),
            ai_model: row.get('ai_model'),
            lp_priority: row.get('lp_priority'),
            post_type: row.get('post_type'),
            click_count: parseInt(row.get('click_count') || '0'),
            cv_count: parseInt(row.get('cv_count') || '0'),
            lp_section: row.get('lp_section'),
            ab_version: row.get('ab_version'),
            slot_id: row.get('slot_id'),
            revenue: parseFloat(row.get('revenue') || '0'),
            cvr: parseFloat(row.get('cvr') || '0')
        };
    }

    async addPost(post) {
        const now = new Date().toISOString();
        const text = (post.draft || '').trim();
        const dedupe_hash = crypto.createHash('sha256').update(text).digest('hex');

        // Deduplication Logic
        const posts = await this.getPosts();
        const recentPosts = posts.slice(-100);

        if (recentPosts.some(p => p.dedupe_hash === dedupe_hash)) {
            logger.warn(`Skipping duplicate content (hash match): ${text.substring(0, 20)}...`);
            return { skipped: true, reason: 'duplicate_hash' };
        }

        if (post.status !== 'draft_ai') {
            for (const p of recentPosts) {
                // Relaxed similarity threshold for Japanese text (0.8 -> 0.95)
                if (this._calculateSimilarity(text, p.draft) > 0.95) {
                    logger.warn(`Skipping similar content (similarity > 0.95)`);
                    return { skipped: true, reason: 'similarity_too_high' };
                }
            }
        }

        let slot_id = post.slot_id;
        if (!slot_id && post.scheduled_at) {
            const parts = post.scheduled_at.match(/(\d+).(\d+).(\d+)\s+(\d+)/);
            if (parts) {
                const [, y, m, d, h] = parts;
                slot_id = `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}-${h.padStart(2, '0')}`;
            }
        }

        if (slot_id) {
            const alreadyExists = posts.some(p => {
                const targetStatus = ['scheduled', 'posted', 'retry'].includes(p.status);
                if (!targetStatus) return false;
                if (p.slot_id === slot_id) return true;
                if (!p.slot_id && p.scheduled_at) {
                    const pParts = p.scheduled_at.match(/(\d+).(\d+).(\d+)\s+(\d+)/);
                    if (pParts) {
                        const [, py, pm, pd, ph] = pParts;
                        const pSlotId = `${py}${pm.padStart(2, '0')}${pd.padStart(2, '0')}-${ph.padStart(2, '0')}`;
                        return pSlotId === slot_id;
                    }
                }
                return false;
            });

            if (alreadyExists) {
                logger.warn(`Skipping post creation: Slot ${slot_id} already has a valid post.`);
                return { skipped: true, reason: 'slot_taken', slot_id };
            }
        }

        const newId = posts.length > 0
            ? (Math.max(...posts.map(p => parseInt(p.id) || 0)) + 1).toString()
            : '100001';

        const newPost = {
            ...post,
            id: post.id || newId,
            status: post.status || 'draft_ai',
            dedupe_hash: dedupe_hash,
            slot_id: slot_id || '',
            hashtags: JSON.stringify(post.hashtags || []),
            created_at: now,
            updated_at: now,
            retry_count: 0,
            priority: post.priority || 0
        };

        if (newPost.draft && newPost.draft.includes('[post_id]')) {
            newPost.draft = newPost.draft.replace(/\[post_id\]/g, newPost.id);
        }

        if (this.useSheets) {
            try {
                const postsHeaders = [
                    'id', 'status', 'scheduled_at', 'draft', 'stage', 'enemy', 'season',
                    'hashtags', 'cta_type', 'media_type', 'media_prompt', 'dedupe_hash',
                    'priority', 'retry_count', 'last_error', 'tweet_id', 'posted_at',
                    'metrics_like', 'metrics_rt', 'metrics_reply', 'metrics_checked_at_1h',
                    'metrics_checked_at_24h', 'created_at', 'updated_at', 'ai_model',
                    'lp_priority', 'post_type', 'click_count', 'cv_count', 'lp_section',
                    'ab_version', 'slot_id'
                ];
                await googleSheetService.ensureSheet('posts', postsHeaders);
                await googleSheetService.addRow('posts', newPost);
                return { success: true, id: newPost.id };
            } catch (error) {
                logger.error('Error adding post to Sheet', error);
                throw error;
            }
        } else {
            const allPosts = await this.getPosts();
            newPost.hashtags = post.hashtags || [];
            allPosts.push(newPost);
            await fs.writeFile(POSTS_FILE, JSON.stringify(allPosts, null, 2)).catch(() => { });
            return { success: true, id: newPost.id };
        }
    }

    async updatePost(id, updates) {
        updates.updated_at = new Date().toISOString();
        if (this.useSheets) {
            const rows = await googleSheetService.getRows('posts');
            const row = rows.find(r => (r.get('id') || r.get('c')) === id);
            if (row) {
                for (const [key, value] of Object.entries(updates)) {
                    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
                    row.set(key, stringValue);
                }
                await row.save();
            }
        } else {
            const posts = await this.getPosts();
            const idx = posts.findIndex(p => p.id === id);
            if (idx !== -1) {
                posts[idx] = { ...posts[idx], ...updates };
                await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2)).catch(() => { });
            }
        }
    }

    async deletePost(id) {
        if (this.useSheets) {
            await googleSheetService.deleteRow('posts', id);
        } else {
            const posts = await this.getPosts();
            const filtered = posts.filter(p => p.id !== id);
            await fs.writeFile(POSTS_FILE, JSON.stringify(filtered, null, 2)).catch(() => { });
        }
    }

    async incrementClick(id) {
        if (this.useSheets) {
            const rows = await googleSheetService.getRows('posts');
            const row = rows.find(r => (r.get('id') || r.get('c')) === id);
            if (row) {
                const current = parseInt(row.get('click_count') || '0');
                row.set('click_count', (current + 1).toString());
                await row.save();
            }
        }
    }

    async logJourney(journeyData) {
        if (!this.useSheets) return;
        try {
            const headers = ['timestamp', 'visitor_id', 'entry_page', 'referrer', 'clicks', 'conversions', 'path', 'duration', 'ab_version', 'post_id'];
            await googleSheetService.ensureSheet('journeys', headers);
            await googleSheetService.addRow('journeys', {
                ...journeyData,
                timestamp: new Date().toISOString(),
                path: JSON.stringify(journeyData.path || [])
            });
        } catch (e) {
            logger.error('Error logging journey', e);
        }
    }

    async getDictionaries() {
        if (!this.useSheets) return { enemies: [], tags: [], trends: [], ng_words: [], safe_phrases: [] };
        try {
            const rows = await googleSheetService.getRows('dictionaries');
            const dict = { enemies: [], tags: [], trends: [], ng_words: [], safe_phrases: [] };
            rows.forEach(r => {
                const enemy = r.get('enemy_list');
                const tag = r.get('permanent_tags');
                const trend = r.get('trend_candidates');
                const ng = r.get('ng_words');
                const safe = r.get('safe_phrases');
                if (enemy) dict.enemies.push(enemy);
                if (tag) dict.tags.push(tag);
                if (trend) dict.trends.push(trend);
                if (ng) dict.ng_words.push(ng);
                if (safe) dict.safe_phrases.push(safe);
            });
            return dict;
        } catch (e) {
            logger.warn('Error fetching dictionaries sheet', e.message);
            return { enemies: [], tags: [], trends: [], ng_words: [], safe_phrases: [] };
        }
    }

    async getContentTemplates() {
        if (!this.useSheets) return [];
        try {
            const rows = await googleSheetService.getRows('content_templates');
            return rows.map(r => ({
                id: r.get('id'),
                name: r.get('name'),
                type: r.get('type'),
                template_text: r.get('template_text'),
                usage_notes: r.get('usage_notes')
            }));
        } catch (e) {
            logger.warn('Error fetching content_templates', e.message);
            return [];
        }
    }

    async getPostPatterns() {
        if (!this.useSheets) return [];
        try {
            const rows = await googleSheetService.getRows('post_patterns');
            return rows.map(r => ({
                id: r.get('id'),
                pattern_name: r.get('pattern_name'),
                rule_description: r.get('rule_description'),
                active: r.get('active') === 'TRUE' || r.get('active') === '1'
            }));
        } catch (e) {
            logger.warn('Error fetching post_patterns', e.message);
            return [];
        }
    }

    async acquireLock(key, ttlSeconds = 300) {
        if (!this.useSheets) return true;
        try {
            const rows = await googleSheetService.getRows('locks');
            const row = rows.find(r => r.get('key') === key);
            const now = new Date();
            if (row) {
                const expiresAt = new Date(row.get('expires_at'));
                if (expiresAt.getTime() > now.getTime()) return false;
                row.set('locked_at', now.toISOString());
                row.set('expires_at', new Date(now.getTime() + ttlSeconds * 1000).toISOString());
                await row.save();
                return true;
            } else {
                await googleSheetService.addRow('locks', {
                    key: key,
                    locked_at: now.toISOString(),
                    expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString()
                });
                return true;
            }
        } catch (e) {
            logger.error('Error acquiring lock', e);
            return false;
        }
    }

    async releaseLock(key) {
        if (!this.useSheets) return;
        try {
            const rows = await googleSheetService.getRows('locks');
            const row = rows.find(r => r.get('key') === key);
            if (row) {
                row.set('expires_at', new Date(0).toISOString());
                await row.save();
            }
        } catch (e) { }
    }

    async logCron(jobName, status, duration = 0, error = '') {
        if (!this.useSheets) return;
        try {
            const headers = ['timestamp', 'job_name', 'status', 'duration_ms', 'error_log'];
            await googleSheetService.ensureSheet('cron_logs', headers);
            await googleSheetService.addRow('cron_logs', {
                timestamp: new Date().toISOString(),
                job_name: jobName,
                status: status,
                duration_ms: duration,
                error_log: error
            });
        } catch (e) {
            logger.error('Error logging cron', e);
        }
    }

    getLpName(lp_id) {
        const lpMap = {
            'mini_lp': 'メイン',
            'mini_main': 'メイン',
            'hayfever': '花粉',
            'pet': 'ペット',
            'dental': '歯科',
            '3dprinter': '3D',
            'hub': 'ハブ',
            'default_lp': '未指定'
        };
        return lpMap[lp_id] || lp_id;
    }

    _calculateSimilarity(s1, s2) {
        if (!s1 || !s2) return 0;
        const set1 = new Set(s1.split(''));
        const set2 = new Set(s2.split(''));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
    }

    _safeParseJson(str, fallback) {
        try {
            return str ? JSON.parse(str) : fallback;
        } catch (e) {
            return fallback;
        }
    }
}

module.exports = new DataService();
