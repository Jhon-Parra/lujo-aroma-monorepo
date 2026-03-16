import { Request, Response } from 'express';
import OpenAI from 'openai';

import { pool } from '../config/database';

type ProductRow = {
    id: string;
    nombre: string;
    genero: string | null;
    descripcion: string | null;
    notas_olfativas: string | null;
    precio: any;
    stock: any;
    unidades_vendidas: any;
    imagen_url: string | null;
    categoria_nombre?: string | null;
    categoria_slug?: string | null;
};

type RecoItem = {
    id: string;
    rank: number;
    reasons: string[];
    short_explanation: string;
    score?: number;
};

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const openai = new OpenAI({
    apiKey: GROQ_API_KEY || '',
    baseURL: 'https://api.groq.com/openai/v1'
});

let categoriesReady: boolean | null = null;
const detectCategoriesSchema = async (): Promise<boolean> => {
    if (categoriesReady !== null) return categoriesReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) AS ok 
             FROM information_schema.tables 
             WHERE table_schema = DATABASE() 
               AND table_name = 'categorias'`
        );
        categoriesReady = Number(rows?.[0]?.ok || 0) > 0;
        return categoriesReady;
    } catch {
        categoriesReady = false;
        return false;
    }
};

let recoEventsReady: boolean | null = null;
const detectRecoEventsSchema = async (): Promise<boolean> => {
    if (recoEventsReady !== null) return recoEventsReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) AS ok 
             FROM information_schema.tables 
             WHERE table_schema = DATABASE() 
               AND table_name = 'recomendacioneventos'`
        );
        recoEventsReady = Number(rows?.[0]?.ok || 0) > 0;
        return recoEventsReady;
    } catch {
        recoEventsReady = false;
        return false;
    }
};

const normalizeText = (raw: any): string => {
    return String(raw || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const tokenize = (raw: any): string[] => {
    const s = normalizeText(raw);
    if (!s) return [];
    return s.split(' ').filter(Boolean);
};

const unique = (arr: string[]) => Array.from(new Set(arr));

const buildKeywordHintsFromQuiz = (answers: any): string[] => {
    const a = answers || {};
    const hints: string[] = [];

    const aroma = String(a.aroma || '').toLowerCase();
    if (aroma === 'dulce') hints.push('vainilla', 'ambar', 'caramelo', 'gourmand', 'tonka');
    if (aroma === 'fresco') hints.push('fresco', 'limpio', 'acuatico', 'verde', 'aromatico');
    if (aroma === 'amaderado') hints.push('madera', 'cedro', 'sandal', 'vetiver', 'oud');
    if (aroma === 'floral') hints.push('floral', 'jazmin', 'rosa', 'azahar', 'peonia');
    if (aroma === 'citrico') hints.push('citrico', 'limon', 'bergamota', 'mandarina', 'naranja');
    if (aroma === 'oriental') hints.push('especias', 'incienso', 'ambar', 'vainilla', 'resina');

    const intensity = String(a.intensity || '').toLowerCase();
    if (intensity === 'suave') hints.push('suave', 'ligero', 'sutil');
    if (intensity === 'moderada') hints.push('equilibrado', 'versatil');
    if (intensity === 'fuerte') hints.push('intenso', 'proyeccion', 'larga duracion');

    const occasion = String(a.occasion || '').toLowerCase();
    if (occasion === 'diario') hints.push('diario', 'versatil');
    if (occasion === 'trabajo') hints.push('elegante', 'limpio', 'no invasivo');
    if (occasion === 'fiesta') hints.push('noche', 'seductor', 'intenso');
    if (occasion === 'citas') hints.push('romantico', 'sensual');
    if (occasion === 'eventos') hints.push('sofisticado', 'lujo');

    const climate = String(a.climate || '').toLowerCase();
    if (climate === 'calido') hints.push('calido', 'fresco', 'citrico', 'acuatico');
    if (climate === 'templado') hints.push('templado', 'versatil');
    if (climate === 'frio') hints.push('frio', 'ambar', 'vainilla', 'amaderado');

    return unique(hints);
};

const computeHeuristicScore = (p: ProductRow, tokens: string[], preferGenero?: string | null): number => {
    const haystack = normalizeText(`${p.nombre} ${p.descripcion || ''} ${p.notas_olfativas || ''} ${(p as any).categoria_nombre || ''} ${p.genero || ''}`);
    let score = 0;

    for (const t of tokens) {
        if (!t || t.length < 3) continue;
        if (haystack.includes(t)) score += 1;
    }

    const vend = Number(p.unidades_vendidas || 0);
    if (Number.isFinite(vend) && vend > 0) score += Math.min(4, vend / 50);

    if (preferGenero && p.genero && String(p.genero).toLowerCase() === String(preferGenero).toLowerCase()) {
        score += 2.5;
    }

    return score;
};

const selectCandidates = async (opts: { preferGenero?: string | null }): Promise<ProductRow[]> => {
    const hasCategories = await detectCategoriesSchema();
    const join = hasCategories ? 'LEFT JOIN categorias c ON c.slug = p.genero' : '';
    const categorySelect = hasCategories ? ', c.nombre AS categoria_nombre, c.slug AS categoria_slug' : '';

    const whereParts: string[] = ['p.stock > 0'];
    const params: any[] = [];
    if (opts.preferGenero && String(opts.preferGenero).trim().toLowerCase() !== 'unisex') {
        whereParts.push('p.genero = ?');
        params.push(String(opts.preferGenero).trim().toLowerCase());
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [rows] = await pool.query<ProductRow[]>(
        `SELECT p.id, p.nombre AS name, p.nombre, p.genero, p.descripcion AS description, p.descripcion,
                p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                p.unidades_vendidas AS soldCount, p.unidades_vendidas, p.imagen_url AS imageUrl, p.imagen_url${categorySelect}
         FROM productos p
         ${join}
         ${whereSql}
         ORDER BY COALESCE(p.unidades_vendidas, 0) DESC, p.creado_en DESC
         LIMIT 120`,
        params
    );

    return rows || [];
};

const safeParseJsonObject = (raw: string): any | null => {
    const s = String(raw || '').trim();
    if (!s) return null;
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first < 0 || last < 0 || last <= first) return null;
    const slice = s.slice(first, last + 1);
    try {
        return JSON.parse(slice);
    } catch {
        return null;
    }
};

const runAiRanking = async (payload: {
    mode: 'quiz' | 'free' | 'similar';
    user_text: string;
    quiz_answers?: any;
    base_product?: any;
    candidates: ProductRow[];
}): Promise<RecoItem[] | null> => {
    if (!GROQ_API_KEY) return null;
    if (!payload.candidates?.length) return [];

    const system =
        'Eres un asesor experto en perfumeria de lujo para e-commerce. Devuelve SOLO JSON valido, sin markdown. ' +
        'No inventes productos; solo puedes recomendar IDs presentes en candidates. ' +
        'Maximo 6 recomendaciones. reasons deben ser cortas y concretas.';

    const candidatesLite = payload.candidates.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        genero: p.genero,
        categoria_nombre: (p as any).categoria_nombre || null,
        precio: Number(p.precio || 0),
        notas_olfativas: p.notas_olfativas || '',
        descripcion: (p.descripcion || '').slice(0, 180)
    }));

    const user = {
        mode: payload.mode,
        user_text: payload.user_text,
        quiz_answers: payload.quiz_answers || null,
        base_product: payload.base_product || null,
        candidates: candidatesLite
    };

    const prompt =
        'Analiza user_text y/o quiz_answers y devuelve un ranking de perfumes. ' +
        'Formato exacto:\n' +
        '{"recommendations":[{"id":"<uuid>","rank":1,"reasons":["...","..."],"short_explanation":"..."}]}' +
        '\nReglas:\n' +
        '- rank empieza en 1\n' +
        '- reasons: 2 a 4 bullets cortos (sin emojis)\n' +
        '- short_explanation: max 140 caracteres\n' +
        '- solo IDs existentes\n' +
        '- no repitas perfumes\n';

    const resp = await openai.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt + '\nINPUT:\n' + JSON.stringify(user) }
        ],
        temperature: 0.3,
        max_tokens: 900
    });

    const content = resp.choices?.[0]?.message?.content || '';
    const parsed = safeParseJsonObject(content);
    const list = parsed?.recommendations;
    if (!Array.isArray(list)) return null;

    const seen = new Set<string>();
    const items: RecoItem[] = [];
    for (const it of list) {
        const id = String(it?.id || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const reasons = Array.isArray(it?.reasons) ? it.reasons.map((r: any) => String(r).trim()).filter(Boolean).slice(0, 4) : [];
        const short = String(it?.short_explanation || '').trim();
        const rank = Math.max(1, Math.trunc(Number(it?.rank || items.length + 1)));
        items.push({ id, rank, reasons, short_explanation: short });
        if (items.length >= 6) break;
    }
    return items;
};

const recordEvent = async (req: Request, event_type: string, payload: any, session_id?: string) => {
    try {
        const ok = await detectRecoEventsSchema();
        if (!ok) return;
        const ua = String(req.headers['user-agent'] || '').slice(0, 800);
        await pool.query(
            'INSERT INTO recomendacioneventos (usuario_id, session_id, event_type, payload, user_agent) VALUES (?, ?, ?, ?, ?)',
            [null, session_id || null, event_type, payload ? JSON.stringify(payload) : null, ua || null]
        );
    } catch {
        // ignore
    }
};

const buildResponse = (candidatesById: Map<string, ProductRow>, reco: RecoItem[]) => {
    const out: any[] = [];
    let rank = 1;
    for (const it of reco) {
        const p = candidatesById.get(it.id);
        if (!p) continue;
        out.push({
            rank: it.rank || rank,
            reasons: it.reasons || [],
            short_explanation: it.short_explanation || '',
            product: {
                id: p.id,
                name: (p as any).name || p.nombre,
                nombre: p.nombre || (p as any).name,
                price: Number((p as any).price || p.precio || 0),
                precio: Number(p.precio || (p as any).price || 0),
                imageUrl: (p as any).imageUrl || p.imagen_url,
                imagen_url: p.imagen_url || (p as any).imageUrl,
                notes: (p as any).notes || p.notas_olfativas,
                notas_olfativas: p.notas_olfativas || (p as any).notes,
                genero: p.genero,
                categoria_nombre: (p as any).categoria_nombre || null,
                categoria_slug: (p as any).categoria_slug || null
            }
        });
        rank++;
    }
    return out;
};

export const recommendFromQuiz = async (req: Request, res: Response): Promise<void> => {
    try {
        const session_id = String(req.body?.session_id || '').trim() || undefined;
        const answers = req.body?.answers || {};
        const preferGenero = String(answers?.for_who || '').trim().toLowerCase() || null;

        const candidates = await selectCandidates({ preferGenero });
        const baseTokens = unique([
            ...tokenize(req.body?.free_text || ''),
            ...buildKeywordHintsFromQuiz(answers)
        ]);

        const scored = candidates
            .map((p) => ({ p, s: computeHeuristicScore(p, baseTokens, preferGenero) }))
            .sort((a, b) => b.s - a.s)
            .slice(0, 50);

        const top = scored.map((x) => x.p);
        const candidatesById = new Map(top.map((p) => [p.id, p] as const));

        const userText = `Respuestas quiz: ${JSON.stringify(answers)}`;
        const ai = await runAiRanking({ mode: 'quiz', user_text: userText, quiz_answers: answers, candidates: top });

        let reco: RecoItem[];
        if (ai && ai.length) {
            reco = ai;
        } else {
            reco = scored.slice(0, 6).map((x, idx) => ({
                id: x.p.id,
                rank: idx + 1,
                reasons: ['Compatible con tus preferencias', 'Basado en notas y descripcion'],
                short_explanation: 'Seleccionado por afinidad con tu perfil',
                score: x.s
            }));
        }

        recordEvent(req, 'quiz_submit', { answers, tokens: baseTokens.slice(0, 30), candidates: top.length }, session_id);

        res.status(200).json({
            mode: 'quiz',
            recommendations: buildResponse(candidatesById, reco).slice(0, 6)
        });
    } catch (e: any) {
        res.status(500).json({ error: e?.message || 'No se pudo generar recomendacion' });
    }
};

export const recommendFromFreeText = async (req: Request, res: Response): Promise<void> => {
    try {
        const session_id = String(req.body?.session_id || '').trim() || undefined;
        const query = String(req.body?.query || '').trim();

        const tokens = unique(tokenize(query));
        const candidates = await selectCandidates({});
        const scored = candidates
            .map((p) => ({ p, s: computeHeuristicScore(p, tokens) }))
            .sort((a, b) => b.s - a.s)
            .slice(0, 50);

        const top = scored.map((x) => x.p);
        const candidatesById = new Map(top.map((p) => [p.id, p] as const));

        const ai = await runAiRanking({ mode: 'free', user_text: query, candidates: top });
        const reco: RecoItem[] = (ai && ai.length)
            ? ai
            : scored.slice(0, 6).map((x, idx) => ({
                id: x.p.id,
                rank: idx + 1,
                reasons: ['Coincide con tu busqueda', 'Basado en notas y descripcion'],
                short_explanation: 'Seleccionado por afinidad con tu descripcion',
                score: x.s
            }));

        recordEvent(req, 'free_query', { query, tokens: tokens.slice(0, 40), candidates: top.length }, session_id);

        res.status(200).json({
            mode: 'free',
            recommendations: buildResponse(candidatesById, reco).slice(0, 6)
        });
    } catch (e: any) {
        res.status(500).json({ error: e?.message || 'No se pudo generar recomendacion' });
    }
};

export const recommendSimilar = async (req: Request, res: Response): Promise<void> => {
    try {
        const session_id = String(req.body?.session_id || '').trim() || undefined;
        const productId = String(req.params?.id || '').trim();
        if (!productId) {
            res.status(400).json({ error: 'Producto invalido' });
            return;
        }

        const hasCategories = await detectCategoriesSchema();
        const join = hasCategories ? 'LEFT JOIN categorias c ON c.slug = p.genero' : '';
        const categorySelect = hasCategories ? ', c.nombre AS categoria_nombre, c.slug AS categoria_slug' : '';
        const [rows] = await pool.query<ProductRow[]>(
            `SELECT p.id, p.nombre AS name, p.nombre, p.genero, p.descripcion AS description, p.descripcion,
                    p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                    p.unidades_vendidas AS soldCount, p.unidades_vendidas, p.imagen_url AS imageUrl, p.imagen_url${categorySelect}
             FROM productos p
             ${join}
             WHERE p.id = ?
             LIMIT 1`,
            [productId]
        );
        const base = rows?.[0];
        if (!base) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }

        const baseTokens = unique(tokenize(`${base.nombre} ${base.descripcion || ''} ${base.notas_olfativas || ''}`));
        const candidates = await selectCandidates({ preferGenero: base.genero || null });
        const filtered = candidates.filter((p) => p.id !== base.id);
        const scored = filtered
            .map((p) => ({ p, s: computeHeuristicScore(p, baseTokens, base.genero || null) }))
            .sort((a, b) => b.s - a.s)
            .slice(0, 50);

        const top = scored.map((x) => x.p);
        const candidatesById = new Map(top.map((p) => [p.id, p] as const));

        const ai = await runAiRanking({ mode: 'similar', user_text: 'Perfumes similares', base_product: base, candidates: top });
        const reco: RecoItem[] = (ai && ai.length)
            ? ai
            : scored.slice(0, 6).map((x, idx) => ({
                id: x.p.id,
                rank: idx + 1,
                reasons: ['Similar por notas/estilo', 'Misma categoria o perfil cercano'],
                short_explanation: 'Alternativa similar',
                score: x.s
            }));

        recordEvent(req, 'similar', { base_product_id: base.id, candidates: top.length }, session_id);

        res.status(200).json({
            base_product: {
                id: base.id,
                nombre: base.nombre
            },
            recommendations: buildResponse(candidatesById, reco).slice(0, 6)
        });
    } catch (e: any) {
        res.status(500).json({ error: e?.message || 'No se pudo generar recomendacion' });
    }
};

export const recordRecommendationEvent = async (req: Request, res: Response): Promise<void> => {
    try {
        const session_id = String(req.body?.session_id || '').trim() || undefined;
        const event_type = String(req.body?.event_type || '').trim();
        const payload = req.body?.payload;
        await recordEvent(req, event_type, payload, session_id);
        res.status(200).json({ ok: true });
    } catch {
        res.status(200).json({ ok: true });
    }
};
