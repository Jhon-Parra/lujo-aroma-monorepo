"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstagramMedia = void 0;
const database_1 = require("../config/database");
let igCache = null;
let igCacheToken = null;
let igCacheHandle = null;
let igTokenColumnReady = null;
const detectInstagramTokenColumn = async () => {
    if (igTokenColumnReady !== null)
        return igTokenColumnReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'configuracionglobal'
                  AND column_name = 'instagram_access_token'
            ) AS ok`);
        igTokenColumnReady = !!rows?.[0]?.ok;
        return igTokenColumnReady;
    }
    catch {
        igTokenColumnReady = false;
        return false;
    }
};
const extractInstagramHandle = (urlRaw) => {
    const raw = (urlRaw || '').trim();
    if (!raw)
        return null;
    const noProto = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    if (noProto.startsWith('@'))
        return noProto.slice(1) || null;
    const match = noProto.match(/instagram\.com\/([^/?#]+)/i);
    if (match?.[1])
        return match[1];
    // if user stored just "handle"
    if (!noProto.includes('/'))
        return noProto;
    return null;
};
const loadInstagramConfig = async () => {
    // 1) DB token (admin configurable)
    try {
        const hasTokenCol = await detectInstagramTokenColumn();
        if (hasTokenCol) {
            const [rows] = await database_1.pool.query('SELECT instagram_access_token, instagram_url FROM configuracionglobal WHERE id = 1');
            const token = String(rows?.[0]?.instagram_access_token || '').trim();
            const handle = extractInstagramHandle(String(rows?.[0]?.instagram_url || ''));
            if (token)
                return { token, handle };
            // if token missing, still return handle for better fallbacks
            return { token: '', handle };
        }
    }
    catch {
        // ignore (columna puede no existir)
    }
    // 2) Env token
    return { token: (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim(), handle: null };
};
const parseGraphErrorMessage = async (response) => {
    try {
        const data = await response.json();
        const msg = data?.error?.message;
        if (typeof msg === 'string' && msg.trim())
            return msg;
    }
    catch {
        // ignore
    }
    try {
        const text = await response.text();
        if (text && text.length < 220)
            return text;
    }
    catch {
        // ignore
    }
    return `HTTP ${response.status}`;
};
const fetchInstagramBusinessMedia = async (token, limit, preferredHandle) => {
    // Si el token no es de Facebook/Business, esta llamada suele fallar.
    const base = 'https://graph.facebook.com/v20.0';
    const pagesUrl = new URL(`${base}/me/accounts`);
    pagesUrl.searchParams.set('fields', 'id,name');
    pagesUrl.searchParams.set('access_token', token);
    const pagesResp = await fetch(pagesUrl.toString());
    if (!pagesResp.ok) {
        return null;
    }
    const pagesData = await pagesResp.json();
    const pages = Array.isArray(pagesData?.data) ? pagesData.data : [];
    if (pages.length === 0)
        return [];
    const candidates = [];
    for (const p of pages) {
        const pageId = String(p?.id || '').trim();
        if (!pageId)
            continue;
        const igUrl = new URL(`${base}/${pageId}`);
        igUrl.searchParams.set('fields', 'instagram_business_account');
        igUrl.searchParams.set('access_token', token);
        const igResp = await fetch(igUrl.toString());
        if (!igResp.ok)
            continue;
        const igData = await igResp.json();
        const igId = String(igData?.instagram_business_account?.id || '').trim();
        if (igId)
            candidates.push({ pageId, igId });
    }
    if (candidates.length === 0)
        return [];
    let selectedIgId = candidates[0].igId;
    if (preferredHandle) {
        for (const c of candidates) {
            const u = new URL(`${base}/${c.igId}`);
            u.searchParams.set('fields', 'username');
            u.searchParams.set('access_token', token);
            const r = await fetch(u.toString());
            if (!r.ok)
                continue;
            const d = await r.json();
            const username = String(d?.username || '').trim();
            if (username && username.toLowerCase() === preferredHandle.toLowerCase()) {
                selectedIgId = c.igId;
                break;
            }
        }
    }
    const mediaUrl = new URL(`${base}/${selectedIgId}/media`);
    mediaUrl.searchParams.set('fields', 'id,caption,media_url,permalink,thumbnail_url,media_type,timestamp');
    mediaUrl.searchParams.set('access_token', token);
    mediaUrl.searchParams.set('limit', String(limit));
    const mediaResp = await fetch(mediaUrl.toString());
    if (!mediaResp.ok) {
        return [];
    }
    const mediaData = await mediaResp.json();
    const items = Array.isArray(mediaData?.data) ? mediaData.data : [];
    return items;
};
const getInstagramMedia = async (req, res) => {
    try {
        const cfg = await loadInstagramConfig();
        const token = cfg.token;
        const preferredHandle = cfg.handle;
        const limit = Math.min(Math.max(Number(req.query['limit'] || 12) || 12, 1), 50);
        if (!token) {
            const payload = {
                enabled: false,
                items: [],
                message: 'Instagram no está configurado.'
            };
            res.status(200).json(payload);
            return;
        }
        const now = Date.now();
        // Si cambió el token, invalida cache
        if (igCacheToken !== token || igCacheHandle !== preferredHandle) {
            igCache = null;
            igCacheToken = token;
            igCacheHandle = preferredHandle;
        }
        if (igCache && igCache.expiresAt > now) {
            const payload = {
                enabled: true,
                items: igCache.items.slice(0, limit)
            };
            res.status(200).json(payload);
            return;
        }
        // 1) Intentar con Instagram Graph API (Business)
        const businessItems = await fetchInstagramBusinessMedia(token, limit, preferredHandle);
        if (businessItems !== null) {
            igCache = { expiresAt: now + 10 * 60 * 1000, items: businessItems };
            igCacheToken = token;
            igCacheHandle = preferredHandle;
            const payload = { enabled: true, items: businessItems.slice(0, limit) };
            res.status(200).json(payload);
            return;
        }
        // 2) Fallback: Instagram Basic Display (si el token lo soporta)
        const url = new URL('https://graph.instagram.com/me/media');
        url.searchParams.set('fields', 'id,caption,media_url,permalink,thumbnail_url,media_type,timestamp');
        url.searchParams.set('access_token', token);
        url.searchParams.set('limit', String(limit));
        const response = await fetch(url.toString());
        if (!response.ok) {
            const msg = await parseGraphErrorMessage(response);
            console.error('Instagram API error:', response.status, msg);
            const payload = {
                enabled: true,
                items: [],
                message: 'No se pudo obtener el feed de Instagram. Revisa token/permisos.'
            };
            res.status(200).json(payload);
            return;
        }
        const data = await response.json();
        const items = Array.isArray(data?.data) ? data.data : [];
        // Cache 10 minutes
        igCache = {
            expiresAt: now + 10 * 60 * 1000,
            items
        };
        igCacheToken = token;
        igCacheHandle = preferredHandle;
        const payload = {
            enabled: true,
            items: items.slice(0, limit)
        };
        res.status(200).json(payload);
    }
    catch (error) {
        console.error('Error fetching Instagram media:', error);
        const payload = {
            enabled: true,
            items: [],
            message: 'Error consultando Instagram.'
        };
        res.status(200).json(payload);
    }
};
exports.getInstagramMedia = getInstagramMedia;
