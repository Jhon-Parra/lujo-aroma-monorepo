import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';

type SourceRow = {
    id?: string;
    nombre?: string;
    image_url?: string;
};

const envCandidates = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend/.env')
];

for (const p of envCandidates) {
    const r = dotenv.config({ path: p });
    if (!r.error) break;
}

const API_BASE = String(process.env.PRODUCTS_API_BASE || 'https://api.perfumesbogota.com/api').replace(/\/$/, '');
const API_ORIGIN = String(process.env.PRODUCTS_API_ORIGIN || 'https://perfumesbogota.com').trim();

const parseArg = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const arg = process.argv.find((a) => a.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : undefined;
};

const sourcePathArg = parseArg('source');
const concurrencyArg = Number(parseArg('concurrency') || '1');
const removeBgArg = String(parseArg('remove-bg') || 'true').toLowerCase() !== 'false';

if (!sourcePathArg) {
    throw new Error('Missing --source=/absolute/or/relative/path.csv');
}

const sourcePath = path.resolve(process.cwd(), sourcePathArg);
const concurrency = Math.max(1, Math.min(6, Math.trunc(concurrencyArg)));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const token = (() => {
    const existing = String(process.env.PRODUCTS_API_TOKEN || '').trim();
    if (existing) return existing;
    const secret = String(process.env.PRODUCTS_API_JWT_SECRET || process.env.JWT_SECRET || 'change_me').trim();
    return jwt.sign(
        { id: 'image-bot', email: 'bot@lujoyaroma.local', rol: 'SUPERADMIN', sub: 'image-bot', isLocal: true },
        secret,
        { expiresIn: '8h' }
    );
})();

const normalize = (s: string): string => String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const parseCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (ch === ',' && !inQuotes) {
            out.push(cur);
            cur = '';
            continue;
        }
        cur += ch;
    }
    out.push(cur);
    return out.map((v) => v.trim());
};

const readSourceCsv = async (filePath: string): Promise<SourceRow[]> => {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];

    const headers = parseCsvLine(lines[0]).map((h) => normalize(h).replace(/\s+/g, '_'));
    const rows: SourceRow[] = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const row: any = {};
        for (let j = 0; j < headers.length; j++) row[headers[j]] = cols[j] || '';
        const id = String(row.id || row.product_id || '').trim();
        const nombre = String(row.nombre || row.name || row.product_name || '').trim();
        const image_url = String(row.image_url || row.imagen_url || row.url || '').trim();
        if (!image_url) continue;
        rows.push({ id: id || undefined, nombre: nombre || undefined, image_url });
    }

    return rows;
};

const fetchCatalog = async (): Promise<any[]> => {
    const out: any[] = [];
    let page = 1;
    const limit = 200;

    while (true) {
        const url = `${API_BASE}/products/catalog?page=${page}&limit=${limit}&q=`;
        const res = await fetch(url, { headers: { Origin: API_ORIGIN } });
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!items.length) break;
        out.push(...items);
        if (page >= Number(data?.totalPages || 1)) break;
        page += 1;
    }

    return out;
};

const removeWhiteBackgroundToPng = async (input: Buffer): Promise<Buffer> => {
    const { data, info } = await sharp(input)
        .rotate()
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: false })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const white = Math.min(r, g, b);
        if (white >= 248) data[i + 3] = 0;
        else if (white >= 230) data[i + 3] = Math.min(data[i + 3], Math.max(0, (248 - white) * 14));
    }

    return await sharp(data, {
        raw: { width: info.width, height: info.height, channels: info.channels }
    }).png({ compressionLevel: 9 }).toBuffer();
};

const updateProductImage = async (id: string, name: string, imageBuffer: Buffer): Promise<void> => {
    const filename = `${normalize(name).replace(/\s+/g, '-').slice(0, 80) || 'product'}.png`;

    for (let attempt = 1; attempt <= 4; attempt++) {
        const form = new FormData();
        form.append('imagen', new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }), filename);

        const res = await fetch(`${API_BASE}/products/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                Origin: API_ORIGIN
            },
            body: form
        });

        if (res.ok) return;

        if (res.status === 429) {
            await wait(18000);
            continue;
        }

        const text = await res.text().catch(() => '');
        if (attempt === 4) throw new Error(`Update failed (${res.status}): ${text.slice(0, 220)}`);
        await wait(1500 * attempt);
    }
};

const run = async (): Promise<void> => {
    const sourceRows = await readSourceCsv(sourcePath);
    if (!sourceRows.length) throw new Error('No rows found in source CSV');

    const catalog = await fetchCatalog();
    const byId = new Map<string, any>();
    const byName = new Map<string, any>();

    for (const p of catalog) {
        const id = String(p?.id || '').trim();
        const nm = normalize(String(p?.nombre || p?.name || ''));
        if (id) byId.set(id, p);
        if (nm && !byName.has(nm)) byName.set(nm, p);
    }

    const tasks = sourceRows.map((row) => {
        if (row.id && byId.has(row.id)) return { row, product: byId.get(row.id) };
        const nm = normalize(String(row.nombre || ''));
        if (nm && byName.has(nm)) return { row, product: byName.get(nm) };
        return null;
    }).filter(Boolean) as Array<{ row: SourceRow; product: any }>;

    console.log(`CSV rows: ${sourceRows.length}`);
    console.log(`Matched products: ${tasks.length}`);
    console.log(`remove-bg: ${removeBgArg}`);

    let cursor = 0;
    let ok = 0;
    let failed = 0;

    const workers = Array.from({ length: concurrency }).map(async (_, wi) => {
        while (cursor < tasks.length) {
            const current = cursor;
            cursor += 1;
            const { row, product } = tasks[current];
            const id = String(product.id);
            const name = String(product.nombre || product.name || id);

            try {
                const res = await fetch(String(row.image_url));
                if (!res.ok) throw new Error(`source ${res.status}`);
                const raw = Buffer.from(await res.arrayBuffer());
                const buffer = removeBgArg ? await removeWhiteBackgroundToPng(raw) : raw;

                await updateProductImage(id, name, buffer);
                ok += 1;
                console.log(`[W${wi + 1}] OK ${current + 1}/${tasks.length} ${name}`);
            } catch (error: any) {
                failed += 1;
                console.error(`[W${wi + 1}] FAIL ${current + 1}/${tasks.length} ${name}: ${String(error?.message || error)}`);
            }
        }
    });

    await Promise.all(workers);
    console.log(`Finished. success=${ok} failed=${failed}`);
};

run().catch((e) => {
    console.error('Fatal:', e?.message || e);
    process.exit(1);
});
