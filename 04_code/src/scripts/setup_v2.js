const googleSheetService = require('../services/google_sheet_service');
const logger = require('../utils/logger');

const SCHEMA = {
    posts: [
        'id', 'status', 'scheduled_at', 'draft', 'stage', 'enemy', 'season', 'hashtags',
        'cta_type', 'media_type', 'media_prompt', 'dedupe_hash', 'priority', 'retry_count',
        'last_error', 'tweet_id', 'posted_at', 'metrics_like', 'metrics_rt', 'metrics_reply',
        'metrics_checked_at_1h', 'metrics_checked_at_24h', 'created_at', 'updated_at', 'ai_model',
        'lp_priority', 'post_type', 'click_count', 'cv_count', 'lp_section', 'ab_version'
    ],
    logs: [
        'timestamp', 'post_id', 'action', 'status', 'result', 'error', 'context'
    ],
    cron_logs: [
        'run_id', 'timestamp', 'action', 'status', 'duration_ms', 'processed_count',
        'success_count', 'failed_count', 'skipped_count', 'error'
    ],
    locks: [
        'key', 'locked_at', 'expires_at'
    ],
    dictionaries: [
        'enemy_list', 'permanent_tags', 'trend_candidates', 'ng_words', 'safe_phrases'
    ],
    content_templates: [
        'id', 'name', 'type', 'template_text', 'usage_notes'
    ],
    post_patterns: [
        'id', 'pattern_name', 'rule_description', 'active'
    ]
};

const DEFAULT_DICTIONARY = {
    enemy_list: ['花粉', 'ダニ', '梅雨のカビ', 'インフルエンザ', 'PM2.5', 'ハウスダスト', 'ペットの毛', '料理の煙'],
    permanent_tags: ['#AirFuture', '#空気清浄機', '#暮らしを整える'],
    trend_candidates: ['空気の悩み', '快適な睡眠', '花粉症対策', '最新家電'],
    ng_words: ['世界一', '絶対治る', 'NO.1', '最強'],
    safe_phrases: ['森のような空気', '48世紀の技術', 'ボクにお任せ', '深呼吸しよう']
};

async function setup() {
    logger.info('🚀 Starting Spreadsheet Auto-Setup v2...');

    const initialized = await googleSheetService.init();
    if (!initialized) {
        logger.error('❌ Could not connect to Google Sheets. Check your .env credentials.');
        process.exit(1);
    }

    for (const [title, headers] of Object.entries(SCHEMA)) {
        try {
            await googleSheetService.ensureSheet(title, headers);
            logger.info(`✅ Sheet "${title}" is ready.`);
        } catch (e) {
            logger.error(`❌ Failed to setup sheet "${title}":`, e.message);
        }
    }

    // Populate Dictionaries if empty
    try {
        const dictRows = await googleSheetService.getRows('dictionaries');
        if (dictRows.length === 0) {
            logger.info('Populating default dictionary data...');
            const maxLength = Math.max(...Object.values(DEFAULT_DICTIONARY).map(a => a.length));

            for (let i = 0; i < maxLength; i++) {
                const row = {};
                for (const key of SCHEMA.dictionaries) {
                    row[key] = DEFAULT_DICTIONARY[key][i] || '';
                }
                if (Object.values(row).some(v => v !== '')) {
                    await googleSheetService.addRow('dictionaries', row);
                }
            }
            logger.info('✅ Default dictionary populated.');
        }
    } catch (e) {
        logger.warn('Could not populate default dictionary:', e.message);
    }

    logger.info('✨ Spreadsheet Setup Complete!');
    process.exit(0);
}

setup();
