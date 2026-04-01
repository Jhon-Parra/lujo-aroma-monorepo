"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordRecommendationEvent = exports.recommendSimilar = exports.recommendFromFreeText = exports.recommendFromQuiz = void 0;
const openai_1 = __importDefault(require("openai"));
const database_1 = require("../config/database");
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const openai = new openai_1.default({
    apiKey: GROQ_API_KEY || '',
    baseURL: 'https://api.groq.com/openai/v1'
});
let categoriesReady = null;
const detectCategoriesSchema = async () => {
    if (categoriesReady !== null)
        return categoriesReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT COUNT(*) AS ok 
             FROM information_schema.tables 
             WHERE table_schema = DATABASE() 
               AND table_name = 'categorias'`);
        categoriesReady = Number(rows?.[0]?.ok || 0) > 0;
        return categoriesReady;
    }
    catch {
        categoriesReady = false;
        return false;
    }
};
let productCasaReady = null;
const detectProductCasaSchema = async () => {
    if (productCasaReady !== null)
        return productCasaReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT COUNT(*) AS ok
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND LOWER(table_name) = 'productos'
               AND column_name = 'casa'
             LIMIT 1`);
        productCasaReady = Number(rows?.[0]?.ok || 0) > 0;
        return productCasaReady;
    }
    catch {
        productCasaReady = false;
        return false;
    }
};
// Detecta si productos.id es BINARY (UUID) o VARCHAR
let productIdIsBinary = null;
const detectProductIdType = async () => {
    if (productIdIsBinary !== null)
        return productIdIsBinary;
    try {
        const [rows] = await database_1.pool.query(`SELECT DATA_TYPE FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND LOWER(table_name) = 'productos'
               AND LOWER(column_name) = 'id'
             LIMIT 1`);
        const dtype = String(rows?.[0]?.DATA_TYPE || '').toLowerCase();
        productIdIsBinary = dtype === 'binary' || dtype === 'varbinary';
    }
    catch {
        productIdIsBinary = false;
    }
    return productIdIsBinary;
};
const productIdReadExpr = async () => {
    const binary = await detectProductIdType();
    return binary ? 'BIN_TO_UUID(p.id)' : 'p.id';
};
const productIdWhereExpr = async () => {
    const binary = await detectProductIdType();
    return binary ? 'UUID_TO_BIN(?)' : '?';
};
let recoEventsReady = null;
const detectRecoEventsSchema = async () => {
    if (recoEventsReady !== null)
        return recoEventsReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT COUNT(*) AS ok 
             FROM information_schema.tables 
             WHERE table_schema = DATABASE() 
               AND table_name = 'recomendacioneventos'`);
        recoEventsReady = Number(rows?.[0]?.ok || 0) > 0;
        return recoEventsReady;
    }
    catch {
        recoEventsReady = false;
        return false;
    }
};
const normalizeText = (raw) => {
    return String(raw || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};
const tokenize = (raw) => {
    const s = normalizeText(raw);
    if (!s)
        return [];
    return s.split(' ').filter(Boolean);
};
const unique = (arr) => Array.from(new Set(arr));
// ── Normalizacion de genero / filtros ────────────────────────────────────────
const normalizeGenero = (raw) => {
    const g = String(raw || '').trim().toLowerCase();
    if (!g)
        return null;
    if (g === 'unisex' || g === 'uni-sex' || g === 'mix' || g === 'mixto')
        return 'unisex';
    if (g === 'hombre' || g === 'caballero' || g === 'masculino')
        return 'hombre';
    if (g === 'mujer' || g === 'dama' || g === 'femenino')
        return 'mujer';
    return g;
};
const generoAliases = (preferGenero) => {
    const g = normalizeGenero(preferGenero);
    if (!g)
        return [];
    if (g === 'hombre')
        return ['hombre', 'caballero', 'masculino'];
    if (g === 'mujer')
        return ['mujer', 'dama', 'femenino'];
    if (g === 'unisex')
        return ['unisex', 'mix', 'mixto'];
    return [g];
};
const inferPreferGeneroFromText = (text) => {
    const t = normalizeText(text);
    if (!t)
        return null;
    const hasH = /(\bhombre\b|\bcaballero\b|\bmasculin\w*\b)/.test(t);
    const hasM = /(\bmujer\b|\bdama\b|\bfemenin\w*\b)/.test(t);
    const hasU = /(\bunisex\b|\bmixt\w*\b)/.test(t);
    if (hasH && !hasM)
        return 'hombre';
    if (hasM && !hasH)
        return 'mujer';
    if (hasU && !hasH && !hasM)
        return 'unisex';
    return null;
};
const buildKeywordHintsFromQuiz = (answers) => {
    const a = answers || {};
    const hints = [];
    const for_who = String(a.for_who || '').toLowerCase();
    if (for_who === 'arabe')
        hints.push('arabe', 'oud', 'especias', 'oriental', 'lujo');
    if (for_who === 'kits')
        hints.push('kit', 'set', 'regalo', 'coleccion', 'miniaturas');
    const aroma = String(a.aroma || '').toLowerCase();
    if (aroma === 'dulce')
        hints.push('vainilla', 'ambar', 'caramelo', 'gourmand', 'tonka');
    if (aroma === 'fresco')
        hints.push('fresco', 'limpio', 'acuatico', 'verde', 'aromatico');
    if (aroma === 'amaderado')
        hints.push('madera', 'cedro', 'sandal', 'vetiver', 'oud');
    if (aroma === 'floral')
        hints.push('floral', 'jazmin', 'rosa', 'azahar', 'peonia');
    if (aroma === 'citrico')
        hints.push('citrico', 'limon', 'bergamota', 'mandarina', 'naranja');
    if (aroma === 'oriental')
        hints.push('especias', 'incienso', 'ambar', 'vainilla', 'resina');
    const intensity = String(a.intensity || '').toLowerCase();
    if (intensity === 'suave')
        hints.push('suave', 'ligero', 'sutil');
    if (intensity === 'moderada')
        hints.push('equilibrado', 'versatil');
    if (intensity === 'fuerte')
        hints.push('intenso', 'proyeccion', 'larga duracion');
    const occasion = String(a.occasion || '').toLowerCase();
    if (occasion === 'diario')
        hints.push('diario', 'versatil');
    if (occasion === 'trabajo')
        hints.push('elegante', 'limpio', 'no invasivo');
    if (occasion === 'fiesta')
        hints.push('noche', 'seductor', 'intenso');
    if (occasion === 'citas')
        hints.push('romantico', 'sensual');
    if (occasion === 'eventos')
        hints.push('sofisticado', 'lujo');
    const climate = String(a.climate || '').toLowerCase();
    if (climate === 'calido')
        hints.push('calido', 'fresco', 'citrico', 'acuatico');
    if (climate === 'templado')
        hints.push('templado', 'versatil');
    if (climate === 'frio')
        hints.push('frio', 'ambar', 'vainilla', 'amaderado');
    return unique(hints);
};
const computeHeuristicScore = (p, tokens, preferGenero) => {
    const haystack = normalizeText(`${p.nombre} ${p.descripcion || ''} ${p.notas_olfativas || ''} ${p.categoria_nombre || ''} ${p.genero || ''}`);
    let score = 0;
    for (const t of tokens) {
        if (!t || t.length < 3)
            continue;
        if (haystack.includes(t))
            score += 1;
    }
    const vend = Number(p.unidades_vendidas || 0);
    if (Number.isFinite(vend) && vend > 0)
        score += Math.min(4, vend / 50);
    const pref = normalizeGenero(preferGenero);
    const pg = normalizeGenero(p.genero);
    if (pref && pg) {
        if (pg === pref)
            score += 2.8;
        else if (pg === 'unisex')
            score += 0.6;
        else
            score -= 1.2;
    }
    return score;
};
const selectCandidates = async (opts) => {
    const hasCategories = await detectCategoriesSchema();
    const hasCasa = await detectProductCasaSchema();
    const canJoin = hasCategories && hasCasa;
    const join = canJoin ? 'LEFT JOIN categorias c ON c.slug = p.casa' : '';
    const categorySelect = canJoin ? ', c.nombre AS categoria_nombre, c.slug AS categoria_slug' : '';
    const idRead = await productIdReadExpr();
    const whereParts = ['p.stock > 0'];
    const params = [];
    const pref = normalizeGenero(opts.preferGenero);
    if (pref && pref !== 'unisex') {
        const aliases = generoAliases(pref);
        // Incluir genero preferido (con aliases) + unisex + nulos como fallback
        const placeholders = aliases.map(() => '?').join(', ');
        whereParts.push(`(LOWER(p.genero) IN (${placeholders}) OR LOWER(p.genero) IN ('unisex','mix','mixto') OR p.genero IS NULL)`);
        params.push(...aliases);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const baseSelect = `SELECT ${idRead} AS id, p.nombre AS name, p.nombre, p.genero, p.descripcion AS description, p.descripcion,
                p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock,
                p.unidades_vendidas AS soldCount, p.unidades_vendidas, p.imagen_url AS imageUrl, p.imagen_url${categorySelect}
         FROM productos p
         ${join}
         ${whereSql}`;
    // Mezclar candidatos: top vendidos + mas nuevos (evita siempre los mismos 6)
    const [soldRows] = await database_1.pool.query(`${baseSelect}
         ORDER BY COALESCE(p.unidades_vendidas, 0) DESC, p.creado_en DESC
         LIMIT 140`, params);
    const [newRows] = await database_1.pool.query(`${baseSelect}
         ORDER BY p.creado_en DESC
         LIMIT 140`, params);
    const out = [];
    const seen = new Set();
    for (const r of (soldRows || [])) {
        const id = String(r?.id || '').trim();
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        out.push(r);
    }
    for (const r of (newRows || [])) {
        const id = String(r?.id || '').trim();
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        out.push(r);
    }
    return out;
};
const safeParseJsonObject = (raw) => {
    const s = String(raw || '').trim();
    if (!s)
        return null;
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first < 0 || last < 0 || last <= first)
        return null;
    const slice = s.slice(first, last + 1);
    try {
        return JSON.parse(slice);
    }
    catch {
        return null;
    }
};
const runAiRanking = async (payload) => {
    if (!GROQ_API_KEY)
        return null;
    if (!payload.candidates?.length)
        return [];
    const system = 'Eres un asesor experto en perfumeria de lujo para e-commerce. Devuelve SOLO JSON valido, sin markdown. ' +
        'No inventes productos; solo puedes recomendar IDs presentes en candidates. ' +
        'Maximo 6 recomendaciones. reasons deben ser cortas, concretas y en tono positivo (no uses negaciones tipo "no es" / "no cumple"). ' +
        'Si el usuario indica hombre/mujer, prioriza ese genero y evita recomendar genero opuesto (usa unisex solo si hace falta).';
    const candidatesLite = payload.candidates.slice(0, 25).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        genero: p.genero,
        categoria_nombre: p.categoria_nombre || null,
        precio: Number(p.precio || 0),
        notas_olfativas: (p.notas_olfativas || '').slice(0, 140),
        descripcion: (p.descripcion || '').slice(0, 100)
    }));
    const user = {
        mode: payload.mode,
        user_text: payload.user_text,
        quiz_answers: payload.quiz_answers || null,
        base_product: payload.base_product || null,
        candidates: candidatesLite
    };
    const prompt = 'Analiza user_text y/o quiz_answers y devuelve un ranking de perfumes. ' +
        'Formato exacto:\n' +
        '{"recommendations":[{"id":"<uuid>","rank":1,"reasons":["...","..."],"short_explanation":"..."}]}' +
        '\nReglas:\n' +
        '- rank empieza en 1\n' +
        '- reasons: 2 a 4 bullets cortos (sin emojis)\n' +
        '- short_explanation: max 140 caracteres\n' +
        '- solo IDs existentes\n' +
        '- no repitas perfumes\n' +
        '- evita razones negativas; si no hay match perfecto, explica por que es la mejor opcion disponible\n';
    const resp = await openai.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt + '\nINPUT:\n' + JSON.stringify(user) }
        ],
        temperature: 0.3,
        max_tokens: 600
    });
    const content = resp.choices?.[0]?.message?.content || '';
    if (!content) {
        console.warn('[AI] Respuesta vacía de Groq');
        return null;
    }
    const parsed = safeParseJsonObject(content);
    if (!parsed) {
        console.warn('[AI] Error parseando JSON de Groq:', content.slice(0, 100));
        return null;
    }
    const list = parsed?.recommendations;
    if (!Array.isArray(list)) {
        console.warn('[AI] El campo recommendations no es un array');
        return null;
    }
    const seen = new Set();
    const items = [];
    for (const it of list) {
        const id = String(it?.id || '').trim();
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        const reasons = Array.isArray(it?.reasons) ? it.reasons.map((r) => String(r).trim()).filter(Boolean).slice(0, 4) : [];
        const short = String(it?.short_explanation || '').trim();
        const rank = Math.max(1, Math.trunc(Number(it?.rank || items.length + 1)));
        items.push({ id, rank, reasons, short_explanation: short });
        if (items.length >= 6)
            break;
    }
    return items;
};
const recordEvent = async (req, event_type, payload, session_id) => {
    try {
        const ok = await detectRecoEventsSchema();
        if (!ok)
            return;
        const ua = String(req.headers['user-agent'] || '').slice(0, 800);
        await database_1.pool.query('INSERT INTO recomendacioneventos (usuario_id, session_id, event_type, payload, user_agent) VALUES (?, ?, ?, ?, ?)', [null, session_id || null, event_type, payload ? JSON.stringify(payload) : null, ua || null]);
    }
    catch {
        // ignore
    }
};
const buildResponse = (candidatesById, reco) => {
    const out = [];
    let rank = 1;
    for (const it of reco) {
        const p = candidatesById.get(it.id);
        if (!p)
            continue;
        out.push({
            rank: it.rank || rank,
            reasons: it.reasons || [],
            short_explanation: it.short_explanation || '',
            product: {
                id: p.id,
                name: p.name || p.nombre,
                nombre: p.nombre || p.name,
                price: Number(p.price || p.precio || 0),
                precio: Number(p.precio || p.price || 0),
                imageUrl: p.imageUrl || p.imagen_url,
                imagen_url: p.imagen_url || p.imageUrl,
                notes: p.notes || p.notas_olfativas,
                notas_olfativas: p.notas_olfativas || p.notes,
                genero: p.genero,
                categoria_nombre: p.categoria_nombre || null,
                categoria_slug: p.categoria_slug || null
            }
        });
        rank++;
    }
    return out;
};
const recommendFromQuiz = async (req, res) => {
    try {
        const session_id = String(req.body?.session_id || '').trim() || undefined;
        const answers = req.body?.answers || {};
        const preferGenero = normalizeGenero(String(answers?.for_who || '').trim()) || null;
        let candidates = await selectCandidates({ preferGenero });
        if (!candidates.length && preferGenero && preferGenero !== 'unisex') {
            candidates = await selectCandidates({});
        }
        const baseTokens = unique([
            ...tokenize(req.body?.free_text || ''),
            ...buildKeywordHintsFromQuiz(answers)
        ]);
        const scored = candidates
            .map((p) => ({ p, s: computeHeuristicScore(p, baseTokens, preferGenero) }))
            .sort((a, b) => b.s - a.s)
            .slice(0, 50);
        const top = scored.map((x) => x.p);
        const candidatesById = new Map(top.map((p) => [p.id, p]));
        const userText = `Respuestas quiz: ${JSON.stringify(answers)}`;
        const ai = await runAiRanking({ mode: 'quiz', user_text: userText, quiz_answers: answers, candidates: top });
        const fallbackReco = scored.slice(0, 6).map((x, idx) => ({
            id: x.p.id,
            rank: idx + 1,
            reasons: ['Compatible con tus preferencias', 'Basado en notas y descripcion'],
            short_explanation: 'Seleccionado por afinidad con tu perfil',
            score: x.s
        }));
        let reco = (ai && ai.length) ? ai : fallbackReco;
        // Validar IDs: el modelo a veces devuelve IDs invalidos.
        const valid = (reco || []).filter((it) => candidatesById.has(String(it?.id || '').trim()));
        if (!valid.length) {
            reco = fallbackReco;
        }
        else {
            // Completar hasta 6 con fallback si hace falta
            const seen = new Set(valid.map((x) => String(x.id)));
            const fill = fallbackReco.filter((x) => !seen.has(String(x.id)));
            reco = valid.concat(fill).slice(0, 6);
        }
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
            reco = preferred.concat(unisex, other).slice(0, 6);
        }
        res.status(200).json({
            mode: 'quiz',
            recommendations: buildResponse(candidatesById, reco).slice(0, 6)
        });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'No se pudo generar recomendacion' });
    }
};
exports.recommendFromQuiz = recommendFromQuiz;
const recommendFromFreeText = async (req, res) => {
    try {
        const session_id = String(req.body?.session_id || '').trim() || undefined;
        const query = String(req.body?.query || '').trim();
        const preferGenero = inferPreferGeneroFromText(query);
        const tokens = unique(tokenize(query));
        let candidates = await selectCandidates({ preferGenero });
        if (!candidates.length && preferGenero && preferGenero !== 'unisex') {
            candidates = await selectCandidates({});
        }
        const scored = candidates
            .map((p) => ({ p, s: computeHeuristicScore(p, tokens, preferGenero) }))
            .sort((a, b) => b.s - a.s)
            .slice(0, 50);
        const top = scored.map((x) => x.p);
        const candidatesById = new Map(top.map((p) => [p.id, p]));
        const ai = await runAiRanking({ mode: 'free', user_text: query, candidates: top });
        const fallbackReco = scored.slice(0, 6).map((x, idx) => ({
            id: x.p.id,
            rank: idx + 1,
            reasons: ['Coincide con tu busqueda', 'Basado en notas y descripcion'],
            short_explanation: 'Seleccionado por afinidad con tu descripcion',
            score: x.s
        }));
        let reco = (ai && ai.length) ? ai : fallbackReco;
        const valid = (reco || []).filter((it) => candidatesById.has(String(it?.id || '').trim()));
        if (!valid.length) {
            reco = fallbackReco;
        }
        else {
            const seen = new Set(valid.map((x) => String(x.id)));
            const fill = fallbackReco.filter((x) => !seen.has(String(x.id)));
            reco = valid.concat(fill).slice(0, 6);
        }
        if (preferGenero && preferGenero !== 'unisex') {
            const withGenero = reco.map((it) => ({
                it,
                g: normalizeGenero(candidatesById.get(it.id)?.genero)
            }));
            const preferred = withGenero.filter((x) => x.g === preferGenero).map((x) => x.it);
            const unisex = withGenero.filter((x) => x.g === 'unisex' || x.g == null).map((x) => x.it);
            const other = withGenero.filter((x) => x.g && x.g !== preferGenero && x.g !== 'unisex').map((x) => x.it);
            reco = preferred.concat(unisex, other).slice(0, 6);
        }
        recordEvent(req, 'free_query', { query, tokens: tokens.slice(0, 40), candidates: top.length }, session_id);
        res.status(200).json({
            mode: 'free',
            recommendations: buildResponse(candidatesById, reco).slice(0, 6)
        });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'No se pudo generar recomendacion' });
    }
};
exports.recommendFromFreeText = recommendFromFreeText;
const recommendSimilar = async (req, res) => {
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
        const [rows] = await database_1.pool.query(`SELECT ${idRead} AS id, p.nombre AS name, p.nombre, p.genero, p.descripcion AS description, p.descripcion,
                    p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                    p.unidades_vendidas AS soldCount, p.unidades_vendidas, p.imagen_url AS imageUrl, p.imagen_url${categorySelect}
             FROM productos p
             ${join}
             WHERE p.id = ${idWhere}
             LIMIT 1`, [productId]);
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
        const candidatesById = new Map(top.map((p) => [p.id, p]));
        const ai = await runAiRanking({ mode: 'similar', user_text: 'Perfumes similares', base_product: base, candidates: top });
        const fallbackReco = scored.slice(0, 6).map((x, idx) => ({
            id: x.p.id,
            rank: idx + 1,
            reasons: ['Similar por notas/estilo', 'Misma categoria o perfil cercano'],
            short_explanation: 'Alternativa similar',
            score: x.s
        }));
        let reco = (ai && ai.length) ? ai : fallbackReco;
        const valid = (reco || []).filter((it) => candidatesById.has(String(it?.id || '').trim()));
        if (!valid.length) {
            reco = fallbackReco;
        }
        else {
            const seen = new Set(valid.map((x) => String(x.id)));
            const fill = fallbackReco.filter((x) => !seen.has(String(x.id)));
            reco = valid.concat(fill).slice(0, 6);
        }
        recordEvent(req, 'similar', { base_product_id: base.id, candidates: top.length }, session_id);
        res.status(200).json({
            base_product: {
                id: base.id,
                nombre: base.nombre
            },
            recommendations: buildResponse(candidatesById, reco).slice(0, 6)
        });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'No se pudo generar recomendacion' });
    }
};
exports.recommendSimilar = recommendSimilar;
const recordRecommendationEvent = async (req, res) => {
    try {
        const session_id = String(req.body?.session_id || '').trim() || undefined;
        const event_type = String(req.body?.event_type || '').trim();
        const payload = req.body?.payload;
        await recordEvent(req, event_type, payload, session_id);
        res.status(200).json({ ok: true });
    }
    catch {
        res.status(200).json({ ok: true });
    }
};
exports.recordRecommendationEvent = recordRecommendationEvent;
