const logger = require('../utils/logger');

/**
 * 投稿内容に基づいて、事前に準備された画像・動画を選択するサービス
 * (将来のメディア添付機能の土台)
 */
class MediaMappingService {
    constructor() {
        // 設定: カテゴリごとのキーワードとメディアファイルの対応表
        // ※ファイルパスは準備ができ次第、ここに追加してください
        this.mapping = {
            pollen: {
                keywords: ['花粉', '鼻水', '目', '痒', '予報', '杉', 'ヒノキ'],
                video: '/assets/media/pollen_demo.mp4',
                image: '/assets/media/pollen_chart.jpg'
            },
            printer: {
                keywords: ['3Dプリンタ', '造形', 'ABS', '樹脂', 'レジン', '有害', 'VOC'],
                video: '/assets/media/3d_print_demo.mp4',
                image: '/assets/media/3d_print_tech.jpg'
            },
            pet: {
                keywords: ['ペット', '犬', '猫', 'ニオイ', '脱臭', 'わんちゃん', 'ねこちゃん'],
                video: '/assets/media/pet_odor_demo.mp4',
                image: '/assets/media/pet_living.jpg'
            },
            dental: {
                keywords: ['歯科', '歯医者', '診療室', 'ユニット', '歯', '感染対策'],
                video: '/assets/media/dental_clinic.mp4',
                image: '/assets/media/dental_airflow.jpg'
            }
        };
    }

    /**
     * テキスト内容から最適なメディアファイルを決定する
     * @param {string} text 投稿内容
     * @param {string} date 特定の日の切り替え用（例：偶数日は動画、奇数日は画像）
     * @returns {Object|null} { filePath, type: 'video'|'image' }
     */
    getMediaForText(text, date = new Date()) {
        const category = this._detectCategory(text);
        if (!category) return null;

        const config = this.mapping[category];

        // 判定ロジック例: 日付が偶数なら動画、奇数なら画像 (交互に出す)
        const isEvenDay = date.getDate() % 2 === 0;
        const filePath = isEvenDay ? config.video : config.image;
        const type = isEvenDay ? 'video' : 'image';

        logger.info(`[MEDIA] Auto-selected ${type} for category: ${category}`);

        return { filePath, type };
    }

    _detectCategory(text) {
        for (const [key, config] of Object.entries(this.mapping)) {
            if (config.keywords.some(kw => text.includes(kw))) {
                return key;
            }
        }
        return null;
    }
}

module.exports = new MediaMappingService();
