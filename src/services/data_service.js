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
        this.useSheets = await googleSheetService.init();
        if (this.useSheets) {
            logger.info('DataService v2 initialized with Google Sheets storage.');
        } else {
            logger.info('DataService v2 initialized with Local JSON storage.');
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
                const data = await fs.readFile(POSTS_FILE, 'utf8');
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
            lp_priority: row.get('lp_priority') || 'low',
            post_type: row.get('post_type'),
            click_count: parseInt(row.get('click_count') || '0'),
            cv_count: parseInt(row.get('cv_count') || '0'),
            lp_section: row.get('lp_section'),
            ab_version: row.get('ab_version'),
            _row: row
        };
    }

    _safeParseJson(val, fallback) {
        if (!val) return fallback;
        try {
            return JSON.parse(val);
        } catch (e) {
            return fallback;
        }
    }

    async addPost(post) {
        const now = new Date().toISOString();
        const text = (post.draft || '').trim();
        const dedupe_hash = crypto.createHash('sha256').update(text).digest('hex');

        // Deduplication Logic
        const posts = await this.getPosts();
        const recentPosts = posts.slice(-100); // Check last 100 for safety

        if (recentPosts.some(p => p.dedupe_hash === dedupe_hash)) {
            logger.warn(`Skipping duplicate content (hash match): ${text.substring(0, 20)}...`);
            return { skipped: true, reason: 'duplicate_hash' };
        }

        // Similarity check (Jaccard)
        for (const p of recentPosts) {
            if (this._calculateSimilarity(text, p.draft) > 0.8) {
                logger.warn(`Skipping similar content (similarity > 0.8)`);
                return { skipped: true, reason: 'similarity_too_high' };
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
            hashtags: JSON.stringify(post.hashtags || []),
            created_at: now,
            updated_at: now,
            retry_count: 0,
            priority: post.priority || 0
        };

        // Final URL replacement: Replace [post_id] with real ID
        if (newPost.draft && newPost.draft.includes('[post_id]')) {
            newPost.draft = newPost.draft.replace(/\[post_id\]/g, newPost.id);
        }

        if (this.useSheets) {
            try {
                // Ensure Sheets compatibility for 'c' column if 'id' is used as 'c' in current sheet
                const rows = await googleSheetService.getRows('posts');
                const headers = rows.length > 0 ? rows[0]._worksheet.headerValues : [];
                if (!headers.includes('id') && headers.includes('c')) {
                    newPost.c = newPost.id;
                }
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
            await fs.writeFile(POSTS_FILE, JSON.stringify(allPosts, null, 2));
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
                await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
            }
        }
    }

    async deletePost(id) {
        if (this.useSheets) {
            await googleSheetService.deleteRow('posts', id);
        } else {
            const posts = await this.getPosts();
            const filtered = posts.filter(p => p.id !== id);
            await fs.writeFile(POSTS_FILE, JSON.stringify(filtered, null, 2));
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
                return true;
            }
        } else {
            const posts = await this.getPosts();
            const idx = posts.findIndex(p => p.id === id);
            if (idx !== -1) {
                posts[idx].click_count = (posts[idx].click_count || 0) + 1;
                await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
                return true;
            }
        }
        return false;
    }

    async incrementCV(id) {
        if (this.useSheets) {
            const rows = await googleSheetService.getRows('posts');
            const row = rows.find(r => (r.get('id') || r.get('c')) === id);
            if (row) {
                const current = parseInt(row.get('cv_count') || '0');
                row.set('cv_count', (current + 1).toString());
                await row.save();
                return true;
            }
        } else {
            const posts = await this.getPosts();
            const idx = posts.findIndex(p => p.id === id);
            if (idx !== -1) {
                posts[idx].cv_count = (posts[idx].cv_count || 0) + 1;
                await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
                return true;
            }
        }
        return false;
    }

    // --- Logic Helpers ---

    _calculateSimilarity(s1, s2) {
        if (!s1 || !s2) return 0;
        const set1 = new Set(s1.split(''));
        const set2 = new Set(s2.split(''));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
    }

    // --- Dictionary & Config ---

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

    // --- Cron & Lock Mechanism ---

    async acquireLock(key, ttlSeconds = 300) {
        if (!this.useSheets) return true; // Local mode always succeeds
        try {
            const rows = await googleSheetService.getRows('locks');
            const row = rows.find(r => r.get('key') === key);
            const now = new Date();

            if (row) {
                const expiresAt = new Date(row.get('expires_at'));
                if (expiresAt.getTime() > now.getTime()) {
                    logger.warn(`Lock [${key}] is currently held by another process. Expires at: ${expiresAt.toISOString()}`);
                    return false;
                }
                // Lock expired, overtake
                logger.info(`Overwriting expired lock [${key}]`);
                row.set('locked_at', now.toISOString());
                row.set('expires_at', new Date(now.getTime() + ttlSeconds * 1000).toISOString());
                await row.save();
                return true;
            } else {
                // Create new lock
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
                row.set('expires_at', new Date(0).toISOString()); // Expire immediately
                await row.save();
            }
        } catch (e) {
            logger.error('Error releasing lock', e);
        }
    }

    _getJSTTimestamp() {
        const now = new Date();
        const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        return jstDate.toISOString().replace('T', ' ').substring(0, 19);
    }

    isBot(ua, ref) {
        if (!ua) return true;
        const botKeywords = ['bot', 'crawl', 'spider', 'headless', 'preview', 'lighthouse', 'curl', 'wget', 'python-requests', 'vercel'];
        const uaLower = ua.toLowerCase();
        if (botKeywords.some(kw => uaLower.includes(kw))) return true;

        // Browser checks
        if (!ref && (uaLower.includes('curl') || uaLower.includes('wget') || uaLower.includes('python'))) return true;

        return false;
    }

    getIpHash(ip) {
        if (!ip) return '';
        return crypto.createHash('md5').update(ip).digest('hex').substring(0, 12);
    }

    async getVisitorInfo(ip_hash, ip, ua, ref) {
        if (!this.useSheets) return { label: 'LocalVisitor', is_dev: true };

        // 開発者/システムのIP判別 (簡易)
        const isVercel = ua && ua.toLowerCase().includes('vercel');
        const isAdmin = ref && ref.includes('admin.html');
        const isBot = this.isBot(ua, ref);
        const isDevDefault = isVercel || isAdmin || isBot;

        try {
            await googleSheetService.ensureSheet('visitors', ['ip_hash', 'visitor_index', 'label', 'first_seen', 'last_ts', 'is_dev', 'ua']);
            const rows = await googleSheetService.getRows('visitors');
            let row = rows.find(r => r.get('ip_hash') === ip_hash);

            if (row) {
                row.set('last_ts', this._getJSTTimestamp());
                await row.save();
                return {
                    label: row.get('label'),
                    is_dev: row.get('is_dev') === 'TRUE' || isDevDefault
                };
            } else {
                const nextIndex = rows.length + 1;
                const label = `訪問者 #${nextIndex}`;
                const isDev = isDevDefault;

                await googleSheetService.addRow('visitors', {
                    ip_hash,
                    visitor_index: nextIndex,
                    label: label,
                    first_seen: this._getJSTTimestamp(),
                    last_ts: this._getJSTTimestamp(),
                    is_dev: isDev ? 'TRUE' : 'FALSE',
                    ua: ua || ''
                });
                return { label: label, is_dev: isDev };
            }
        } catch (e) {
            logger.warn('Error management visitors sheet', e.message);
            return { label: 'Unknown', is_dev: false };
        }
    }

    getLpName(lp_id) {
        const lpMap = {
            'mini_main': 'メインLP',
            'hayfever': '花粉専門LP',
            'pet': 'ペット専門LP',
            'dental': '歯科医院専門LP',
            '3dprinter': '3Dプリンタ専門LP',
            'hub': 'ハブ・ポータル',
            'default_lp': '未指定'
        };
        return lpMap[lp_id] || lp_id;
    }

    async ensureLogHeaderExplanation() {
        if (!this.useSheets) return;
        try {
            const sheet = this.doc ? this.doc.sheetsByTitle['logs'] : await googleSheetService.ensureSheet('logs', ['ts', 'post_id', 'action', 'pid', 'visitor_label', 'lp_name', 'lp_id', 'dest_url', 'ref', 'is_bot', 'revenue', 'order_id', 'ip_hash', 'ua', 'data']);
            const rows = await sheet.getRows({ offset: 0, limit: 1 });

            // 2行目（rows[0]）が説明行かチェック
            if (rows.length === 0 || rows[0].get('ts') !== '記録日時') {
                logger.info('Adding header explanation to logs sheet...');
                const explanation = {
                    ts: '記録日時',
                    post_id: '投稿ID',
                    action: '操作種別(click/cv等)',
                    pid: 'パーツID',
                    visitor_label: '訪問者番号',
                    lp_name: 'LP名(日本名)',
                    lp_id: 'LP ID',
                    dest_url: '遷移先URL',
                    ref: 'リファラ',
                    is_bot: 'Bot判定',
                    revenue: '収益額',
                    order_id: '注文ID',
                    ip_hash: '識別ハッシュ',
                    ua: 'ブラウザ情報',
                    data: 'その他詳細JSON'
                };
                // insertRowは困難なのでaddRowしてソート...はできない。
                // 既存のaddRowを使う。初回のみの想定
                if (rows.length === 0) {
                    await sheet.addRow(explanation);
                }
            }
        } catch (e) {
            logger.warn('Header explanation check failed', e.message);
        }
    }

    async addCronLog(log) {
        const entry = {
            run_id: Date.now().toString(),
            timestamp: this._getJSTTimestamp(),
            ...log
        };
        if (this.useSheets) {
            await googleSheetService.addRow('cron_logs', entry);
        }
        logger.info(`Cron Log [${log.action}]: ${log.status} - ${log.processed_count || 0} processed`);
    }

    async addEventLog(action, data = {}) {
        if (!this.useSheets) {
            logger.info(`Event Log [${action} (Local)]: pid=${data.pid} val=${data.revenue || 0}`);
            return;
        }

        const pid = data.pid || data.post_id || '';
        const ipHash = data.ip_hash || this.getIpHash(data.ip || '');
        const vInfo = await this.getVisitorInfo(ipHash, data.ip, data.ua, data.ref);

        const entry = {
            ts: this._getJSTTimestamp(),
            post_id: pid,
            action,
            pid: pid,
            visitor_label: vInfo.label,
            lp_name: this.getLpName(data.lp_id || 'default_lp'),
            lp_id: data.lp_id || 'default_lp',
            dest_url: data.dest_url || '',
            ref: data.ref || '',
            ua: data.ua || '',
            ip_hash: ipHash,
            is_bot: (data.is_bot || vInfo.is_dev) ? 'TRUE' : 'FALSE',
            revenue: parseFloat(data.revenue || 0),
            order_id: data.order_id || '',
            data: data.data ? JSON.stringify(data.data) : ''
        };

        try {
            await googleSheetService.ensureSheet('logs', Object.keys(entry));
            await this.ensureLogHeaderExplanation();
            await googleSheetService.addRow('logs', entry);
            logger.info(`Event Log [${action}]: ${entry.visitor_label} (${entry.lp_name})`);
        } catch (e) {
            logger.error(`[CRITICAL] Error adding event log to Sheet: ${e.message}`);
            // Fallback for debugging: store the last error in the service
            this.lastError = `${new Date().toLocaleTimeString()}: ${e.message}`;
        }
    }
}

module.exports = new DataService();
