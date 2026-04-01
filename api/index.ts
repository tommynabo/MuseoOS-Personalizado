// SINGLE FILE API - All code inline to avoid Vercel ESM resolution issues
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { ApifyClient } from 'apify-client';
import OpenAI from 'openai';

// ===== CONFIGURATION =====
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ===== CLIENTS =====
// Initialize safely to prevent 500 startup crashes if env vars are missing
const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    : null;

const apifyClient = APIFY_TOKEN ? new ApifyClient({ token: APIFY_TOKEN }) : null;

const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

const getSupabaseUserClient = (accessToken: string) => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("Supabase not configured on server");
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
};

// ===== EXPRESS APP =====
const app = express();
app.use(cors());
app.use(express.json());

// Environment validation - Using Pablo defaults if variables are missing
const { DB_TABLE_PROFILES, DB_TABLE_POSTS, DB_TABLE_CREATORS } = process.env;
if (!DB_TABLE_PROFILES || !DB_TABLE_POSTS || !DB_TABLE_CREATORS) {
    console.warn('⚠️ Note: Database table environment variables are missing. Using Pablo defaults.');
}

// ===== AUTH MIDDLEWARE =====
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Invalid token format' });
    (req as any).token = token;
    next();
};

const getUserSupabase = (req: Request) => getSupabaseUserClient((req as any).token);

// ===== INTERFACES =====
interface ApifyPost {
    [key: string]: any; // Allow any field from Apify — actors vary widely
    id?: string;
    url?: string;
    postUrl?: string;
    linkedinUrl?: string;
    text?: string;
    postText?: string;
    content?: string;
    description?: string;
    body?: string;
    author?: { name?: string };
    // All known engagement field variants across Apify actors
    likesCount?: number;
    commentsCount?: number;
    sharesCount?: number;
    likesNumber?: number;
    commentsNumber?: number;
    sharesNumber?: number;
    numLikes?: number;
    numComments?: number;
    numShares?: number;
    reactionCount?: number;
    commentCount?: number;
    shareCount?: number;
    totalReactionCount?: number;
}

// ===== HELPER FUNCTIONS =====
function extractPostText(post: ApifyPost): string {
    const raw = post.text ?? post.postText ?? post.content ?? post.body ?? post.description ?? '';
    const text = (typeof raw === 'string' ? raw : String(raw)).trim().substring(0, 1500);
    return text;
}

function getMetric(post: ApifyPost, metric: 'likes' | 'comments' | 'shares'): number {
    switch (metric) {
        case 'likes':
            return post.likesCount ?? post.likesNumber ?? post.numLikes ?? post.reactionCount ?? post.totalReactionCount ?? 0;
        case 'comments':
            return post.commentsCount ?? post.commentsNumber ?? post.numComments ?? post.commentCount ?? 0;
        case 'shares':
            return post.sharesCount ?? post.sharesNumber ?? post.numShares ?? post.shareCount ?? 0;
    }
}

function filterSensitiveData(text: string): string {
    // Remove phone numbers (various formats)
    let filtered = text.replace(/(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, '[TELÉFONO]');
    // Remove WhatsApp numbers
    filtered = filtered.replace(/\(?WhatsApp\)?[\s]?[\d\s\-\(\)]+/gi, '[WHATSAPP]');
    // Remove email addresses
    filtered = filtered.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[EMAIL]');
    // Remove URLs
    filtered = filtered.replace(/https?:\/\/[^\s]+|www\.[^\s]+/gi, '[WEBSITE]');
    // Remove physical addresses
    filtered = filtered.replace(/(?:Rua|Avenida|Av\.|Calle|Street|Rua|Rute|nº|Número|Loja|Edifício|Moçambique|Portugal|Brasil|España|México|Argentina)\s+[^\.]*\.?/gi, (match) => {
        if (/\d/.test(match)) return '[DIRECCIÓN]';
        return match;
    });
    // Remove geographic coordinates
    filtered = filtered.replace(/📍\s*[^[\n]*/gi, '[UBICACIÓN]');
    filtered = filtered.replace(/Maputo|Lisboa|Porto|Rio de Janeiro|São Paulo/gi, '[CIUDAD]');
    return filtered.trim();
}

// ===== APIFY FUNCTIONS =====
async function searchLinkedInPosts(keywords: string[], maxPosts = 5): Promise<ApifyPost[]> {
    if (!apifyClient) { console.error("Apify token missing"); return []; }
    try {
        const run = await apifyClient.actor("buIWk2uOUzTmcLsuB").call({
            maxPosts, maxReactions: 0, scrapeComments: false, scrapeReactions: false,
            searchQueries: keywords, sortBy: "relevance"
        });
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        return items as ApifyPost[];
    } catch (error) {
        console.error("Apify Search Error:", error);
        return [];
    }
}

async function getCreatorPosts(profileUrls: string[], maxPosts = 3): Promise<ApifyPost[]> {
    if (!apifyClient) { console.error("Apify token missing"); return []; }
    try {
        const run = await apifyClient.actor("A3cAPGpwBEG8RJwse").call({
            includeQuotePosts: true, includeReposts: true, maxComments: 5, maxPosts,
            maxReactions: 1, postedLimit: "week", scrapeComments: true, scrapeReactions: true,
            targetUrls: profileUrls
        });
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        return items as ApifyPost[];
    } catch (error) {
        console.error("Apify Creator Posts Error:", error);
        return [];
    }
}

// ===== OPTIMIZED AI FUNCTIONS =====

// 1. QUERY EXPANSION
async function expandSearchQuery(topic: string): Promise<string[]> {
    if (!openai) return [topic];
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "system", content: "Eres un experto en boolean search." },
            { role: "user", content: `Transforma "${topic}" en 3 búsquedas booleanas para LinkedIn (JSON: {queries: []}).` }],
            response_format: { type: "json_object" }
        });
        const result = JSON.parse(response.choices[0].message.content || '{"queries": []}');
        const queries = Array.isArray(result.queries) ? result.queries : [topic];
        // Ensure all items are strings to prevent "q.trim is not a function" error in Apify
        return queries.filter((q: any) => typeof q === 'string' && q.trim().length > 0);
    } catch (e) { return [topic]; }
}

// 2. RELATIVE VIRALITY SCORING
async function evaluatePostEngagement(posts: ApifyPost[]): Promise<ApifyPost[]> {
    if (posts.length === 0) return [];
    if (!openai) return posts.slice(0, 5); // Fallback: return top posts if AI not available

    // Low floor to ensure we have candidates
    const meaningfulPosts = posts.filter(p => {
        const len = extractPostText(p).length;
        if (len < 50) return false; // Skip empty posts
        // Relaxed metric floor: even 1 like might be enough if it has comments?
        // Let's rely on ratio mostly, but ensure at least SOME engagement or it's dead
        const likes = getMetric(p, 'likes');
        const comments = getMetric(p, 'comments');
        return (likes + comments) > 2;
    });

    if (meaningfulPosts.length === 0) return posts.slice(0, 3); // Fallback to raw if logic filtered all

    const postsData = meaningfulPosts.slice(0, 15).map((p, idx) => ({
        index: idx,
        text: extractPostText(p).substring(0, 200),
        metrics: {
            likes: getMetric(p, 'likes'),
            comments: getMetric(p, 'comments'),
            shares: getMetric(p, 'shares'),
            ratio: getMetric(p, 'comments') / (getMetric(p, 'likes') || 1)
        }
    }));

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Select top 3 hidden gems based on engagement ratios." },
                { role: "user", content: JSON.stringify(postsData) }
            ],
            response_format: { type: "json_object" }
        });
        const result = JSON.parse(response.choices[0].message.content || '{"indices": []}');
        const indices = result.indices || result.high_engagement_indices || [];

        if (indices.length === 0) throw new Error("No AI selection");

        return indices.map((i: number) => meaningfulPosts[i]).filter(Boolean);
    } catch (error) {
        // Fallback: Sort by comments/likes ratio
        return meaningfulPosts.sort((a, b) => {
            const ratioA = getMetric(a, 'comments') / (getMetric(a, 'likes') || 1);
            const ratioB = getMetric(b, 'comments') / (getMetric(b, 'likes') || 1);
            return ratioB - ratioA;
        }).slice(0, 5);
    }
}

// 3. DEEP STRUCTURAL ANALYSIS (The Architect)
async function extractPostStructure(content: string): Promise<string> {
    if (!openai) return '{}';
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Eres un analista experto en viralidad de LinkedIn con 15 años de experiencia estudiando qué hace que un post explote en engagement. Tu trabajo es hacer un REVERSE ENGINEERING profundo del post proporcionado.

Devuelve un JSON con este análisis exhaustivo:

{
  "hook": {
    "type": "pregunta_provocadora | dato_impactante | historia_personal | afirmacion_polemica | contradiccion | confesion",
    "text": "El hook exacto del post",
    "effectiveness": 1-10,
    "why_it_works": "Explicación psicológica de por qué este hook captura atención"
  },
  "narrative_arc": {
    "structure": "problema-solucion | historia-leccion | mito-realidad | lista-valor | antes-despues | confesion-aprendizaje",
    "phases": ["Fase 1: ...", "Fase 2: ...", "Fase 3: ..."],
    "turning_point": "El momento exacto donde el post cambia de dirección y captura al lector"
  },
  "emotional_triggers": {
    "primary_emotion": "curiosidad | miedo | aspiracion | indignacion | sorpresa | nostalgia | orgullo",
    "secondary_emotions": ["..."],
    "emotional_journey": "Descripción del viaje emocional del lector desde el inicio hasta el final"
  },
  "persuasion_techniques": {
    "techniques_used": [
      {"name": "Nombre de la técnica", "example": "Línea exacta donde se usa", "impact": "Por qué funciona"}
    ],
    "social_proof": "Cómo usa prueba social (si aplica)",
    "authority_signals": "Señales de autoridad detectadas"
  },
  "engagement_mechanics": {
    "why_people_comment": "La razón principal por la que la gente comenta en este post",
    "debate_potential": 1-10,
    "shareability": 1-10,
    "save_worthy": 1-10,
    "call_to_action": "CTA detectado (implícito o explícito)"
  },
  "structural_blueprint": {
    "total_lines": "Número aproximado de líneas",
    "line_length_pattern": "cortas_impactantes | mixtas | largas_narrativas",
    "use_of_whitespace": "agresivo | moderado | compacto",
    "formatting": ["emojis", "bullets", "numeros", "mayusculas", "etc"],
    "rhythm": "Descripción del ritmo del post (rápido/lento, staccato/fluido)"
  },
  "virality_score": {
    "overall": 1-10,
    "originality": 1-10,
    "relatability": 1-10,
    "actionability": 1-10,
    "controversy": 1-10,
    "verdict": "Resumen en 1 frase de por qué este post funciona (o no)"
  },
  "replication_strategy": "Instrucciones específicas de 3-5 pasos para replicar este estilo en un nuevo tema"
}`
                },
                { role: "user", content: content }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
        });
        return response.choices[0].message.content || '{}';
    } catch (err) {
        console.error('[AI] Structure extraction error:', err);
        return '{}';
    }
}

// 4. PROFESSIONAL GHOSTWRITER REWRITE (The Creator)
async function regeneratePost(structure: string, original: string, instructions: string): Promise<string> {
    if (!openai) return original;

    // Parse structure for strategic rewriting
    let structureObj: any = {};
    try { structureObj = JSON.parse(structure); } catch { }

    const hookType = structureObj?.hook?.type || 'historia_personal';
    const narrativeArc = structureObj?.narrative_arc?.structure || 'problema-solucion';
    const blueprint = structureObj?.structural_blueprint || {};
    const replicationStrategy = structureObj?.replication_strategy || '';

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `Eres un Ghostwriter de élite para LinkedIn con experiencia escribiendo para CEOs, founders y líderes de opinión. Tu contenido genera consistentemente +500 likes y +50 comentarios.

## TU MISIÓN
Crear un post COMPLETAMENTE NUEVO inspirado en la ESTRUCTURA y PSICOLOGÍA del post original, pero con contenido 100% original y adaptado a la voz del creador.

## REGLAS ABSOLUTAS
1. NUNCA copies frases del original. Inspírate en la estructura, no en las palabras.
2. El post debe sentirse auténtico, como si lo escribiera una persona real con experiencia.
3. Usa el mismo TIPO DE HOOK detectado: "${hookType}"
4. Sigue el mismo ARCO NARRATIVO: "${narrativeArc}"
5. Mantén el mismo RITMO: ${blueprint.rhythm || 'mixto'} 
6. Usa espaciado ${blueprint.use_of_whitespace || 'moderado'} entre líneas
7. El post debe ser en ESPAÑOL (España/Latinoamérica profesional)
8. Longitud similar al original (~${blueprint.total_lines || '10-15'} líneas)

## ESTRATEGIA DE REPLICACIÓN
${replicationStrategy}

## INSTRUCCIONES DEL CREADOR
${instructions || 'Escribe como un profesional con autoridad pero cercanía. Tono confiado pero humilde.'}

## FORMATO DE SALIDA
Escribe SOLO el post listo para publicar en LinkedIn. Sin comillas, sin explicaciones, sin "Aquí tienes". Solo el post.`
                },
                {
                    role: "user",
                    content: `ANÁLISIS ESTRUCTURAL DEL POST ORIGINAL:
${structure}

CONTENIDO ORIGINAL (referencia, NO copiar):
${original.substring(0, 800)}

Genera un post NUEVO que replique la PSICOLOGÍA y ESTRUCTURA viral detectada, pero con contenido completamente original y profesional.`
                }
            ],
            temperature: 0.8,
            max_tokens: 1500
        });
        return response.choices[0].message.content || '';
    } catch (err) {
        console.error('[AI] Rewrite error:', err);
        return original;
    }
}


// ===== ROUTER =====
const router = express.Router();

router.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ===== CRON / AUTOPILOT ENDPOINT =====
// Called by Vercel Cron (hourly) or manually via ?run_all=true
router.get('/cron', async (req: Request, res: Response) => {
    const runAll = req.query.run_all === 'true';

    try {
        if (!supabaseAdmin) {
            return res.status(503).json({ error: 'Supabase not configured' });
        }

        console.log('[Cron] Checking for due schedules...');
        const now = new Date();

        // 1. Fetch all ENABLED schedules
        const TABLE_SCHEDULES = process.env.DB_TABLE_SCHEDULES || 'schedules_pablo';
        const TABLE_EXECUTIONS = process.env.DB_TABLE_EXECUTIONS || 'schedule_executions_pablo';
        const TABLE_PROFILES_CRON = process.env.DB_TABLE_PROFILES || 'profiles_pablo';
        const TABLE_CREATORS_CRON = process.env.DB_TABLE_CREATORS || 'creators_pablo';
        const TABLE_POSTS_CRON = process.env.DB_TABLE_POSTS || 'posts_pablo';

        const { data: schedules, error: schedErr } = await supabaseAdmin
            .from(TABLE_SCHEDULES)
            .select('*')
            .eq('enabled', true);

        if (schedErr) throw schedErr;
        if (!schedules || schedules.length === 0) {
            return res.json({ success: true, message: 'No active schedules found', results: [] });
        }

        // 2. Filter schedules that are due NOW (in user's timezone)
        const dueSchedules = schedules.filter(schedule => {
            if (runAll) return true;
            try {
                const tz = schedule.timezone || 'Europe/Madrid';
                const userTime = now.toLocaleTimeString('en-GB', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' });
                const [userHour] = userTime.split(':').map(Number);
                const [schedHour] = schedule.time.split(':').map(Number);
                return userHour >= schedHour;
            } catch { return false; }
        });

        console.log(`[Cron] ${dueSchedules.length} due out of ${schedules.length} total`);
        const results: any[] = [];

        // 3. Execute workflow for each due schedule
        for (const schedule of dueSchedules) {
            // Skip if already executed today
            const lastExec = schedule.last_execution ? new Date(schedule.last_execution) : null;
            const alreadyToday = lastExec &&
                lastExec.getDate() === now.getDate() &&
                lastExec.getMonth() === now.getMonth() &&
                lastExec.getFullYear() === now.getFullYear();

            if (alreadyToday && !runAll) {
                console.log(`[Cron] Skipping ${schedule.id} (already ran today)`);
                continue;
            }

            console.log(`[Cron] Running for user ${schedule.user_id}, source=${schedule.source}, count=${schedule.count}`);

            try {
                // Get user profile
                const { data: profile } = await supabaseAdmin
                    .from(TABLE_PROFILES_CRON).select('*').eq('id', schedule.user_id).single();
                if (!profile) { throw new Error('Profile not found'); }

                const keywords: string[] = profile.niche_keywords || [];
                const customInstructions = profile.custom_instructions || '';
                const targetCount = schedule.count || 100; // Removed limits

                // Prepare queries
                let searchQueries: string[] = [];
                let creatorUrls: string[] = [];

                if (schedule.source === 'keywords') {
                    if (keywords.length === 0) throw new Error('No keywords configured');
                    const activeKW = keywords.slice(0, 3);
                    const expandedLists = await Promise.all(activeKW.map((k: string) => expandSearchQuery(k)));
                    const rawQ = [...new Set([...activeKW, ...expandedLists.flat()])];
                    searchQueries = rawQ.filter(q => typeof q === 'string' && q.trim().length > 0).slice(0, 3);
                } else {
                    const { data: creators } = await supabaseAdmin
                        .from(TABLE_CREATORS_CRON).select('linkedin_url').eq('user_id', schedule.user_id);
                    creatorUrls = (creators || [])
                        .map((c: any) => c.linkedin_url)
                        .filter((u: any) => typeof u === 'string' && u.trim().length > 0)
                        .slice(0, 5);
                    if (creatorUrls.length === 0) throw new Error('No creators configured');
                }

                // Fetch posts
                let rawPosts: ApifyPost[] = [];
                if (schedule.source === 'keywords') {
                    const fetched = await Promise.all(searchQueries.map(q => searchLinkedInPosts([q], targetCount * 2)));
                    rawPosts = fetched.flat();
                } else {
                    rawPosts = await getCreatorPosts(creatorUrls, targetCount * 2);
                }

                if (rawPosts.length === 0) throw new Error('No posts found from sources');

                // Evaluate best posts
                const bestPosts = await evaluatePostEngagement(rawPosts);
                const toProcess = bestPosts.slice(0, targetCount).filter(p => extractPostText(p).length >= 30);

                if (toProcess.length === 0) throw new Error('All posts filtered out (too short/low quality)');

                // Generate in parallel (same pipeline as manual generator)
                let savedCount = 0;
                const genResults = await Promise.allSettled(toProcess.map(async (post) => {
                    const postText = extractPostText(post);
                    const filtered = filterSensitiveData(postText);
                    const structure = await extractPostStructure(filtered);
                    const rewritten = await regeneratePost(structure, filtered, customInstructions);
                    if (!rewritten || rewritten.length < 20) throw new Error('Rewrite too short');

                    let analysisObj: any = {};
                    try { analysisObj = JSON.parse(structure); } catch { }
                    const postUrl = post.linkedinUrl || post.url || post.postUrl || post.socialUrl || '';

                    const { error: insertErr } = await supabaseAdmin!
                        .from(TABLE_POSTS_CRON).insert({
                            user_id: schedule.user_id,
                            original_post_id: post.id || 'unknown',
                            original_url: postUrl,
                            original_author: post.author?.name || post.authorName || 'Unknown',
                            original_content: postText,
                            generated_content: rewritten,
                            type: schedule.source === 'keywords' ? 'research' : 'parasite',
                            status: 'idea',
                            meta: {
                                structure: analysisObj,
                                original_url: postUrl,
                                engagement: { likes: getMetric(post, 'likes'), comments: getMetric(post, 'comments') },
                                ai_analysis: {
                                    hook: analysisObj.hook || null,
                                    narrative_arc: analysisObj.narrative_arc || null,
                                    emotional_triggers: analysisObj.emotional_triggers || null,
                                    virality_score: analysisObj.virality_score || null,
                                    structural_blueprint: analysisObj.structural_blueprint || null,
                                    replication_strategy: analysisObj.replication_strategy || null
                                },
                                generated_by: 'autopilot'
                            }
                        });
                    if (insertErr) throw new Error(`DB insert: ${insertErr.message}`);
                    return true;
                }));

                savedCount = genResults.filter(r => r.status === 'fulfilled').length;
                console.log(`[Cron] User ${schedule.user_id}: ${savedCount}/${toProcess.length} posts generated`);

                // Log execution
                await supabaseAdmin.from(TABLE_EXECUTIONS).insert({
                    schedule_id: schedule.id, user_id: schedule.user_id,
                    executed_at: now, status: savedCount > 0 ? 'success' : 'failed',
                    posts_generated: savedCount
                });

                // Update last_execution
                await supabaseAdmin.from(TABLE_SCHEDULES)
                    .update({ last_execution: now }).eq('id', schedule.id);

                results.push({ user: schedule.user_id, success: true, posts: savedCount });

            } catch (userErr: any) {
                console.error(`[Cron] Error for user ${schedule.user_id}:`, userErr.message);
                try {
                    await supabaseAdmin!.from(TABLE_EXECUTIONS).insert({
                        schedule_id: schedule.id, user_id: schedule.user_id,
                        executed_at: now, status: 'failed', posts_generated: 0,
                        error_message: userErr.message
                    });
                } catch (_) { /* ignore logging error */ }
                results.push({ user: schedule.user_id, success: false, error: userErr.message });
            }
        }

        res.json({ success: true, message: `Processed ${results.length} schedules`, results });
    } catch (error: any) {
        console.error('[Cron] Fatal error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/creators', requireAuth, async (req, res) => {
    const supabase = getUserSupabase(req);
    const { data, error } = await supabase.from(process.env.DB_TABLE_CREATORS || 'creators_pablo').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/creators', requireAuth, async (req, res) => {
    const { name, linkedinUrl, headline } = req.body;
    const supabase = getUserSupabase(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase.from(process.env.DB_TABLE_CREATORS || 'creators_pablo')
        .insert({ user_id: user.id, name, linkedin_url: linkedinUrl, headline })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/creators/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const supabase = getUserSupabase(req);
    const { error } = await supabase.from(process.env.DB_TABLE_CREATORS || 'creators_pablo').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ status: 'deleted' });
});

router.get('/posts', requireAuth, async (req, res) => {
    const supabase = getUserSupabase(req);
    const { data, error } = await supabase.from(process.env.DB_TABLE_POSTS || 'posts_pablo').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.patch('/posts/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status, generated_content, meta } = req.body;
    const supabase = getUserSupabase(req);

    const updateData: any = {};
    if (status) updateData.status = status;
    if (generated_content) updateData.generated_content = generated_content;
    if (meta) updateData.meta = meta;
    updateData.updated_at = new Date();

    const { data, error } = await supabase.from(process.env.DB_TABLE_POSTS || 'posts_pablo')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/posts/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const supabase = getUserSupabase(req);
    const { error } = await supabase.from(process.env.DB_TABLE_POSTS || 'posts_pablo').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Post deleted successfully" });
});

router.post('/rewrite', requireAuth, async (req, res) => {
    const { text, profile, instruction } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    if (!openai) return res.status(503).json({ error: "OpenAI not configured" });

    // ... logic for rewrite ...
    // Simplified inline rewrite logic to avoid huge file size
    const tone = profile?.custom_instructions || "profesional";
    const prompt = `Reescribe: ${text} \n Instrucción: ${instruction} \n Tono: ${tone}`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", messages: [{ role: "user", content: prompt }]
        });
        res.json({ result: response.choices[0].message.content });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ===== WORKFLOW LOGIC (EXTRACTED) =====
async function executeWorkflowGenerate(req: Request, res: Response) {
    req.setTimeout(60000); // 60s timeout
    const { source, count = 1 } = req.body;
    const supabase = getUserSupabase(req);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const MAX_ROUNDS = 10;        // Max 10 rounds to allow longer processing
    const BUFFER_MULTIPLIER = 2; // Fetch 2× more than needed from Apify
    const targetCount = count || 100; // Removed limit

    try {
        const { data: profile } = await supabase.from(process.env.DB_TABLE_PROFILES || 'profiles_pablo').select('*').single();
        if (!profile) return res.status(400).json({ error: "Config needed." });

        const keywords = profile.niche_keywords || [];
        const customInstructions = profile.custom_instructions || '';

        console.log('[WORKFLOW] Starting. Source:', source, 'Target:', targetCount, 'Keywords:', keywords);

        // Prepare search queries (only once, reused across rounds)
        let searchQueries: string[] = [];
        let creatorUrls: string[] = [];

        if (source === 'keywords') {
            if (keywords.length === 0) return res.status(400).json({ error: "No keywords." });
            const activeKeywords = keywords.slice(0, 3); // Use top 3 keywords
            console.log('[WORKFLOW] Active keywords:', activeKeywords);
            const expandedLists = await Promise.all(activeKeywords.map((k: string) => expandSearchQuery(k)));
            console.log('[WORKFLOW] Expanded queries:', expandedLists);
            const rawQueries = [...new Set([...activeKeywords, ...expandedLists.flat()])];
            searchQueries = rawQueries.filter(q => typeof q === 'string' && q.trim().length > 0).slice(0, 3); // Max 3 queries to avoid Vercel timeout
            console.log('[WORKFLOW] Final search queries:', searchQueries);
        } else {
            const { data: creators } = await supabase.from(process.env.DB_TABLE_CREATORS || 'creators_pablo').select('linkedin_url');
            if (!creators?.length) return res.status(400).json({ error: "No creators." });
            creatorUrls = creators
                .map((c: any) => c.linkedin_url)
                .filter((u: any) => typeof u === 'string' && u.trim().length > 0)
                .slice(0, 5);
            if (creatorUrls.length === 0) return res.status(400).json({ error: "No valid creator URLs." });
        }

        // ===== SMART BUFFER LOOP =====
        const savedResults: any[] = [];
        const processedPostIds = new Set<string>(); // Deduplicate across rounds

        for (let round = 0; round < MAX_ROUNDS; round++) {
            const remaining = targetCount - savedResults.length;
            if (remaining <= 0) break; // Target met! 🎯

            const postsPerQuery = Math.min(5, Math.max(2, remaining * BUFFER_MULTIPLIER)); // Cap at 5 posts per query to stay fast
            console.log(`[WORKFLOW] Round ${round + 1}/${MAX_ROUNDS}: need ${remaining} more, fetching ${postsPerQuery} per query (${searchQueries.length || creatorUrls.length} queries)`);

            // 1. FETCH (buffer)
            let roundPosts: ApifyPost[] = [];
            if (source === 'keywords') {
                const results = await Promise.all(
                    searchQueries.map(q => searchLinkedInPosts([q], postsPerQuery))
                );
                roundPosts = results.flat();
            } else {
                roundPosts = await getCreatorPosts(creatorUrls, postsPerQuery);
            }

            // Deduplicate against already-processed posts
            const newPosts = roundPosts.filter(p => {
                const postId = p.id || p.url || extractPostText(p).substring(0, 50);
                if (processedPostIds.has(postId)) return false;
                processedPostIds.add(postId);
                return true;
            });

            console.log(`[WORKFLOW] Round ${round + 1}: ${roundPosts.length} fetched, ${newPosts.length} new (after dedup)`);

            if (newPosts.length === 0) {
                console.log(`[WORKFLOW] Round ${round + 1}: No new posts available. Stopping.`);
                break; // No more unique posts to process
            }

            // Log sample post for diagnostics
            if (round === 0 && newPosts.length > 0) {
                const sample = newPosts[0];
                console.log('[WORKFLOW] Sample post keys:', Object.keys(sample));
                console.log('[WORKFLOW] Sample metrics:', {
                    likes: getMetric(sample, 'likes'),
                    comments: getMetric(sample, 'comments'),
                    textLen: extractPostText(sample).length
                });
            }

            // 2. EVALUATE (filter the buffer)
            const bestPosts = await evaluatePostEngagement(newPosts);
            console.log(`[WORKFLOW] Round ${round + 1}: ${bestPosts.length} posts survived evaluation`);

            if (bestPosts.length === 0) {
                console.log(`[WORKFLOW] Round ${round + 1}: All filtered out. Trying next round.`);
                continue; // Try next round with more posts
            }

            // 3. GENERATE IN PARALLEL (process all posts simultaneously for speed)
            const toProcess = bestPosts.slice(0, remaining);
            const validPosts = toProcess.filter(post => {
                const text = extractPostText(post);
                if (!text || text.length < 30) {
                    console.log(`[WORKFLOW] Skipping post (text too short: ${text?.length})`);
                    return false;
                }
                return true;
            });

            console.log(`[WORKFLOW] Processing ${validPosts.length} posts in PARALLEL...`);
            const results = await Promise.allSettled(validPosts.map(async (post) => {
                const postText = extractPostText(post);
                const filtered = filterSensitiveData(postText);
                const structure = await extractPostStructure(filtered);
                console.log(`[WORKFLOW] ✅ Deep analysis complete for post`);
                const rewritten = await regeneratePost(structure, filtered, customInstructions);

                if (!rewritten || rewritten.length < 20) {
                    throw new Error(`Rewrite too short: ${rewritten?.length}`);
                }

                let analysisObj: any = {};
                try { analysisObj = JSON.parse(structure); } catch { }

                const postUrl = post.linkedinUrl || post.url || post.postUrl || post.socialUrl || '';
                const insertResult = await supabase.from(process.env.DB_TABLE_POSTS || 'posts_pablo').insert({
                    user_id: user.id,
                    original_post_id: post.id || 'unknown',
                    original_url: postUrl,
                    original_author: post.author?.name || post.authorName || 'Unknown',
                    original_content: postText,
                    generated_content: rewritten,
                    type: source === 'keywords' ? 'research' : 'parasite',
                    status: 'idea',
                    meta: {
                        structure: analysisObj,
                        original_url: postUrl,
                        engagement: { likes: getMetric(post, 'likes'), comments: getMetric(post, 'comments') },
                        ai_analysis: {
                            hook: analysisObj.hook || null,
                            narrative_arc: analysisObj.narrative_arc || null,
                            emotional_triggers: analysisObj.emotional_triggers || null,
                            persuasion_techniques: analysisObj.persuasion_techniques || null,
                            engagement_mechanics: analysisObj.engagement_mechanics || null,
                            virality_score: analysisObj.virality_score || null,
                            structural_blueprint: analysisObj.structural_blueprint || null,
                            replication_strategy: analysisObj.replication_strategy || null
                        }
                    }
                });

                if (insertResult.error) {
                    throw new Error(`DB insert error: ${insertResult.error.message}`);
                }

                return {
                    original: postText.substring(0, 100) + '...',
                    generated: rewritten,
                    sourceUrl: postUrl,
                    analysis: {
                        hook: analysisObj.hook || null,
                        virality_score: analysisObj.virality_score || null,
                        narrative_arc: analysisObj.narrative_arc?.structure || null,
                        emotional_triggers: analysisObj.emotional_triggers || null
                    }
                };
            }));

            // Collect successful results
            for (const result of results) {
                if (result.status === 'fulfilled' && savedResults.length < targetCount) {
                    savedResults.push(result.value);
                    console.log(`[WORKFLOW] ✅ Post ${savedResults.length}/${targetCount} saved with deep analysis`);
                } else if (result.status === 'rejected') {
                    console.error(`[WORKFLOW] Error processing post:`, result.reason?.message || result.reason);
                }
            }
        }

        console.log(`[WORKFLOW] Done! ${savedResults.length}/${targetCount} posts generated`);
        res.json({
            status: 'success',
            data: savedResults,
            message: `${savedResults.length} posts generated`,
            postsProcessed: savedResults.length
        });

    } catch (error: any) {
        console.error("[WORKFLOW] FATAL ERROR:", error);
        res.status(500).json({ error: error.message });
    }
}

router.post('/workflow/generate', requireAuth, executeWorkflowGenerate);

// Legacy support - call the shared workflow function
router.post('/workflow/parasite', requireAuth, async (req, res) => {
    req.body.source = 'creators';
    req.body.count = req.body.count || 1;
    return executeWorkflowGenerate(req, res);
});

router.post('/workflow/research', requireAuth, async (req, res) => {
    req.body.source = 'keywords';
    req.body.count = req.body.count || 1;
    return executeWorkflowGenerate(req, res);
});

// ===== SCHEDULE / AUTOPILOT ROUTES =====

// GET - Obtener configuración del schedule del usuario
router.get('/schedule', requireAuth, async (req: any, res) => {
    try {
        const supabase = getUserSupabase(req);
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabaseAdmin!
            .from(process.env.DB_TABLE_SCHEDULES || 'schedules_pablo')
            .select('*')
            .eq('user_id', user.id);

        if (error) throw error;

        const schedule = data && data.length > 0 ? data[0] : null;
        res.json({
            status: 'success',
            schedule
        });
    } catch (error: any) {
        console.error('Error getting schedule:', error);
        res.status(500).json({ error: error.message || 'Failed to get schedule' });
    }
});

// POST - Crear o actualizar schedule
router.post('/schedule', requireAuth, async (req: any, res) => {
    try {
        const supabase = getUserSupabase(req);
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { enabled, time, timezone, source, count } = req.body;

        // Validar inputs
        if (!time || !source || count === undefined) {
            return res.status(400).json({ error: 'Missing required fields: time, source, count' });
        }

        if (!/^\d{2}:\d{2}$/.test(time)) {
            return res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
        }

        if (!['keywords', 'creators'].includes(source)) {
            return res.status(400).json({ error: 'Source must be "keywords" or "creators"' });
        }

        // Check if schedule exists
        const { data: existing } = await supabaseAdmin!
            .from(process.env.DB_TABLE_SCHEDULES || 'schedules_pablo')
            .select('id')
            .eq('user_id', user.id)
            .single();

        const scheduleData = {
            user_id: user.id,
            enabled: enabled !== false,
            time,
            timezone: timezone || 'Europe/Madrid',
            source,
            count: Math.max(1, count)
        };

        let savedSchedule;
        if (existing) {
            // Update existing schedule
            const { data, error } = await supabaseAdmin!
                .from(process.env.DB_TABLE_SCHEDULES || 'schedules_pablo')
                .update(scheduleData)
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            savedSchedule = data;
        } else {
            // Create new schedule
            const { data, error } = await supabaseAdmin!
                .from(process.env.DB_TABLE_SCHEDULES || 'schedules_pablo')
                .insert(scheduleData)
                .select()
                .single();
            if (error) throw error;
            savedSchedule = data;
        }

        res.json({
            status: 'success',
            message: `Schedule ${savedSchedule.enabled ? 'enabled' : 'disabled'}`,
            schedule: savedSchedule
        });
    } catch (error: any) {
        console.error('Error saving schedule:', error);
        res.status(500).json({ error: error.message || 'Failed to save schedule' });
    }
});

// PUT - Toggle schedule on/off
router.put('/schedule/toggle', requireAuth, async (req: any, res) => {
    try {
        const supabase = getUserSupabase(req);
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: schedules, error: fetchError } = await supabaseAdmin!
            .from(process.env.DB_TABLE_SCHEDULES || 'schedules_pablo')
            .select('*')
            .eq('user_id', user.id);

        if (fetchError) throw fetchError;
        if (!schedules || schedules.length === 0) {
            return res.status(404).json({ error: 'No schedule found' });
        }

        const currentSchedule = schedules[0];
        const { data: updated, error: updateError } = await supabaseAdmin!
            .from(process.env.DB_TABLE_SCHEDULES || 'schedules_pablo')
            .update({ enabled: !currentSchedule.enabled })
            .eq('id', currentSchedule.id)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
            status: 'success',
            message: `Schedule ${updated.enabled ? 'enabled' : 'disabled'}`,
            schedule: updated
        });
    } catch (error: any) {
        console.error('Error toggling schedule:', error);
        res.status(500).json({ error: error.message || 'Failed to toggle schedule' });
    }
});

// GET - Obtener historial de ejecuciones del schedule
router.get('/schedule/executions', requireAuth, async (req: any, res) => {
    try {
        const supabase = getUserSupabase(req);
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: executions, error } = await supabaseAdmin!
            .from(process.env.DB_TABLE_EXECUTIONS || 'schedule_executions_pablo')
            .select('*')
            .eq('user_id', user.id)
            .order('executed_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.json({
            status: 'success',
            executions: executions || []
        });
    } catch (error: any) {
        console.error('Error getting executions:', error);
        res.status(500).json({ error: error.message || 'Failed to get executions' });
    }
});

// Mount router on both /api and / to handle Vercel path variations
app.use('/api', router);
app.use('/', router);

// ===== VERCEL HANDLER =====
export default app;

