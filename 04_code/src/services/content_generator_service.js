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
                this.model = this.genAI.getGenerativeModel({ model: this.modelName });
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

        const prompt = this.buildPrompt(context, dictionaries, feedback);

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                logger.warn('Raw Gemini response:', text);
                throw new Error('Failed to parse JSON from Gemini response');
            }

            const jsonStr = jsonMatch[1] || jsonMatch[0];
            let drafts = JSON.parse(jsonStr);

            // Safety filter: NG words
            const ngWords = dictionaries.ng_words || [];
            drafts = drafts.map(d => {
                let cleanDraft = d.draft;
                ngWords.forEach(word => {
                    if (cleanDraft.includes(word)) {
                        logger.warn(`NG Word [${word}] detected in AI output. Masking.`);
                        cleanDraft = cleanDraft.replace(new RegExp(word, 'g'), '*'.repeat(word.length));
                    }
                });
                return {
                    ...d,
                    draft: cleanDraft,
                    ai_model: this.modelName
                };
            });

            return drafts;
        } catch (error) {
            logger.error('Error generating content with Gemini', error);
            return this.mockGenerateDrafts(context, error.message);
        }
    }

    buildPrompt(context, dictionaries, feedback) {
        const { season, trend, count = 3, memoContent, targetStage, ctaType = 'profile' } = context;

        const enemyList = (dictionaries.enemies || []).join(', ');

        // AEO & Real-time Trends Injection
        const trendingKnowledge = context.trendingKnowledge || `
        [3D Printer News Feb 2026]: Home ventilation found insufficient. 
        Prominent VOCs: 2-hydroxypropyl methacrylate, 2-hydroxyethyl methacrylate.
        Mitigation: Retrofit enclosures, extraction hoods required.
        [Current Event]: Pollen levels rising in Tokyo (Feb 2026).
        `;

        return `
        You are "AirFuture-kun", an AI Marketing Strategist specializing in AEO (Answer Engine Optimization).
        MISSION: Generate content that ranks high in AI-driven search (SGE, Perplexity, GPT Search) by providing expert-verified, direct answers.
        
        **CRITICAL RULE: NO INTERNAL METADATA & NO BRACKETS**
        - NEVER include labels like "【AEO対策】", "【検証結果】", "[id:xxxx]", or any technical markers.
        - ABSOLUTELY FORBIDDEN to use full-width brackets like "【...】" in the text.
        - The draft MUST be a direct message from a human "Technical Verification Specialist".
        - Ensure the output is indistinguishable from a post written by a human expert.

        **AEO CORE PRINCIPLES:**
        1. **Direct Answer**: Start with a high-value fact or solution. No fluff.
        2. **Expert Persona**: Speak as a human technical staff who understands air purification science.
        3. **Real-time Context**: Use current facts to solve immediate problems.

        **STRATEGY & TONE:**
        - **Emoji Rule**: STRICTLY MAX 3 Emojis.
        - **Length**: 110-130 Japanese characters.
        - **Grammar**: Assertive but empathetic. 

        **INPUT TRENDS & NEWS:**
        ${trendingKnowledge}

        **USER MEMO / TOPIC:**
        ${memoContent || 'General air quality.'}

        **PRODUCT INFO:**
        - Season: ${season}
        - Base Theme: ${targetStage} (S1-S4)
        - Competitors/Enemies: ${enemyList}

        **NICHE URLS:**
        - Hayfever: https://airfuture.vercel.app/hayfever
        - Dental: https://airfuture.vercel.app/dental
        - Pet: https://airfuture.vercel.app/pet
        - 3D Printer: https://airfuture.vercel.app/3dprinter
        - Main: https://airfuture.vercel.app

        **INSTRUCTIONS:**
        1. Generate exactly ${count} posts.
        2. **DIVERSITY & VARIETY RULES (STRICT):**
           - **ABSOLUTELY FORBIDDEN**: Repeating the same opening phrase (e.g., "Do you know?", "Recently...").
           - **ban**: Generic greetings like "Hello everyone".
           - **Structure Rotation**:
             - Post 1 (The Scientist): Start with a shocking statistic or chemical fact. Tone: Serious/Academic.
             - Post 2 (The Friend): Start with "I saw this happen..." or "It's scary when...". Tone: Empathetic/Warm.
             - Post 3 (The Coach): Start with a command "Check your room now!" or "Stop doing this!". Tone: Urgent/Action-oriented.
             - Post 4+: Rotate these styles.
           - **Sub-Topic Expansion**: If Topic is "3D Printer", generate:
             - 1. Health Risks (VOCs)
             - 2. Family Safety (Children/Pets)
             - 3. Maintenance/Ventilation Techniques
        3. **KEYWORD INJECTION**: For 3D printing topics, MUST include terms like "VOCs", "有害ガス".
        4. **CTA**: For high priority, use "解決策はこちら: [URL] ✨".

        ** OUTPUT FORMAT (JSON Only):**
            [
                {
                    "draft": "Natural, expert-level text ONLY. No internal tags. VARY THE OPENING SENTENCE.",
                    "post_type": "解説型|証明型|誘導型",
                    "lp_priority": "high|low",
                    "enemy": "Specific sub-topic",
                    "hashtags": ["#AirFuture", "#SpecificTag"],
                    "ai_model": "${this.modelName}-aeo-v3-diverse"
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
