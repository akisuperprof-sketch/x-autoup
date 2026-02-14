require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const logger = require('../utils/logger');

async function addHowToUseSheet() {
    logger.info('Adding "howtouse" sheet...');

    if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        logger.error('Missing Google Sheets credentials in .env');
        return;
    }

    try {
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        let sheet = doc.sheetsByTitle['howtouse'];
        if (!sheet) {
            sheet = await doc.addSheet({ title: 'howtouse' });
            logger.info('Created new sheet: howtouse');
        } else {
            logger.info('Sheet "howtouse" already exists. Updating content...');
            await sheet.clear(); // Clear existing content to refresh
        }

        // Set headers
        await sheet.setHeaderRow(['Column Name', 'Meaning', 'Usage / Instructions']);

        // Add rows
        const rows = [
            {
                'Column Name': 'id',
                'Meaning': '投稿ID (システム用)',
                'Usage / Instructions': '自動生成されます。変更しないでください。'
            },
            {
                'Column Name': 'draft',
                'Meaning': '投稿本文',
                'Usage / Instructions': 'AIが生成した文章です。自由に編集・修正してください。ここにある内容がそのまま投稿されます。'
            },
            {
                'Column Name': 'stage',
                'Meaning': 'マーケティングステージ (S1-S5)',
                'Usage / Instructions': 'S1:共感, S2:原因, S3:解決, S4:製品, S5:誘導。どの層に向けた投稿かを示します。'
            },
            {
                'Column Name': 'season',
                'Meaning': '季節設定',
                'Usage / Instructions': '生成時の季節（冬、春など）。参考情報です。'
            },
            {
                'Column Name': 'hashtags',
                'Meaning': 'ハッシュタグ',
                'Usage / Instructions': '自動生成されたタグです。JSON形式 ["#tag1", "#tag2"] で保存されていますが、編集可能です。'
            },
            {
                'Column Name': 'status',
                'Meaning': '投稿ステータス',
                'Usage / Instructions': '重要！ここを操作して投稿を管理します。\n- "draft_ai": AI生成直後（投稿されません）\n- "scheduled": 承認済み（指定時間に投稿されます）\n- "posted": 投稿完了\n- "rejected": ボツ（投稿されません）'
            },
            {
                'Column Name': 'scheduled_at',
                'Meaning': '投稿予定日時',
                'Usage / Instructions': 'YYYY/MM/DD HH:mm:ss 形式（日本時間）。この時間を過ぎると自動投稿されます。時間を変更したい場合はここを書き換えてください。'
            },
            {
                'Column Name': 'media_url',
                'Meaning': '画像/動画URL',
                'Usage / Instructions': '画像を添付したい場合、ここに画像のURLを入力します。（現在は機能未実装のため空欄推奨）'
            },
            {
                'Column Name': 'result',
                'Meaning': '投稿結果',
                'Usage / Instructions': '投稿後のAPIレスポンスIDなどが記録されます。'
            },
            {
                'Column Name': 'ai_comment',
                'Meaning': 'AIからのコメント',
                'Usage / Instructions': '生成意図などのメモ欄です。'
            }
        ];

        await sheet.addRows(rows);
        logger.info('Successfully populated "howtouse" sheet.');

    } catch (error) {
        logger.error('Error adding howtouse sheet', error);
    }
}

addHowToUseSheet();
