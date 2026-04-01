"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WompiService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const parseWompiErrorDetail = (body) => {
    const raw = String(body || '').trim();
    if (!raw)
        return '';
    try {
        const json = JSON.parse(raw);
        const err = json?.error;
        if (!err)
            return raw;
        const type = String(err?.type || '').trim();
        // Helper para traducir mensajes tecnicos de Wompi a lenguaje humano
        const translateMsg = (m) => {
            let msg = String(m || '');
            if (msg.includes('debe coincidir con el patron "^\\d{2}$"'))
                return 'debe tener exactamente 2 digitos (ej: 26)';
            if (msg.includes('debe coincidir con el patron "^\\d{4}$"'))
                return 'debe tener exactamente 4 digitos (ej: 2026)';
            if (msg.includes('no debe contener menos de')) {
                const num = msg.match(/\d+/);
                return `debe tener al menos ${num ? num[0] : 'varios'} caracteres`;
            }
            if (msg.includes('no es una fecha valida'))
                return 'no es una fecha valida';
            if (msg.includes('debe ser una de'))
                return 'tiene un valor no permitido';
            if (msg.includes('es obligatorio'))
                return 'es requerido';
            return msg;
        };
        // INPUT_VALIDATION_ERROR: contiene mensajes por campo
        if (type === 'INPUT_VALIDATION_ERROR' && err?.messages && typeof err.messages === 'object') {
            const fieldErrors = [];
            const FIELD_LABELS = {
                exp_year: 'Ano de vencimiento',
                exp_month: 'Mes de vencimiento',
                card_holder: 'Nombre en la tarjeta',
                number: 'Numero de tarjeta',
                cvc: 'Codigo de seguridad (CVC)',
                phone_number: 'Numero de telefono',
                financial_institution_code: 'Banco'
            };
            for (const [field, msgs] of Object.entries(err.messages)) {
                const label = FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                const list = Array.isArray(msgs) ? msgs : [msgs];
                list.forEach((m) => fieldErrors.push(`${label} ${translateMsg(m)}`));
            }
            if (fieldErrors.length) {
                return `Hay errores en los datos:\n• ${fieldErrors.join('\n• ')}`;
            }
        }
        // Resto de lógica de errores...
        if (type === 'UNAUTHORIZED' || err?.reason?.includes?.('llave')) {
            return 'Configuración de pago inválida (API Key).';
        }
        const parts = [err?.reason, err?.message].filter(Boolean);
        return parts.join(' | ') || type || raw;
    }
    catch {
        return raw;
    }
};
const deepFindStringByKey = (root, keys) => {
    const wanted = new Set(keys.map(k => String(k).toLowerCase()));
    const visited = new Set();
    const stack = [root];
    while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== 'object')
            continue;
        if (visited.has(cur))
            continue;
        visited.add(cur);
        for (const [k, v] of Object.entries(cur)) {
            if (typeof v === 'string') {
                if (wanted.has(String(k).toLowerCase()) && v.trim())
                    return v.trim();
            }
            else if (v && typeof v === 'object') {
                stack.push(v);
            }
        }
    }
    return '';
};
const baseUrlForEnv = (env) => {
    return env === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
};
let cachedCfg = null;
let cachedAt = 0;
const CACHE_MS = 60_000;
const normalizeEnv = (raw) => {
    const v = String(raw || '').trim().toLowerCase();
    return v === 'production' ? 'production' : 'sandbox';
};
const getEnvVar = (name) => {
    const underscored = name.toUpperCase();
    const clean = name.replace(/_/g, '').toUpperCase();
    // Hostinger and some panels might add _ENC or other suffixes
    const variants = [
        underscored,
        clean,
        `${underscored}_ENC`,
        `${clean}_ENC`,
        `${underscored}ENC`,
        `${clean}ENC`
    ];
    for (const v of variants) {
        const val = String(process.env[v] || '').trim();
        if (val)
            return val;
    }
    return '';
};
const resolveConfig = async () => {
    const now = Date.now();
    if (cachedCfg && now - cachedAt < CACHE_MS)
        return cachedCfg;
    const envFromProcess = normalizeEnv(getEnvVar('WOMPI_ENV') || 'sandbox');
    const publicFromProcess = getEnvVar('WOMPI_PUBLIC_KEY');
    const privateFromProcess = getEnvVar('WOMPI_PRIVATE_KEY');
    if (publicFromProcess) {
        const apiKey = privateFromProcess || publicFromProcess;
        const cfg = {
            env: envFromProcess,
            publicKey: publicFromProcess,
            apiKey,
            baseUrl: baseUrlForEnv(envFromProcess),
            hasPrivateKey: !!privateFromProcess
        };
        // Validar combinaciones tipicas (evita 401 confusos de Wompi)
        const pubKind = keyKind(cfg.publicKey);
        const apiKind = keyKind(cfg.apiKey);
        if (cfg.env === 'sandbox') {
            if (pubKind && pubKind !== 'pub_test') {
                throw new Error('WOMPI_ENV=sandbox requiere WOMPI_PUBLIC_KEY=pub_test_...');
            }
            if (cfg.hasPrivateKey && apiKind && apiKind !== 'prv_test') {
                throw new Error('WOMPI_ENV=sandbox requiere WOMPI_PRIVATE_KEY=prv_test_...');
            }
        }
        if (cfg.env === 'production') {
            if (pubKind && pubKind !== 'pub_prod') {
                throw new Error('WOMPI_ENV=production requiere WOMPI_PUBLIC_KEY=pub_prod_...');
            }
            if (cfg.hasPrivateKey && apiKind && apiKind !== 'prv_prod') {
                throw new Error('WOMPI_ENV=production requiere WOMPI_PRIVATE_KEY=prv_prod_...');
            }
        }
        cachedCfg = cfg;
        cachedAt = now;
        return cachedCfg;
    }
    // Solo se permite configurar Wompi por variables de entorno.
    throw new Error('WOMPI_PUBLIC_KEY no esta configurado');
};
const computeIntegritySignature = (reference, amountInCents, currency, secret) => {
    // Wompi integrity signature (sha256): reference + amount_in_cents + currency + integrity_secret
    const payload = `${reference}${amountInCents}${currency}${secret}`;
    return crypto_1.default.createHash('sha256').update(payload, 'utf8').digest('hex');
};
const getIntegritySecret = () => {
    // Not stored in DB currently; must be provided via env.
    return getEnvVar('WOMPI_INTEGRITY_SECRET');
};
const requirePrivateKey = async () => {
    const cfg = await resolveConfig();
    if (!cfg.hasPrivateKey) {
        // La llave privada es requerida para endpoints autenticados (transactions/banks).
        // La llave publica solo sirve para tokenizacion client-side y merchant info.
        throw new Error('WOMPI_PRIVATE_KEY no esta configurado');
    }
    return cfg;
};
const keyKind = (k) => {
    const v = String(k || '').trim();
    if (!v)
        return null;
    if (v.startsWith('pub_test_'))
        return 'pub_test';
    if (v.startsWith('pub_prod_'))
        return 'pub_prod';
    if (v.startsWith('prv_test_'))
        return 'prv_test';
    if (v.startsWith('prv_prod_'))
        return 'prv_prod';
    return 'unknown';
};
const fetchWithTimeout = async (url, init, timeoutMs) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), Math.max(200, timeoutMs || 0));
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    }
    finally {
        clearTimeout(t);
    }
};
exports.WompiService = {
    async getClientConfig() {
        const cfg = await resolveConfig();
        return { env: cfg.env, public_key: cfg.publicKey, base_url: cfg.baseUrl };
    },
    async hasPrivateKey() {
        const cfg = await resolveConfig();
        return !!cfg.hasPrivateKey;
    },
    async getMerchant() {
        const cfg = await resolveConfig();
        const url = `${cfg.baseUrl}/merchants/${encodeURIComponent(cfg.publicKey)}`;
        const resp = await fetch(url, { method: 'GET' });
        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            const detail = parseWompiErrorDetail(body) || body;
            throw new Error(`Wompi merchant error (${resp.status}): ${detail}`);
        }
        const json = (await resp.json());
        const token = String(json?.data?.presigned_acceptance?.acceptance_token || '').trim();
        const permalink = String(json?.data?.presigned_acceptance?.permalink || '').trim();
        if (!token || !permalink) {
            throw new Error('Respuesta Wompi invalida: falta acceptance_token/permalink');
        }
        return { acceptance_token: token, permalink, name: json?.data?.name };
    },
    async getPseBanks() {
        // Wompi PSE banks endpoint uses the PUBLIC key.
        const cfg = await resolveConfig();
        const url = `${cfg.baseUrl}/pse/financial_institutions`;
        const resp = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${cfg.publicKey}`
            }
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            const detail = parseWompiErrorDetail(body) || body;
            throw new Error(`Wompi banks error (${resp.status}): ${detail}`);
        }
        const json = (await resp.json());
        const banks = Array.isArray(json?.data) ? json.data : [];
        return banks
            .filter((b) => b && b.financial_institution_code && b.financial_institution_name)
            .sort((a, b) => a.financial_institution_name.localeCompare(b.financial_institution_name, 'es'));
    },
    async getDiagnostics() {
        const cfg = await resolveConfig();
        const envVars = {
            WOMPI_ENV: !!process.env.WOMPI_ENV,
            WOMPI_PUBLIC_KEY: !!process.env.WOMPI_PUBLIC_KEY,
            WOMPI_PRIVATE_KEY: !!process.env.WOMPI_PRIVATE_KEY,
            WOMPI_PRIVATE_KEY_ENC: !!process.env.WOMPI_PRIVATE_KEY_ENC,
            WOMPI_INTEGRITY_SECRET: !!process.env.WOMPI_INTEGRITY_SECRET,
            variants_found: []
        };
        const allPossible = [
            'WOMPI_ENV', 'WOMPIENV',
            'WOMPI_PUBLIC_KEY', 'WOMPIPUBLICKEY',
            'WOMPI_PRIVATE_KEY', 'WOMPIPRIVATEKEY',
            'WOMPI_PRIVATE_KEY_ENC', 'WOMPIPRIVATEKEYENC',
            'WOMPI_INTEGRITY_SECRET', 'WOMPIINTEGRITYSECRET'
        ];
        allPossible.forEach(k => { if (process.env[k])
            envVars.variants_found.push(k); });
        const publicKind = keyKind(cfg.publicKey);
        const apiKind = keyKind(cfg.apiKey);
        const banksProbe = { ok: false, status: 0, detail: '' };
        try {
            const url = `${cfg.baseUrl}/pse/financial_institutions`;
            const resp = await fetchWithTimeout(url, {
                method: 'GET',
                headers: { Authorization: `Bearer ${cfg.publicKey}` }
            }, 7000);
            banksProbe.status = resp.status;
            if (resp.ok) {
                banksProbe.ok = true;
            }
            else {
                const body = await resp.text().catch(() => '');
                let detail = body;
                try {
                    const json = JSON.parse(body);
                    detail = json?.error?.type || json?.error?.reason || json?.error?.message || body;
                }
                catch { /* raw */ }
                banksProbe.detail = String(detail || '').slice(0, 300);
            }
        }
        catch (e) {
            banksProbe.detail = String(e?.message || e || '').slice(0, 300);
        }
        const privateProbe = { ok: false, status: 0, detail: '' };
        if (cfg.hasPrivateKey) {
            try {
                const url = `${cfg.baseUrl}/transactions`;
                const resp = await fetchWithTimeout(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${cfg.apiKey}`
                    },
                    body: JSON.stringify({})
                }, 7000);
                privateProbe.status = resp.status;
                if (resp.status === 401) {
                    privateProbe.ok = false;
                    const body = await resp.text().catch(() => '');
                    privateProbe.detail = String(body || 'INVALID_ACCESS_TOKEN').slice(0, 300);
                }
                else {
                    // Any non-401 response indicates the key was accepted (even if request is invalid).
                    privateProbe.ok = true;
                }
            }
            catch (e) {
                privateProbe.detail = String(e?.message || e || '').slice(0, 300);
            }
        }
        else {
            privateProbe.detail = 'WOMPI_PRIVATE_KEY no configurado';
        }
        return {
            env: cfg.env,
            base_url: cfg.baseUrl,
            source: 'env',
            env_vars_present: envVars,
            public_key_kind: publicKind,
            public_key_len: (cfg.publicKey || '').length,
            has_private_key: !!cfg.hasPrivateKey,
            api_key_kind: apiKind,
            api_key_len: (cfg.apiKey || '').length,
            probes: {
                pse_banks: banksProbe,
                private_key_auth: privateProbe
            }
        };
    },
    async createPseTransaction(input) {
        const cfg = await requirePrivateKey();
        const integritySecret = getIntegritySecret();
        if (!integritySecret) {
            throw new Error('WOMPI_INTEGRITY_SECRET no esta configurado');
        }
        const url = `${cfg.baseUrl}/transactions`;
        const body = {
            amount_in_cents: input.amount_in_cents,
            currency: 'COP',
            acceptance_token: input.acceptance_token,
            reference: input.reference,
            customer_email: input.customer_email,
            redirect_url: input.redirect_url,
            signature: computeIntegritySignature(input.reference, input.amount_in_cents, 'COP', integritySecret),
            payment_method: {
                type: 'PSE',
                user_type: input.user_type,
                user_legal_id_type: input.user_legal_id_type,
                user_legal_id: input.user_legal_id,
                financial_institution_code: input.financial_institution_code,
                payment_description: input.payment_description
            }
        };
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${cfg.apiKey}`
            },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            const detail = parseWompiErrorDetail(body) || body;
            throw new Error(`Wompi error (${resp.status}): ${detail}`);
        }
        const raw = await resp.text().catch(() => '');
        let json = null;
        try {
            json = raw ? JSON.parse(raw) : null;
        }
        catch {
            // Some proxies may mangle response; include snippet.
            throw new Error(`Respuesta Wompi invalida: no es JSON (${raw.slice(0, 200)})`);
        }
        const txId = String(json?.data?.id || '').trim();
        // Wompi devuelve la URL de pago PSE en distintos lugares según el ambiente:
        // - Producción: json.data.payment_method.extra.async_payment_url
        // - Sandbox: json.data.redirect_url (payment_method.extra solo trae is_three_ds)
        // Buscamos en todos los lugares posibles.
        let asyncUrl = deepFindStringByKey(json?.data, ['async_payment_url', 'asyncPaymentUrl']);
        if (!asyncUrl && json?.data?.redirect_url) {
            asyncUrl = String(json.data.redirect_url).trim();
        }
        // Fallback: fetch transaction details to find async_payment_url.
        let fallbackErr = '';
        if (txId && !asyncUrl) {
            try {
                const tx = await this.getTransaction(txId);
                asyncUrl = String(tx?.async_payment_url || '').trim();
            }
            catch (e) {
                fallbackErr = String(e?.message || e || '');
                // ignore; we'll throw below with diagnostic
            }
        }
        if (!txId || !asyncUrl) {
            const missing = !txId ? 'transaction id' : 'async_payment_url';
            const extra = fallbackErr ? ` | fallback=${fallbackErr}` : '';
            const dataKeys = json?.data && typeof json.data === 'object' ? Object.keys(json.data).slice(0, 30) : [];
            const pm = json?.data?.payment_method;
            const pmKeys = pm && typeof pm === 'object' ? Object.keys(pm).slice(0, 30) : [];
            const pmExtra = pm?.extra;
            const extraKeys = pmExtra && typeof pmExtra === 'object' ? Object.keys(pmExtra).slice(0, 30) : [];
            const snippet = raw ? raw.slice(0, 200) : '';
            throw new Error(`Respuesta Wompi invalida: falta ${missing}${txId ? ` (txId=${txId})` : ''}${extra}` +
                ` | data_keys=${JSON.stringify(dataKeys)}` +
                ` | payment_method_keys=${JSON.stringify(pmKeys)}` +
                ` | payment_method_extra_keys=${JSON.stringify(extraKeys)}` +
                (snippet ? ` | snippet=${snippet}` : ''));
        }
        return { transaction_id: txId, async_payment_url: asyncUrl, status: json?.data?.status };
    },
    async createNequiTransaction(input) {
        const cfg = await requirePrivateKey();
        const integritySecret = getIntegritySecret();
        if (!integritySecret) {
            throw new Error('WOMPI_INTEGRITY_SECRET no esta configurado');
        }
        const url = `${cfg.baseUrl}/transactions`;
        const body = {
            amount_in_cents: input.amount_in_cents,
            currency: 'COP',
            acceptance_token: input.acceptance_token,
            reference: input.reference,
            customer_email: input.customer_email,
            redirect_url: input.redirect_url,
            signature: computeIntegritySignature(input.reference, input.amount_in_cents, 'COP', integritySecret),
            payment_method: {
                type: 'NEQUI',
                phone_number: input.phone_number,
                payment_description: input.payment_description
            }
        };
        console.log('Wompi Nequi Request:', {
            url,
            ref: body.reference,
            amount: body.amount_in_cents,
            email: body.customer_email,
            phone: body.payment_method.phone_number
        });
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${cfg.apiKey}`
            },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            const bodyText = await resp.text().catch(() => '');
            console.error('Wompi Nequi Failure:', {
                status: resp.status,
                url,
                ref: body.reference,
                hasKey: !!cfg.apiKey,
                errorBody: bodyText.substring(0, 500)
            });
            const detail = parseWompiErrorDetail(bodyText) || bodyText;
            throw new Error(`Wompi error (${resp.status}): ${detail}`);
        }
        const json = (await resp.json());
        const txId = String(json?.data?.id || '').trim();
        if (!txId) {
            throw new Error('Respuesta Wompi invalida: falta transaction id');
        }
        return { transaction_id: txId, status: json?.data?.status };
    },
    async createCardTransaction(input) {
        const cfg = await requirePrivateKey();
        const integritySecret = getIntegritySecret();
        if (!integritySecret) {
            throw new Error('WOMPI_INTEGRITY_SECRET no esta configurado');
        }
        const url = `${cfg.baseUrl}/transactions`;
        const body = {
            amount_in_cents: input.amount_in_cents,
            currency: 'COP',
            acceptance_token: input.acceptance_token,
            reference: input.reference,
            customer_email: input.customer_email,
            redirect_url: input.redirect_url,
            signature: computeIntegritySignature(input.reference, input.amount_in_cents, 'COP', integritySecret),
            payment_method: {
                type: 'CARD',
                installments: input.installments,
                token: input.token
            }
        };
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${cfg.apiKey}`
            },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            const detail = parseWompiErrorDetail(body) || body;
            throw new Error(`Wompi error (${resp.status}): ${detail}`);
        }
        const json = (await resp.json());
        const txId = String(json?.data?.id || '').trim();
        if (!txId) {
            throw new Error('Respuesta Wompi invalida: falta transaction id');
        }
        return { transaction_id: txId, status: json?.data?.status };
    },
    async getTransaction(transactionId) {
        const cfg = await requirePrivateKey();
        const id = String(transactionId || '').trim();
        if (!id)
            throw new Error('transaction id requerido');
        const url = `${cfg.baseUrl}/transactions/${encodeURIComponent(id)}`;
        const resp = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${cfg.apiKey}` }
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            const detail = parseWompiErrorDetail(body) || body;
            throw new Error(`Wompi get transaction error (${resp.status}): ${detail}`);
        }
        const json = (await resp.json());
        const tid = String(json?.data?.id || '').trim();
        const status = String(json?.data?.status || '').trim();
        const ref = String(json?.data?.reference || '').trim();
        const asyncUrl = deepFindStringByKey(json?.data, ['async_payment_url', 'asyncPaymentUrl']);
        if (!tid || !status || !ref) {
            throw new Error('Respuesta Wompi invalida en getTransaction');
        }
        return { id: tid, status, reference: ref, async_payment_url: asyncUrl || undefined };
    }
};
