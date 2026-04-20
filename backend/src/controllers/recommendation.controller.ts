import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

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
    casa?: string | null;
};

type RecoItem = {
    id: string;
    rank: number;
    reasons: string[];
    short_explanation: string;
    score?: number;
};

type IntentProfile = {
    aromas: string[];
    contexts: string[];
    keywords: string[];
    preferGenero: string | null;
};

// Preferir GEMINI_API_KEY. Se mantiene fallback a GROQ_API_KEY para facilitar migracion.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;
const gemini = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

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

let productCasaReady: boolean | null = null;
const detectProductCasaSchema = async (): Promise<boolean> => {
    if (productCasaReady !== null) return productCasaReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) AS ok
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND LOWER(table_name) = 'productos'
               AND column_name = 'casa'
             LIMIT 1`
        );
        productCasaReady = Number(rows?.[0]?.ok || 0) > 0;
        return productCasaReady;
    } catch {
        productCasaReady = false;
        return false;
    }
};

// Detecta si productos.id es BINARY (UUID) o VARCHAR
let productIdIsBinary: boolean | null = null;
const detectProductIdType = async (): Promise<boolean> => {
    if (productIdIsBinary !== null) return productIdIsBinary;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT DATA_TYPE FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND LOWER(table_name) = 'productos'
               AND LOWER(column_name) = 'id'
             LIMIT 1`
        );
        const dtype = String(rows?.[0]?.DATA_TYPE || '').toLowerCase();
        productIdIsBinary = dtype === 'binary' || dtype === 'varbinary';
    } catch {
        productIdIsBinary = false;
    }
    return productIdIsBinary;
};

const productIdReadExpr = async (): Promise<string> => {
    const binary = await detectProductIdType();
    return binary ? 'BIN_TO_UUID(p.id)' : 'p.id';
};

const productIdWhereExpr = async (): Promise<string> => {
    const binary = await detectProductIdType();
    return binary ? 'UUID_TO_BIN(?)' : '?';
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

const includesAny = (text: string, patterns: RegExp[]): boolean => patterns.some((r) => r.test(text));

const parseIntentFromText = (raw: string): IntentProfile => {
    const t = normalizeText(raw);
    const aromas: string[] = [];
    const contexts: string[] = [];
    const keywords: string[] = [];
    const add = (...k: string[]) => keywords.push(...k);

    if (includesAny(t, [/\bfresc\w*\b/, /\bcitric\w*\b/, /\bacuatic\w*\b/, /\blimpi\w*\b/])) {
        aromas.push('fresco');
        add('fresco', 'citrico', 'acuatico', 'limpio', 'verde');
    }
    if (includesAny(t, [/\bdulc\w*\b/, /\bgourmand\b/, /\bvainill\w*\b/])) {
        aromas.push('dulce');
        add('dulce', 'vainilla', 'gourmand', 'afrutado', 'caramelo', 'tonka');
    }
    if (includesAny(t, [/\bamaderad\w*\b/, /\bmadera\b/, /\bcedro\b/, /\bvetiver\b/])) {
        aromas.push('amaderado');
        add('amaderado', 'madera', 'cedro', 'vetiver', 'intenso', 'elegante');
    }
    if (includesAny(t, [/\bfloral\b/, /\bfemenin\w*\b/, /\brosa\b/, /\bjazmin\b/])) {
        aromas.push('floral');
        add('floral', 'femenino', 'suave', 'jazmin', 'rosa');
    }

    if (includesAny(t, [/\btrabaj\w*\b/, /\boficina\b/])) {
        contexts.push('trabajo');
        add('suave', 'elegante', 'limpio', 'versatil', 'no invasivo');
    }
    if (includesAny(t, [/\bgym\b/, /\bgimnasio\b/, /\bdeporte\b/, /\bentren\w*\b/])) {
        contexts.push('gym');
        add('fresco', 'ligero', 'energetico', 'citrico', 'acuatico');
    }
    if (includesAny(t, [/\bnoche\b/, /\bfiesta\b/, /\bcita\w*\b/, /\bseductor\w*\b/])) {
        contexts.push('noche');
        add('intenso', 'seductor', 'ambar', 'vainilla', 'especiado');
    }
    if (includesAny(t, [/\bdiario\b/, /\bcada dia\b/, /\beveryday\b/])) {
        contexts.push('diario');
        add('versatil', 'equilibrado', 'limpio');
    }

    if (includesAny(t, [/\bmama\b/, /\bmadre\b/])) {
        add('femenino', 'elegante', 'floral', 'suave');
    }

    const preferGenero = inferPreferGeneroFromText(t);
    return {
        aromas: unique(aromas),
        contexts: unique(contexts),
        keywords: unique(keywords.concat(tokenize(t))),
        preferGenero
    };
};

const computeMatchRatio = (p: ProductRow, tokens: string[]): number => {
    if (!tokens.length) return 1;
    const haystack = normalizeText(`${p.nombre} ${p.descripcion || ''} ${p.notas_olfativas || ''} ${(p as any).categoria_nombre || ''} ${(p as any).casa || ''} ${p.genero || ''}`);
    let hit = 0;
    for (const t of tokens) {
        if (!t || t.length < 3) continue;
        if (haystack.includes(t)) hit += 1;
    }
    return hit / Math.max(1, tokens.length);
};

const ensureRecoRange = (reco: RecoItem[], fallback: RecoItem[], min = 4, max = 8): RecoItem[] => {
    const out: RecoItem[] = [];
    const seen = new Set<string>();

    for (const it of reco || []) {
        const id = String(it?.id || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(it);
        if (out.length >= max) break;
    }

    for (const it of fallback || []) {
        if (out.length >= max) break;
        const id = String(it?.id || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(it);
    }

    // Si no hay suficientes, devolvemos lo disponible, pero intentamos llegar al mínimo siempre que exista inventario.
    return out.slice(0, max);
};

// ── Normalizacion de genero / filtros ────────────────────────────────────────
const normalizeGenero = (raw: any): string | null => {
    const g = String(raw || '').trim().toLowerCase();
    if (!g) return null;
    if (g === 'unisex' || g === 'uni-sex' || g === 'mix' || g === 'mixto') return 'unisex';
    if (g === 'hombre' || g === 'caballero' || g === 'masculino') return 'hombre';
    if (g === 'mujer' || g === 'dama' || g === 'femenino') return 'mujer';
    return g;
};

const generoAliases = (preferGenero?: string | null): string[] => {
    const g = normalizeGenero(preferGenero);
    if (!g) return [];
    if (g === 'hombre') return ['hombre', 'caballero', 'masculino'];
    if (g === 'mujer') return ['mujer', 'dama', 'femenino'];
    if (g === 'unisex') return ['unisex', 'mix', 'mixto'];
    return [g];
};

const inferPreferGeneroFromText = (text: string): string | null => {
    const t = normalizeText(text);
    if (!t) return null;
    const hasH = /(\bhombre\b|\bcaballero\b|\bmasculin\w*\b)/.test(t);
    const hasM = /(\bmujer\b|\bdama\b|\bfemenin\w*\b)/.test(t);
    const hasU = /(\bunisex\b|\bmixt\w*\b)/.test(t);
    if (hasH && !hasM) return 'hombre';
    if (hasM && !hasH) return 'mujer';
    if (hasU && !hasH && !hasM) return 'unisex';
    return null;
};

const buildKeywordHintsFromQuiz = (answers: any): string[] => {
    const a = answers || {};
    const hints: string[] = [];

    const for_who = String(a.for_who || '').toLowerCase();
    if (for_who === 'arabe') hints.push('arabe', 'oud', 'especias', 'oriental', 'lujo');
    if (for_who === 'kits') hints.push('kit', 'set', 'regalo', 'coleccion', 'miniaturas');

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

    const pref = normalizeGenero(preferGenero);
    const pg = normalizeGenero(p.genero);
    if (pref && pg) {
        if (pg === pref) score += 2.8;
        else if (pg === 'unisex') score += 0.6;
        else score -= 1.2;
    }

    return score;
};

const selectCandidates = async (opts: { preferGenero?: string | null }): Promise<ProductRow[]> => {
    const hasCategories = await detectCategoriesSchema();
    const hasCasa = await detectProductCasaSchema();
    const canJoin = hasCategories && hasCasa;
    const join = canJoin ? 'LEFT JOIN categorias c ON c.slug = p.casa' : '';
    const categorySelect = canJoin ? ', c.nombre AS categoria_nombre, c.slug AS categoria_slug' : '';
    const casaSelect = hasCasa ? ', p.casa AS casa' : '';

    const idRead = await productIdReadExpr();

    const whereParts: string[] = ['p.stock > 0'];
    const params: any[] = [];
    const pref = normalizeGenero(opts.preferGenero);
    if (pref && pref !== 'unisex') {
        const aliases = generoAliases(pref);
        // Incluir genero preferido (con aliases) + unisex + nulos como fallback
        const placeholders = aliases.map(() => '?').join(', ');
        whereParts.push(`(LOWER(p.genero) IN (${placeholders}) OR LOWER(p.genero) IN ('unisex','mix','mixto') OR p.genero IS NULL)`);
        params.push(...aliases);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const baseSelect =
        `SELECT ${idRead} AS id, p.nombre AS name, p.nombre, p.genero, p.descripcion AS description, p.descripcion,
                p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock,
                p.unidades_vendidas AS soldCount, p.unidades_vendidas, p.imagen_url AS imageUrl, p.imagen_url${casaSelect}${categorySelect}
         FROM productos p
         ${join}
         ${whereSql}`;

    // Mezclar candidatos: top vendidos + mas nuevos (evita siempre los mismos top fijos)
    const [soldRows] = await pool.query<ProductRow[]>(
        `${baseSelect}
         ORDER BY COALESCE(p.unidades_vendidas, 0) DESC, p.creado_en DESC
         LIMIT 140`,
        params
    );

    const [newRows] = await pool.query<ProductRow[]>(
        `${baseSelect}
         ORDER BY p.creado_en DESC
         LIMIT 140`,
        params
    );

    const out: ProductRow[] = [];
    const seen = new Set<string>();
    for (const r of (soldRows || [])) {
        const id = String((r as any)?.id || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(r);
    }
    for (const r of (newRows || [])) {
        const id = String((r as any)?.id || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(r);
    }

    return out;
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
    intent_profile?: IntentProfile | null;
    quiz_answers?: any;
    base_product?: any;
    candidates: ProductRow[];
}): Promise<RecoItem[] | null> => {
    if (!GEMINI_API_KEY || !gemini) return null;
    if (!payload.candidates?.length) return [];

    const system =
        'Eres un asistente experto en recomendación de perfumes. ' +
        'Interpreta intención (tipo de aroma, contexto de uso y perfil), y recomienda entre 4 y 8 opciones realmente útiles. ' +
        'Devuelve SOLO JSON valido, sin markdown. ' +
        'No inventes productos; solo puedes usar IDs presentes en candidates. ' +
        'Prioriza disponibilidad, relevancia por intención y popularidad. ' +
        'Evita recomendaciones repetitivas o casi idénticas.';

    const candidatesLite = payload.candidates.slice(0, 25).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        casa: (p as any).casa || null,
        genero: p.genero,
        categoria_nombre: (p as any).categoria_nombre || null,
        precio: Number(p.precio || 0),
        notas_olfativas: (p.notas_olfativas || '').slice(0, 140),
        descripcion: (p.descripcion || '').slice(0, 100)
    }));

    const user = {
        mode: payload.mode,
        user_text: payload.user_text,
        intent_profile: payload.intent_profile || null,
        quiz_answers: payload.quiz_answers || null,
        base_product: payload.base_product || null,
        candidates: candidatesLite
    };

    const prompt =
        'Analiza user_text y/o quiz_answers e interpreta intención de compra/uso. ' +
        'Si la consulta es ambigua, mezcla resultados coherentes (ej. dulce + fresco) priorizando utilidad. ' +
        'Formato exacto:\n' +
        '{"recommendations":[{"id":"<uuid>","rank":1,"reasons":["...","..."],"short_explanation":"..."}]}' +
        '\nReglas:\n' +
        '- rank empieza en 1\n' +
        '- entrega entre 4 y 8 recomendaciones\n' +
        '- reasons: 2 a 4 bullets cortos (sin emojis)\n' +
        '- short_explanation: max 140 caracteres\n' +
        '- solo IDs existentes\n' +
        '- no repitas perfumes\n' +
        '- evita razones negativas; justifica por qué cada opción es ideal para la intención\n';

    const resp = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: system + '\n\n' + prompt + '\nINPUT:\n' + JSON.stringify(user)
    });

    const content = String(resp.text || '').trim();
    if (!content) {
        console.warn('[AI] Respuesta vacía de Gemini');
        return null;
    }

    const parsed = safeParseJsonObject(content);
    if (!parsed) {
        console.warn('[AI] Error parseando JSON de Gemini:', content.slice(0, 100));
        return null;
    }

    const list = parsed?.recommendations;
    if (!Array.isArray(list)) {
        console.warn('[AI] El campo recommendations no es un array');
        return null;
    }

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
        if (items.length >= 8) break;
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
                marca: (p as any).categoria_nombre || (p as any).casa || null,
                casa: (p as any).casa || null,
                price: Number((p as any).price || p.precio || 0),
                precio: Number(p.precio || (p as any).price || 0),
                imageUrl: (p as any).imageUrl || p.imagen_url,
                imagen_url: p.imagen_url || (p as any).imageUrl,
                notes: (p as any).notes || p.notas_olfativas,
                notas_olfativas: p.notas_olfativas || (p as any).notes,
                descripcion: p.descripcion || (p as any).description || '',
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
        const preferGenero = normalizeGenero(String(answers?.for_who || '').trim()) || null;

        let candidates = await selectCandidates({ preferGenero });
        if (!candidates.length && preferGenero && preferGenero !== 'unisex') {
            candidates = await selectCandidates({});
        }
        const freeText = String(req.body?.free_text || '');
        const intent = parseIntentFromText(freeText);
        const baseTokens = unique([
            ...tokenize(req.body?.free_text || ''),
            ...buildKeywordHintsFromQuiz(answers),
            ...intent.keywords
        ]);

        const scored = candidates
            .map((p) => ({ p, s: computeHeuristicScore(p, baseTokens, preferGenero) }))
            .sort((a, b) => b.s - a.s)
            .slice(0, 50);

        const top = scored.map((x) => x.p);
        const candidatesById = new Map(top.map((p) => [p.id, p] as const));

        const userText = `Respuestas quiz: ${JSON.stringify(answers)} ${freeText ? `| Texto: ${freeText}` : ''}`;
        const ai = await runAiRanking({ mode: 'quiz', user_text: userText, intent_profile: intent, quiz_answers: answers, candidates: top });

        const fallbackReco: RecoItem[] = scored.slice(0, 8).map((x, idx) => ({
            id: x.p.id,
            rank: idx + 1,
            reasons: ['Compatible con tus preferencias', 'Basado en notas y descripcion'],
            short_explanation: 'Seleccionado por afinidad con tu perfil',
            score: x.s
        }));

        let reco: RecoItem[] = (ai && ai.length) ? ai : fallbackReco;

        // Validar IDs: el modelo a veces devuelve IDs invalidos.
        const valid = (reco || []).filter((it) => candidatesById.has(String(it?.id || '').trim()));
        reco = valid.length ? ensureRecoRange(valid, fallbackReco, 4, 8) : ensureRecoRange([], fallbackReco, 4, 8);

        recordEvent(req, 'quiz_submit', { answers, tokens: baseTokens.slice(0, 30), candidates: top.length }, session_id);

        // Enforce preferGenero: priorizar coincidencias vs unisex
        if (preferGenero && preferGenero !== 'unisex') {
            const withGenero = reco.map((it) => ({
                it,
                g: normalizeGenero(candidatesById.get(it.id)?.genero)
            }));
            const preferred = withGenero.filter((x) => x.g === preferGenero).map((x) => x.it);
            const unisex = withGenero.filter((x) => x.g === 'unisex' || x.g == null).map((x) => x.it);
            const other = withGenero.filter((x) => x.g && x.g !== preferGenero && x.g !== 'unisex').map((x) => x.it);
            reco = ensureRecoRange(preferred.concat(unisex, other), fallbackReco, 4, 8);
        }

        res.status(200).json({
            mode: 'quiz',
            recommendations: buildResponse(candidatesById, reco).slice(0, 8)
        });
    } catch (e: any) {
        res.status(500).json({ error: e?.message || 'No se pudo generar recomendacion' });
    }
};

export const recommendFromFreeText = async (req: Request, res: Response): Promise<void> => {
    try {
        const session_id = String(req.body?.session_id || '').trim() || undefined;
        const query = String(req.body?.query || '').trim();
        const intent = parseIntentFromText(query);
        const preferGenero = intent.preferGenero || inferPreferGeneroFromText(query);

        const tokens = unique(tokenize(query).concat(intent.keywords));
        let candidates = await selectCandidates({ preferGenero });
        if (!candidates.length && preferGenero && preferGenero !== 'unisex') {
            candidates = await selectCandidates({});
        }
        const scored = candidates
            .map((p) => {
                const s = computeHeuristicScore(p, tokens, preferGenero);
                const ratio = computeMatchRatio(p, tokens);
                const bonus = ratio >= 0.7 ? 3 : ratio >= 0.5 ? 1.2 : 0;
                return { p, s: s + bonus, r: ratio };
            })
            .sort((a, b) => b.s - a.s)
            .slice(0, 80);

        const highIntent = scored.filter((x) => x.r >= 0.7);
        const candidatePool = highIntent.length >= 4 ? highIntent.concat(scored.filter((x) => x.r < 0.7)) : scored;

        const top = candidatePool.map((x) => x.p).slice(0, 50);
        const candidatesById = new Map(top.map((p) => [p.id, p] as const));

        const ai = await runAiRanking({ mode: 'free', user_text: query, intent_profile: intent, candidates: top });
        const fallbackReco: RecoItem[] = candidatePool.slice(0, 8).map((x, idx) => ({
            id: x.p.id,
            rank: idx + 1,
            reasons: [
                x.r >= 0.7 ? 'Alta coincidencia con tu intención olfativa' : 'Coincide con parte de tu intención',
                'Buen desempeño en popularidad y disponibilidad'
            ],
            short_explanation: x.r >= 0.7
                ? 'Ajuste fuerte a aroma, contexto y estilo que describiste.'
                : 'Opción equilibrada para tu intención y uso diario.',
            score: x.s
        }));

        let reco: RecoItem[] = (ai && ai.length) ? ai : fallbackReco;

        const valid = (reco || []).filter((it) => candidatesById.has(String(it?.id || '').trim()));
        reco = valid.length ? ensureRecoRange(valid, fallbackReco, 4, 8) : ensureRecoRange([], fallbackReco, 4, 8);

        if (preferGenero && preferGenero !== 'unisex') {
            const withGenero = reco.map((it) => ({
                it,
                g: normalizeGenero(candidatesById.get(it.id)?.genero)
            }));
            const preferred = withGenero.filter((x) => x.g === preferGenero).map((x) => x.it);
            const unisex = withGenero.filter((x) => x.g === 'unisex' || x.g == null).map((x) => x.it);
            const other = withGenero.filter((x) => x.g && x.g !== preferGenero && x.g !== 'unisex').map((x) => x.it);
            reco = ensureRecoRange(preferred.concat(unisex, other), fallbackReco, 4, 8);
        }

        recordEvent(req, 'free_query', { query, tokens: tokens.slice(0, 40), candidates: top.length }, session_id);

        res.status(200).json({
            mode: 'free',
            recommendations: buildResponse(candidatesById, reco).slice(0, 8)
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
        const hasCasa = await detectProductCasaSchema();
        const canJoin = hasCategories && hasCasa;
        const join = canJoin ? 'LEFT JOIN categorias c ON c.slug = p.casa' : '';
        const categorySelect = canJoin ? ', c.nombre AS categoria_nombre, c.slug AS categoria_slug' : '';
        const idRead = await productIdReadExpr();
        const idWhere = await productIdWhereExpr();
        const [rows] = await pool.query<ProductRow[]>(
            `SELECT ${idRead} AS id, p.nombre AS name, p.nombre, p.genero, p.descripcion AS description, p.descripcion,
                    p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                    p.unidades_vendidas AS soldCount, p.unidades_vendidas, p.imagen_url AS imageUrl, p.imagen_url${categorySelect}
             FROM productos p
             ${join}
             WHERE p.id = ${idWhere}
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
        const fallbackReco: RecoItem[] = scored.slice(0, 8).map((x, idx) => ({
            id: x.p.id,
            rank: idx + 1,
            reasons: ['Similar por notas/estilo', 'Misma categoria o perfil cercano'],
            short_explanation: 'Alternativa similar',
            score: x.s
        }));

        let reco: RecoItem[] = (ai && ai.length) ? ai : fallbackReco;
        const valid = (reco || []).filter((it) => candidatesById.has(String(it?.id || '').trim()));
        reco = valid.length ? ensureRecoRange(valid, fallbackReco, 4, 8) : ensureRecoRange([], fallbackReco, 4, 8);

        recordEvent(req, 'similar', { base_product_id: base.id, candidates: top.length }, session_id);

        res.status(200).json({
            base_product: {
                id: base.id,
                nombre: base.nombre
            },
            recommendations: buildResponse(candidatesById, reco).slice(0, 8)
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
