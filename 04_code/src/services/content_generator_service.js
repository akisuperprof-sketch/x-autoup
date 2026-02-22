const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../config/env');
const logger = require('../utils/logger');

class ContentGeneratorService {
    constructor() {
        this.modelName = 'gemini-1.5-flash';
        this.init();
    }

    init() {
        if (env.GEMINI_API_KEY && !this.genAI) {
            try {
                this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
                this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
                logger.info(`Gemini initialized with model: ${this.modelName}`);
            } catch (e) {
                logger.error('Failed to initialize Gemini SDK', e);
            }
        } else if (!env.GEMINI_API_KEY) {
            logger.warn('Gemini API key missing. Content generation will be mocked.');
            this.genAI = null;
        }
    }

    async generateDrafts(context, dictionaries = {}, feedback = {}) {
        if (!this.genAI && env.GEMINI_API_KEY) {
            this.init();
        }

        if (!this.genAI) {
            return this.mockGenerateDrafts(context, 'API_KEY_MISSING');
        }

        const prohibitedPrefixes = context.prohibitedPrefixes || [];
        const maxRetries = 3;
        let drafts = [];

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const prompt = this.buildPrompt(context, dictionaries, feedback);
                const result = await this.model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\[[\s\S]*\]/);
                if (!jsonMatch) {
                    logger.warn('Raw Gemini response:', text);
                    throw new Error('Failed to parse JSON from Gemini response');
                }

                const jsonStr = jsonMatch[1] || jsonMatch[0];
                let rawDrafts = JSON.parse(jsonStr);

                // Validation: Uniqueness check against past posts
                const validDrafts = rawDrafts.filter(d => {
                    const prefix = d.draft.substring(0, 10);
                    const isDuplicate = prohibitedPrefixes.some(p => p.startsWith(prefix) || prefix.startsWith(p));
                    if (isDuplicate) {
                        logger.warn(`Duplicate prefix detected: [${prefix}]. Retrying generation...`);
                        return false;
                    }
                    return true;
                });

                if (validDrafts.length === rawDrafts.length) {
                    drafts = validDrafts;
                    break;
                } else if (attempt === maxRetries) {
                    logger.warn(`Could only generate ${validDrafts.length} unique drafts after ${maxRetries} attempts.`);
                    drafts = validDrafts;
                }
            } catch (error) {
                logger.error(`Generation attempt ${attempt} failed`, error);
                if (attempt === maxRetries) return this.mockGenerateDrafts(context, error.message);
            }
        }

        // Safety filter: NG words
        const ngWords = dictionaries.ng_words || [];
        drafts = drafts.map(d => {
            let cleanDraft = d.draft;
            ngWords.forEach(word => {
                const safeWord = word.trim();
                if (safeWord && cleanDraft.includes(safeWord)) {
                    logger.warn(`NG Word [${safeWord}] detected in AI output. Masking.`);
                    cleanDraft = cleanDraft.replace(new RegExp(safeWord, 'g'), '*'.repeat(safeWord.length));
                }
            });
            return {
                ...d,
                draft: cleanDraft,
                ai_model: this.modelName
            };
        });

        return drafts;
    }

    buildPrompt(context, dictionaries, feedback) {
        const { season, trend, count = 3, memoContent, newsTopics = [] } = context;

        // Dynamic Topic Generation to avoid repetition
        const topicCandidates = [
            "目に見えない空気の汚れへの気づき",
            "3Dプリンター使用時の喉の違和感や対策",
            "花粉シーズンの家の中と外のギャップ",
            "小型空気清浄機を置く場所の工夫（卓上、寝室、車中）",
            "子供やペットの視点での空気質へのアプローチ",
            "空気のニオイと感情の結びつき",
            "フィルターがないことのメリット（経済性、ゴミ出し）",
            "朝起きた時のスッキリ感の正体",
            "VOCs（揮発性有機化合物）という言葉を噛み砕く",
            "換気が難しい真冬・真夏の室内環境"
        ];
        // Shuffle and pick
        const selectedTopics = topicCandidates.sort(() => 0.5 - Math.random()).slice(0, 4);

        const trendingKnowledge = newsTopics.length > 0
            ? newsTopics.join('\n')
            : `Season: ${season}, Trend: ${trend}`;

        return `
        **CRITICAL: GENERATE EXACTLY ${count} DRAFTS.**
        You are an "Individual Researcher" who posts unique observations about air and daily life.
        MISSION: NEVER repeat the same pattern. Every post must be a fresh discovery.
        Your goal is to maximize your "Human-likeness Score" (人間っぽさスコア) to avoid being flagged as a bot.

        **CRITICAL: ABSOLUTELY NO DUPLICATES**
        - You must generate ${count} unique perspectives. 
        - DO NOT start with the same logic or same sentences. 
        - Even if you are asked many times, vary your tone, focus point, and sentence structure.

        **STRATEGY FOR UNIQUENESS:**
        1. **RANDOM TOPICS**: Use these as inspiration: 
           - ${selectedTopics.join(', ')}
        2. **REAL-TIME NEWS**: Incorporate or relate to these current news titles if possible:
           ${trendingKnowledge}
        3. **VARY THE HOOK**: 
           - Start with a question.
           - Start with an exclamation.
           - Start with a quiet realization.
           - Start with a specific time of day (2 AM, Sunday morning...).

        **HUMAN-LIKENESS SCORING:**
        - **NON-REGULARITY**: Mix short and long sentences.
        - **STYLISTIC VARIETY**: Use "ですね", "かも", "な気がする", "不思議です".
        - **URL/CTA RATIO**: ONLY include a profile link mention in 50% of the posts (has_cta: true).
        - **CONTENT DIVERSITY**: Mix geeking out on invisible VOCs with ordinary life (drinking coffee, cleaning, working).

        **RULES:**
        - **NO ADVERTISING**: No product names, no hashtags, no sales tone.
        - **LIMIT**: 1 emoji per post MAX. (Sometimes 0).
        - **LEN**: 90-130 Japanese characters.

        **USER MEMO / SPECIFIC THEME (PRIORITY):**
        ${memoContent || 'General air quality/Researcher discovery.'}

        **OUTPUT FORMAT (JSON Only):**
        MUST return valid JSON array containing exactly ${count} objects.
            [
                {
                    "draft": "Unique draft text. MUST NOT duplicate any previous themes or structures.",
                    "has_cta": true|false,
                    "post_type": "気づき型|雑談型|発見型",
                    "lp_priority": "low",
                    "hashtags": [],
                    "ai_model": "gemini-2.0-flash"
                }
            ]
        `;
    }

    mockGenerateDrafts(context, reason = 'unknown') {
        logger.warn(`[ContentGenerator] Falling back to pre-defined drafts. Reason: ${reason}`);

        const memo = (context.memoContent || '').toLowerCase();

        // Expanded mock data with multi-angle variations
        const fallbacks_3d = [
            { draft: "3Dプリンターのレジン臭、実は「慣れ」が一番危険。揮発するVOCsは静かに体に蓄積します。AirFutureの分解技術なら、換気しにくい冬場の作業部屋も安全なアトリエに変えられます。マスクなしで創作に没頭できる環境を。🚀", post_type: "感情型", tags: ["#3Dプリンター"] },
            { draft: "【実験データ】レジン硬化時のPM2.5濃度は、喫煙室並みに達することも。通常の空気清浄機ではフィルターを素通りするガス状汚染物質も、AirFutureのイオンなら分子レベルで狙い撃ち分解します。制作環境の質が、作品の質を変える。🛡️", post_type: "解説型", tags: ["#レジン"] },
            { draft: "家族に「臭い」と言われて3Dプリンターを諦めていませんか？AirFuture miniなら、稼働中もニオイをほぼゼロに抑え込みます。リビングの片隅でも、深夜でも、もう気を使う必要はありません。自宅ファブの必須装備です。🏠", post_type: "解決型", tags: ["#自宅工房"] }
        ];

        const fallbacks_pollen = [
            { draft: "玄関で服を払っても、花粉の40%は室内に侵入しています。重要なのは「床に落ちる前に無力化」すること。AirFutureの高濃度イオンは、空中の花粉を包み込んで重くし、即座に落下＆不活性化させます。今年の春は、家の中だけは別世界に。🌿", post_type: "解説型", tags: ["#花粉対策"] },
            { draft: "「朝起きた瞬間のくしゃみ」が辛いなら、寝室の空気が淀んでいる証拠。AirFuture miniを枕元に置けば、寝ている間に顔の周りの空気を洗浄し続けます。目覚めのスッキリ感が、1日のパフォーマンスを変えます。☀️", post_type: "感情型", tags: ["#モーニングルーティン"] },
            { draft: "空気清浄機のフィルター交換、高くないですか？AirFutureはフィルターレスで経済的。花粉シーズンだけでなく、梅雨のカビ、夏のニオイまで一年中これ一台でOK。ランニングコスト0円で手に入れる、本当の安心。💰", post_type: "解決型", tags: ["#コスパ最強"] }
        ];

        const fallbacks_pet = [
            { draft: "ペットのトイレ臭をごまかす芳香剤は、実は動物の嗅覚にはストレスかも。AirFutureは「香りで上書き」せず「ニオイの元を分解」します。無臭の快適空間は、人間だけでなく、大切な家族であるペットにとっても最高のプレゼント。🐶", post_type: "感情型", tags: ["#犬のいる暮らし"] },
            { draft: "猫のフケや毛によるアレルギー反応。原因はタンパク質です。AirFutureから放出されるイオンは、アレルゲンの作用を抑制する働きがあります。「アレルギーだけど一緒に暮らしたい」その願い、技術でサポートします。🐱", post_type: "解説型", tags: ["#猫アレルギー"] },
            { draft: "来客時に「ウチ、ペット臭う？」と心配する必要はもうありません。AirFuture miniなら、アンモニア臭をわずか30分で激減。小型なのでトイレの横やケージの近くに置いても邪魔になりません。クリアな空気でおもてなしを。✨", post_type: "解決型", tags: ["#ペット消臭"] }
        ];

        let filteredFallbacks = [...fallbacks_3d, ...fallbacks_pollen, ...fallbacks_pet];

        if (memo.includes('3d') || memo.includes('プリンター')) {
            filteredFallbacks = fallbacks_3d;
        } else if (memo.includes('ペット') || memo.includes('犬') || memo.includes('猫')) {
            filteredFallbacks = fallbacks_pet;
        } else if (memo.includes('花粉')) {
            filteredFallbacks = fallbacks_pollen;
        }

        const count = context.count || 3;
        const drafts = [];

        for (let i = 0; i < count; i++) {
            const fallback = filteredFallbacks[i % filteredFallbacks.length];
            // NO VISIBLE SALT. NO BRACKETS.
            // Use Zero Width Spaces (ZWSP) with random entropy for variance
            const zwsp = '\u200B'.repeat(i + 1 + (Date.now() % 10));

            drafts.push({
                ...fallback,
                draft: `${fallback.draft}${zwsp}`.substring(0, 140),
                lp_priority: 'high',
                ab_version: 'A',
                stage: context.targetStage || 'S1',
                hashtags: fallback.tags || ['#AirFuture'],
                ai_model: 'fallback-aeo-final-v5',
                is_mock: true
            });
        }
        return drafts;
    }
}

module.exports = new ContentGeneratorService();
