"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const sharp_1 = __importDefault(require("sharp"));
const firebase_1 = require("../config/firebase");
const envCandidates = [
    path_1.default.resolve(__dirname, '../../.env'),
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(process.cwd(), 'backend/.env')
];
for (const p of envCandidates) {
    const r = dotenv_1.default.config({ path: p });
    if (!r.error)
        break;
}
const API_BASE = String(process.env.PRODUCTS_API_BASE || 'https://api.perfumesbogota.com/api').replace(/\/$/, '');
const API_ORIGIN = String(process.env.PRODUCTS_API_ORIGIN || 'https://perfumesbogota.com').trim();
const PRODUCTS_LIMIT = Math.max(1, Math.trunc(Number(process.env.PRODUCTS_JOB_LIMIT || '2000')));
const CONCURRENCY = Math.max(1, Math.min(8, Math.trunc(Number(process.env.PRODUCTS_JOB_CONCURRENCY || '2'))));
const ONLY_MISSING = String(process.env.PRODUCTS_JOB_ONLY_MISSING || 'true').toLowerCase() !== 'false';
const STATE_DIR = path_1.default.resolve(__dirname, '../../tmp');
const STATE_FILE = path_1.default.join(STATE_DIR, 'product-image-generation-state.json');
const REPORT_FILE = path_1.default.join(STATE_DIR, 'product-image-generation-report.json');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parseArg = (name) => {
    const prefix = `--${name}=`;
    const arg = process.argv.find((a) => a.startsWith(prefix));
    if (!arg)
        return undefined;
    return arg.slice(prefix.length);
};
const cliLimit = parseArg('limit');
const cliConcurrency = parseArg('concurrency');
const cliOnlyMissing = parseArg('only-missing');
const FINAL_LIMIT = cliLimit ? Math.max(1, Math.trunc(Number(cliLimit))) : PRODUCTS_LIMIT;
const FINAL_CONCURRENCY = cliConcurrency ? Math.max(1, Math.min(8, Math.trunc(Number(cliConcurrency)))) : CONCURRENCY;
const FINAL_ONLY_MISSING = cliOnlyMissing ? String(cliOnlyMissing).toLowerCase() !== 'false' : ONLY_MISSING;
const buildLocalToken = () => {
    const existing = String(process.env.PRODUCTS_API_TOKEN || '').trim();
    if (existing)
        return existing;
    const secret = String(process.env.PRODUCTS_API_JWT_SECRET || process.env.JWT_SECRET || 'change_me').trim();
    return jsonwebtoken_1.default.sign({
        id: 'image-bot',
        email: 'bot@lujoyaroma.local',
        rol: 'SUPERADMIN',
        sub: 'image-bot',
        isLocal: true
    }, secret, { expiresIn: '12h' });
};
const API_TOKEN = buildLocalToken();
const hasAnyImage = (p) => {
    const urls = [p.imagen_url, p.imageUrl, p.imagen_url_2, p.imageUrl2, p.imagen_url_3, p.imageUrl3];
    return urls.some((u) => typeof u === 'string' && u.trim().length > 0);
};
const slugify = (raw) => {
    const s = String(raw || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return s || 'perfume';
};
const hashSeed = (raw) => {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) {
        h ^= raw.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
};
const fetchJson = async (url, init) => {
    const res = await fetch(url, init);
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text);
};
const fetchCatalog = async (limit) => {
    const pageSize = 200;
    const products = [];
    let page = 1;
    while (products.length < limit) {
        const url = `${API_BASE}/products/catalog?page=${page}&limit=${pageSize}&q=`;
        const data = await fetchJson(url, {
            headers: {
                Origin: API_ORIGIN
            }
        });
        const items = Array.isArray(data?.items) ? data.items : [];
        if (items.length === 0)
            break;
        for (const item of items) {
            products.push(item);
            if (products.length >= limit)
                break;
        }
        const totalPages = Number(data?.totalPages || 1);
        if (page >= totalPages)
            break;
        page += 1;
    }
    return products;
};
const buildPrompt = (p) => {
    const name = String(p.nombre || p.name || 'Luxury perfume').trim();
    const house = String(p.casa || p.house || '').trim();
    const gender = String(p.genero || '').trim();
    const detailBits = [house ? `brand ${house}` : '', gender ? `${gender} fragrance` : 'premium fragrance']
        .filter(Boolean)
        .join(', ');
    return [
        'Ultra realistic studio product photo, ecommerce style, single perfume bottle only, centered composition, full bottle visible, no hands, no people, no extra objects.',
        `Product name: ${name}.`,
        detailBits ? `Details: ${detailBits}.` : '',
        'Clean white seamless background, soft shadow, high sharpness, professional lighting, luxury packaging, front-facing, no text overlays, no watermark.'
    ].filter(Boolean).join(' ');
};
const generateImageFromPrompt = async (p) => {
    const prompt = buildPrompt(p);
    const seed = hashSeed(`${p.id}:${p.nombre || p.name || ''}`);
    const model = 'flux';
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&model=${model}&nologo=true`;
    const res = await fetch(url, {
        headers: {
            Accept: 'image/*'
        }
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Image generation failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (!buf.length)
        throw new Error('Image generation returned empty buffer');
    return buf;
};
const removeWhiteBackgroundToPng = async (input) => {
    const resized = (0, sharp_1.default)(input)
        .rotate()
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: false })
        .ensureAlpha();
    const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const whiteScore = Math.min(r, g, b);
        if (whiteScore >= 248) {
            data[i + 3] = 0;
            continue;
        }
        if (whiteScore >= 230) {
            const current = data[i + 3];
            const alpha = Math.max(0, Math.min(255, (248 - whiteScore) * 14));
            data[i + 3] = Math.min(current, alpha);
        }
    }
    return await (0, sharp_1.default)(data, {
        raw: {
            width: info.width,
            height: info.height,
            channels: info.channels
        }
    })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();
};
const uploadPngToFirebase = async (product, pngBuffer) => {
    if (!firebase_1.bucket) {
        throw new Error('Firebase bucket is not configured');
    }
    const name = slugify(String(product.nombre || product.name || product.id));
    const destination = `products/generated-transparent/${name}-${product.id}.png`;
    const fileRef = firebase_1.bucket.file(destination);
    try {
        await fileRef.save(pngBuffer, {
            metadata: {
                contentType: 'image/png',
                cacheControl: 'public, max-age=31536000'
            },
            resumable: false,
            public: true
        });
        return `https://storage.googleapis.com/${firebase_1.bucket.name}/${destination}`;
    }
    catch {
        await fileRef.save(pngBuffer, {
            metadata: {
                contentType: 'image/png',
                cacheControl: 'public, max-age=31536000'
            },
            resumable: false
        });
        const tenYears = Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;
        const [signed] = await fileRef.getSignedUrl({ action: 'read', expires: tenYears });
        return signed;
    }
};
const parseRateLimitResetSeconds = (res) => {
    const line = String(res.headers.get('ratelimit') || '').trim();
    const m = line.match(/reset=(\d+)/i);
    if (!m)
        return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return n;
};
const updateProductImage = async (product, pngBuffer) => {
    const endpoint = `${API_BASE}/products/${encodeURIComponent(product.id)}`;
    const filename = `${slugify(String(product.nombre || product.name || 'perfume'))}.png`;
    for (let attempt = 1; attempt <= 5; attempt++) {
        const form = new FormData();
        const pngBytes = new Uint8Array(pngBuffer);
        form.append('imagen', new Blob([pngBytes], { type: 'image/png' }), filename);
        const res = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${API_TOKEN}`,
                Origin: API_ORIGIN
            },
            body: form
        });
        if (res.ok) {
            return;
        }
        if (res.status === 429) {
            const reset = parseRateLimitResetSeconds(res);
            const waitMs = (reset ? (reset + 2) * 1000 : 20_000);
            await wait(waitMs);
            continue;
        }
        const body = await res.text().catch(() => '');
        if (attempt >= 5) {
            throw new Error(`Update failed (${res.status}): ${body.slice(0, 300)}`);
        }
        await wait(2000 * attempt);
    }
};
const withRetries = async (fn, label, retries = 3) => {
    let lastError;
    for (let i = 1; i <= retries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (i < retries) {
                await wait(1200 * i);
            }
        }
    }
    throw new Error(`${label}: ${String(lastError?.message || lastError)}`);
};
const loadState = async () => {
    await promises_1.default.mkdir(STATE_DIR, { recursive: true });
    try {
        const raw = await promises_1.default.readFile(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.items)
            throw new Error('Invalid state file');
        return parsed;
    }
    catch {
        const now = new Date().toISOString();
        return {
            startedAt: now,
            updatedAt: now,
            totalCandidates: 0,
            completed: 0,
            failed: 0,
            items: {}
        };
    }
};
let persistQueue = Promise.resolve();
const saveState = async (state) => {
    persistQueue = persistQueue.then(async () => {
        state.updatedAt = new Date().toISOString();
        await promises_1.default.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
        await promises_1.default.writeFile(REPORT_FILE, JSON.stringify({
            startedAt: state.startedAt,
            updatedAt: state.updatedAt,
            totalCandidates: state.totalCandidates,
            completed: state.completed,
            failed: state.failed
        }, null, 2), 'utf8');
    });
    await persistQueue;
};
const run = async () => {
    if (!firebase_1.bucket) {
        throw new Error('Firebase bucket is not initialized. Check Firebase env vars.');
    }
    console.log('Starting product image generation pipeline...');
    console.log(`API: ${API_BASE}`);
    console.log(`Limit: ${FINAL_LIMIT}`);
    console.log(`Concurrency: ${FINAL_CONCURRENCY}`);
    console.log(`Only missing images: ${FINAL_ONLY_MISSING}`);
    const allProducts = await fetchCatalog(FINAL_LIMIT);
    const candidates = FINAL_ONLY_MISSING ? allProducts.filter((p) => !hasAnyImage(p)) : allProducts;
    console.log(`Fetched products: ${allProducts.length}`);
    console.log(`Candidates to process: ${candidates.length}`);
    const state = await loadState();
    state.totalCandidates = candidates.length;
    await saveState(state);
    let idx = 0;
    const workers = Array.from({ length: FINAL_CONCURRENCY }).map(async (_, workerIndex) => {
        while (idx < candidates.length) {
            const currentIndex = idx;
            idx += 1;
            const p = candidates[currentIndex];
            if (!p?.id)
                continue;
            const existing = state.items[p.id];
            if (existing?.status === 'completed') {
                continue;
            }
            const displayName = String(p.nombre || p.name || p.id).trim();
            const position = `${currentIndex + 1}/${candidates.length}`;
            console.log(`[W${workerIndex + 1}] ${position} -> ${displayName}`);
            try {
                const generated = await withRetries(() => generateImageFromPrompt(p), 'generateImageFromPrompt', 3);
                const png = await withRetries(() => removeWhiteBackgroundToPng(generated), 'removeWhiteBackgroundToPng', 2);
                const uploadedUrl = await withRetries(() => uploadPngToFirebase(p, png), 'uploadPngToFirebase', 3);
                await withRetries(() => updateProductImage(p, png), 'updateProductImage', 3);
                state.items[p.id] = {
                    status: 'completed',
                    imageUrl: uploadedUrl,
                    updatedAt: new Date().toISOString()
                };
                state.completed = Object.values(state.items).filter((x) => x.status === 'completed').length;
                state.failed = Object.values(state.items).filter((x) => x.status === 'failed').length;
                await saveState(state);
            }
            catch (error) {
                state.items[p.id] = {
                    status: 'failed',
                    error: String(error?.message || error),
                    updatedAt: new Date().toISOString()
                };
                state.completed = Object.values(state.items).filter((x) => x.status === 'completed').length;
                state.failed = Object.values(state.items).filter((x) => x.status === 'failed').length;
                await saveState(state);
                console.error(`[W${workerIndex + 1}] Failed ${displayName}: ${String(error?.message || error)}`);
            }
        }
    });
    await Promise.all(workers);
    console.log('Job finished.');
    console.log(`Completed: ${state.completed}`);
    console.log(`Failed: ${state.failed}`);
    console.log(`State file: ${STATE_FILE}`);
};
run().catch((error) => {
    console.error('Fatal error in image generation job:', error);
    process.exit(1);
});
