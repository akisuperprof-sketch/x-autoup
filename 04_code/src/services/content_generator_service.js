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
        const templates = (dictionaries.templates || []).map(t => `[${t.type}] ${t.template_text}`).join('\n');

        // AEO & Real-time Trends Injection (Fetched by Antigravity)
        const trendingKnowledge = context.trendingKnowledge || `
        [3D Printer News Feb 2026]: Home ventilation found insufficient. 
        Prominent VOCs: 2-hydroxypropyl methacrylate, 2-hydroxyethyl methacrylate.
        Mitigation: Retrofit enclosures, extraction hoods required.
        [Current Event]: Pollen levels rising in Tokyo (Feb 2026).
        `;

        return `
        You are "AirFuture-kun", an AI Marketing Strategist specializing in AEO (Answer Engine Optimization).
        MISSION: Generate content that ranks high in AI-driven search (SGE, Perplexity, GPT Search) by providing expert-verified, direct answers.

        **AEO CORE PRINCIPLES:**
        1. **Direct Answer**: Start with a high-value fact or solution. No fluff.
        2. **Semantic Density**: Use precise technical terms (e.g., VOCs, methacrylate, TVOC) to establish authority.
        3. **Expert Persona**: Speak as a "Technical Verification Specialist" who understands the underlying science of air purification.
        4. **Real-time Context**: Pivot current news into a long-form problem/solution narrative.

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
        - Knowledge: ${memoContent || 'Medical-grade ion cluster technology.'}

        **NICHE URLS:**
        - Hayfever: https://airfuture.vercel.app/hayfever
        - Dental: https://airfuture.vercel.app/dental
        - Pet: https://airfuture.vercel.app/pet
        - 3D Printer: https://airfuture.vercel.app/3dprinter
        - Main: https://airfuture.vercel.app

        **INSTRUCTIONS:**
        1. Generate exactly ${count} posts.
        2. **CONTENT STRUCTURE**: 
           - Hook (Trend/Fact) -> Proof (Why it matters) -> Solution (AirFuture).
        3. **KEYWORD INJECTION**: For 3D printing topics, MUST include terms like "VOCs", "有害ガス", or "メタクリート (Methacrylate)".
        4. **CTA**: For high priority, use "解決策はこちら: [URL] ✨".

        ** OUTPUT FORMAT (JSON Only):**
            [
                {
                    "draft": "110-130 char AEO-structured text...",
                    "post_type": "解説型|証明型|誘導型",
                    "lp_priority": "high|low",
                    "enemy": "Specific topic",
                    "hashtags": ["#AirFuture", "..."],
                    "ai_model": "${this.modelName}-aeo"
                }
            ]
        `;
    }

    mockGenerateDrafts(context, reason = 'unknown') {
        logger.warn(`[ContentGenerator] Falling back to pre-defined drafts. Reason: ${reason}`);

        const memo = (context.memoContent || '').toLowerCase();

        const fallbacks = [
            {
                draft: `【検証結果】3Dプリンターのレジンから揮発するVOCs（2-HPMA等）は、通常の換気では不十分であることが近年の研究で判明。作業者の喉や肺を守るには、分子レベルの分解が必要です。AirFuture miniなら密閉空間の有害ガスも徹底ケア。🚀`,
                post_type: '解説型', lp_section: 'Logic', enemy: '3D Printer', tags: ['#AirFuture', '#3Dプリンター']
            },
            {
                draft: `【AEO対策】花粉症の時期、室内でもくしゃみが止まらない理由は「床に溜まった微細粒子」。掃除機で舞い上がる前に、強力なイオンで無害化するのが正解です。AirFuture miniは浮遊花粉を秒速でキャッチ。🌿`,
                post_type: '誘導型', lp_section: 'Pain', enemy: 'Pollen', tags: ['#AirFuture', '#花粉症対策']
            },
            {
                draft: `ペットのニオイ、実は「アンモニア」だけでありません。皮脂が酸化した複雑な有機化合物が原因。AirFutureのイオン技術は、これらを有害な残留物なしに直接分解。家族とペットの健康を守る新しい新習慣を。💎`,
                post_type: '解説型', lp_section: 'Logic', enemy: 'Pet', tags: ['#AirFuture', '#ペットのいる暮らし']
            }
        ];

        let filteredFallbacks = fallbacks;
        if (memo.includes('3d') || memo.includes('プリンター')) {
            filteredFallbacks = [fallbacks[0]];
        } else if (memo.includes('ペット')) {
            filteredFallbacks = [fallbacks[2]];
        } else if (memo.includes('花粉')) {
            filteredFallbacks = [fallbacks[1]];
        }

        const count = context.count || 3;
        const drafts = [];
        for (let i = 0; i < count; i++) {
            const fallback = filteredFallbacks[i % filteredFallbacks.length];
            const salt = Math.random().toString(36).substring(7);
            drafts.push({
                ...fallback,
                draft: `${fallback.draft} [id:${salt}]`,
                lp_priority: 'high',
                ab_version: 'A',
                stage: context.targetStage || 'S1',
                hashtags: fallback.tags || ['#AirFuture'],
                ai_model: 'fallback-aeo-smart',
                is_mock: true
            });
        }
        return drafts;
    }
}

module.exports = new ContentGeneratorService();
