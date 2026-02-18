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
            // Fallback to high-quality mock data for testing flow even if API is down
            return this.mockGenerateDrafts(context, error.message);
        }
    }

    async shortenDraft(originalDraft) {
        if (!this.genAI && env.GEMINI_API_KEY) {
            this.init();
        }
        if (!this.genAI) return originalDraft.substring(0, 140);

        const prompt = `
        Shorten the following Japanese X (Twitter) post to be UNDER 130 characters.
        Preserve the emojis, tone, and main message.
        Original: "${originalDraft}"
        
        Output only the shortened Japanese text.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (e) {
            logger.error('Shorten draft failed', e);
            return originalDraft.substring(0, 140);
        }
    }

    buildPrompt(context, dictionaries, feedback) {
        const { season, trend, count = 3, memoContent, productMentionAllowed = true, targetStage, ctaType = 'profile' } = context;

        const enemyList = (dictionaries.enemies || []).join(', ');
        const tagsList = (dictionaries.tags || []).join(', ');
        const safePhrases = (dictionaries.safe_phrases || []).join(', ');
        const templates = (dictionaries.templates || []).map(t => `[${t.type}] ${t.template_text}`).join('\n');

        const recentSalesCount = feedback.recent_sales_count || 0;
        const salesAllowed = recentSalesCount < 2; // Keep LP conversion balance

        return `
        You are "AirFuture-kun", an advanced LP-Sales Engine from the 48th century.
        MISSION: Maximize CV from X to LP.

        **STRATEGY & TONE:**
        // Tone: Professional yet empathetic. AVOID repeating keywords/phrases from recent posts. Use diverse emotional and scientific expressions.
        // Similarity Guard: Do not use the same start phrases or hooks as previous posts.
        - **Emoji Rule**: STRICTLY MAX 3 Emojis per post.
        - **Character Length**: Target 100 to 115 Japanese characters. Do not be shorter than 100. Aim for high density and depth.
        - **Stage Rotation**: If generating many posts, ensure a mix of S1 (Awareness), S2 (Interest), S3 (Proof), S4 (Action).

        **LP INTEGRATION:**
        - Map each post to an **LP Section**:
          - "Hero": First impression / Dream environment.
          - "Pain": Emulating air pollution suffering.
          - "Logic": Scientific ion breakdown.
          - "Proof": User reviews/satisfaction logic.
          - "CTA": Direct urge to visit LP.
        - A/B Testing: Provide distinct variations (A or B) for comparative analysis.

        **Sales Inhibition (80/20 Rule):**
        - Education focus: 80%. Sales focus: 20%.
        - Current Status: ${salesAllowed ? 'SALES_OK' : 'EDUCATION_ONLY'}.

        **INPUT DATA:**
        - Season: ${season} (IMPORTANT: Use Spring/Pollen phrases. NO Winter phrases.)
        - Current Pollen Level (Tokyo): ${context.tokyoPollen || 'Checking...'}
        - Base Theme: ${targetStage} (S1-S5)
        - Target Enemy: ${enemyList}
        - Knowledge: ${memoContent || 'Medical-grade ion cluster technology.'}
        ${context.isPollenSeason ? 'NOTE: Pollen season is ACTIVE. Focus on relief from sneezing, itchy eyes, and deep purification.' : ''}
        ${context.recentPosts ? `\n**RECENT POSTS (TO AVOID SIMILARITY):**\n${context.recentPosts.map(p => `- ${p.draft}`).join('\n')}` : ''}
        ${templates ? `\n**TEMPLATES:**\n${templates}` : ''}

        **NICHE TARGETING & LP URLS:**
        - High priority/Niche Specific URLs:
          - Topic "Pollen/Hayfever": https://airfuture.vercel.app/hayfever
          - Topic "Dental/Clinic": https://airfuture.vercel.app/dental
          - Topic "Pet/Dog/Cat": https://airfuture.vercel.app/pet
          - Topic "3D Printer/Industrial": https://airfuture.vercel.app/3dprinter
          - Default Main LP: https://airfuture.vercel.app

        **INSTRUCTIONS:**
        1. Generate exactly ${count} posts.
        2. **CHARACTER LIMIT (STRICT)**: Each "draft" MUST be between **100 and 115 Japanese characters** (including hashtags). Do not be shorter than 100.
        3. **HOOK (CRITICAL)**: Start with a compelling first phrase. Use surprising facts, deep empathy, or a bold claim.
        4. **EMOJI LIMIT**: Max 3 emojis per post.
        5. **VARIETY**: Rotate marketing stages (S1, S2, S3, S4) and lp_sections.
        6. **CTA & URL POLICY (CRITICAL)**: 
           - **URL SELECTION**: If the post content matches a specific niche above (e.g., Pet odor), use the corresponding NICHE URL. Otherwise, use the Default Main LP.
           - **PLACEMENT**: For high priority (lp_priority: high), use "詳細は [URL] で✨". For low priority, use "詳細はプロフィールから✨".
           - **STRICT**: Only use the specific URLs listed above. NEVER use /go endpoints or query parameters in post text.
           - No anxiety-inducing words.
        7. **DIVERSITY**: Ensure each of the ${count} posts has a different focus, target audience, or emotional angle.
        8. **POLLEN CONTEXT**: If Pollen Level is '多い' or '非常に多い', use strong empathy about suffering. If '少ない', focus on prevention or the early feel of spring.
        9. No "AI greetings".

        ** OUTPUT FORMAT(JSON Only):**
            [
                {
                    "draft": "100-115 char text starting with a hook...",
                    "post_type": "不安型|解説型|証明型|誘導型",
                    "lp_priority": "high|low",
                    "lp_section": "Hero|Pain|Logic|Proof|CTA",
                    "ab_version": "A",
                    "stage": "S1|S2|S3|S4|S5",
                    "enemy": "Specific topic (e.g. Pet, Pollen, 3D Printer)",
                    "hashtags": ["#AirFuture", "..."],
                    "media_type": "image|none",
                    "media_prompt": "Image generation prompt...",
                    "cta_type": "${ctaType}"
                }
            ]
                `;
    }

    mockGenerateDrafts(context, reason = 'unknown') {
        const isLeaked = reason.includes('403') || reason.includes('API key');
        const prefix = isLeaked ? '【再検証】' : '【AI生成】';
        logger.warn(`[ContentGenerator] Falling back to pre-defined drafts. Reason: ${reason}`);

        const timestamp = new Date().getTime();

        const fallbacks = [
            {
                draft: `${prefix}空気を浄化するだけでなく、心まで整える。AirFuture miniは医療現場も認める高性能イオン技術を搭載。デスク周りを究極の聖域に変えませんか。(${timestamp}-A) ✨ #AirFuture #空気清浄機`,
                post_type: '解説型',
                lp_section: 'Hero',
                enemy: 'Pollution'
            },
            {
                draft: `${prefix}花粉症のあの辛さ、今年はもう終わりにしましょう。AirFuture miniは3000万個のイオンが鼻や目の敵を徹底ブロック。一瞬で呼吸が変わる。(${timestamp}-B) 🌸 #AirFuture #花粉症対策`,
                post_type: '誘導型',
                lp_section: 'Pain',
                enemy: 'Pollen'
            },
            {
                draft: `${prefix}ペットのニオイ、家族は気づかないけれどお客様は気づいています。AirFutureの分解力は、ニオイの元を分子レベルで消し去ります。清潔な暮らしを。(${timestamp}-C) 🐾 #AirFuture #ペットのいる暮らし`,
                post_type: '解説型',
                lp_section: 'Logic',
                enemy: 'Pet'
            },
            {
                draft: `${prefix}3Dプリンターのあの独特なニオイと有害ガス。作業者の健康を守るのは、AirFutureの高度な浄化技術です。クリエイティブな環境に安全を。(${timestamp}-D) 🖨️ #AirFuture #3Dプリンター`,
                post_type: '証明型',
                lp_section: 'Proof',
                enemy: '3D Printer'
            }
        ];

        const count = context.count || 3;
        const drafts = [];
        for (let i = 0; i < count; i++) {
            const fallback = fallbacks[i % fallbacks.length];
            drafts.push({
                ...fallback,
                lp_priority: i % 2 === 0 ? 'high' : 'low',
                ab_version: i % 2 === 0 ? 'A' : 'B',
                stage: context.targetStage || 'S1',
                hashtags: ['#AirFuture'],
                media_type: 'none',
                media_prompt: '',
                cta_type: context.ctaType || 'profile',
                ai_model: isLeaked ? 'leaked-key-mock' : 'fallback-standard'
            });
        }
        return drafts;
    }
}

module.exports = new ContentGeneratorService();
