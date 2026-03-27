import { pool } from '../config/database';
import { decryptString } from '../utils/encryption.util';

type WompiEnv = 'sandbox' | 'production';

type WompiMerchantResponse = {
    data?: {
        presigned_acceptance?: {
            acceptance_token?: string;
            permalink?: string;
            type?: string;
        };
        name?: string;
    };
};

export type WompiPseBank = {
    financial_institution_code: string;
    financial_institution_name: string;
};

type WompiPseBanksResponse = {
    data?: WompiPseBank[];
};

type WompiCreateTransactionResponse = {
    data?: {
        id?: string;
        status?: string;
        payment_method?: {
            extra?: {
                async_payment_url?: string;
            };
        };
    };
};

type WompiGetTransactionResponse = {
    data?: {
        id?: string;
        status?: string;
        reference?: string;
        amount_in_cents?: number;
        currency?: string;
    };
};

const baseUrlForEnv = (env: WompiEnv): string => {
    return env === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
};

type WompiRuntimeConfig = { env: WompiEnv; publicKey: string; apiKey: string; baseUrl: string; hasPrivateKey: boolean };

let cachedCfg: WompiRuntimeConfig | null = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

const normalizeEnv = (raw: any): WompiEnv => {
    const v = String(raw || '').trim().toLowerCase();
    return v === 'production' ? 'production' : 'sandbox';
};

const getEnvVar = (name: string): string => {
    const underscored = name.toUpperCase();
    const clean = name.replace(/_/g, '').toUpperCase();
    return String(process.env[underscored] || process.env[clean] || '').trim();
};

const resolveConfig = async (): Promise<WompiRuntimeConfig> => {
    const now = Date.now();
    if (cachedCfg && now - cachedAt < CACHE_MS) return cachedCfg;

    const envFromProcess = normalizeEnv(getEnvVar('WOMPI_ENV') || 'sandbox');
    const publicFromProcess = getEnvVar('WOMPI_PUBLIC_KEY');
    const privateFromProcess = getEnvVar('WOMPI_PRIVATE_KEY');
    if (publicFromProcess) {
        const apiKey = privateFromProcess || publicFromProcess;
        cachedCfg = {
            env: envFromProcess,
            publicKey: publicFromProcess,
            apiKey,
            baseUrl: baseUrlForEnv(envFromProcess),
            hasPrivateKey: !!privateFromProcess
        };
        cachedAt = now;
        return cachedCfg;
    }

    // Fallback: leer desde configuracionglobal (si existe)
    try {
        const result = await pool.query<any[]>(
            'SELECT wompi_env, wompi_public_key, wompi_private_key_enc, wompi_private_key_iv, wompi_private_key_tag FROM configuracionglobal WHERE id = 1'
        );
        const rows = (result as any)?.[0] || (result as any)?.rows || result;
        const row = Array.isArray(rows) ? rows[0] : undefined;

        const env = normalizeEnv(row?.wompi_env);
        const publicKey = String(row?.wompi_public_key || '').trim();

        const enc = String(row?.wompi_private_key_enc || '').trim();
        const iv = String(row?.wompi_private_key_iv || '').trim();
        const tag = String(row?.wompi_private_key_tag || '').trim();

        let privateKey = '';
        if (enc && iv && tag) {
            privateKey = decryptString({ enc, iv, tag });
        }

        const apiKey = privateKey || publicKey;

        if (!publicKey) {
            throw new Error('WOMPI_PUBLIC_KEY no esta configurado');
        }
        if (!apiKey) {
            throw new Error('WOMPI API key no esta configurado');
        }

        cachedCfg = {
            env,
            publicKey,
            apiKey,
            baseUrl: baseUrlForEnv(env),
            hasPrivateKey: !!privateKey
        };
        cachedAt = now;
        return cachedCfg;
    } catch (e: any) {
        const msg = String(e?.message || '').trim();
        if (msg.startsWith('SETTINGS_ENCRYPTION_KEY')) {
            throw new Error(msg);
        }
        if (msg.startsWith('WOMPI_')) {
            throw new Error(msg);
        }
        throw new Error('WOMPI_PUBLIC_KEY no esta configurado');
    }
};

export const WompiService = {
    async getClientConfig(): Promise<{ env: WompiEnv; public_key: string; base_url: string }> {
        const cfg = await resolveConfig();
        return { env: cfg.env, public_key: cfg.publicKey, base_url: cfg.baseUrl };
    },

    async hasPrivateKey(): Promise<boolean> {
        const cfg = await resolveConfig();
        return !!cfg.hasPrivateKey;
    },

    async getMerchant(): Promise<{ acceptance_token: string; permalink: string; name?: string }>
    {
        const cfg = await resolveConfig();
        const url = `${cfg.baseUrl}/merchants/${encodeURIComponent(cfg.publicKey)}`;
        const resp = await fetch(url, { method: 'GET' });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi merchant error (${resp.status}): ${text}`);
        }
        const json = (await resp.json()) as WompiMerchantResponse;
        const token = String(json?.data?.presigned_acceptance?.acceptance_token || '').trim();
        const permalink = String(json?.data?.presigned_acceptance?.permalink || '').trim();
        if (!token || !permalink) {
            throw new Error('Respuesta Wompi invalida: falta acceptance_token/permalink');
        }
        return { acceptance_token: token, permalink, name: json?.data?.name };
    },

    async getPseBanks(): Promise<WompiPseBank[]> {
        const cfg = await resolveConfig();
        const url = `${cfg.baseUrl}/pse/financial_institutions`;
        const resp = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${cfg.apiKey}`
            }
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi banks error (${resp.status}): ${text}`);
        }
        const json = (await resp.json()) as WompiPseBanksResponse;
        const banks = Array.isArray(json?.data) ? json.data : [];
        return banks
            .filter((b) => b && b.financial_institution_code && b.financial_institution_name)
            .sort((a, b) => a.financial_institution_name.localeCompare(b.financial_institution_name, 'es'));
    },

    async createPseTransaction(input: {
        amount_in_cents: number;
        reference: string;
        customer_email: string;
        redirect_url: string;
        acceptance_token: string;
        user_type: '0' | '1';
        user_legal_id_type: string;
        user_legal_id: string;
        financial_institution_code: string;
        payment_description: string;
    }): Promise<{ transaction_id: string; async_payment_url: string; status?: string }> {
        const cfg = await resolveConfig();

        const url = `${cfg.baseUrl}/transactions`;
        const body = {
            amount_in_cents: input.amount_in_cents,
            currency: 'COP',
            acceptance_token: input.acceptance_token,
            reference: input.reference,
            customer_email: input.customer_email,
            redirect_url: input.redirect_url,
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
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi create transaction error (${resp.status}): ${text}`);
        }

        const json = (await resp.json()) as WompiCreateTransactionResponse;
        const txId = String(json?.data?.id || '').trim();
        const asyncUrl = String(json?.data?.payment_method?.extra?.async_payment_url || '').trim();
        if (!txId || !asyncUrl) {
            throw new Error('Respuesta Wompi invalida: falta transaction id o async_payment_url');
        }
        return { transaction_id: txId, async_payment_url: asyncUrl, status: json?.data?.status };
    }
    ,

    async createNequiTransaction(input: {
        amount_in_cents: number;
        reference: string;
        customer_email: string;
        acceptance_token: string;
        phone_number: string;
        payment_description: string;
    }): Promise<{ transaction_id: string; status?: string }> {
        const cfg = await resolveConfig();

        const url = `${cfg.baseUrl}/transactions`;
        const body = {
            amount_in_cents: input.amount_in_cents,
            currency: 'COP',
            acceptance_token: input.acceptance_token,
            reference: input.reference,
            customer_email: input.customer_email,
            payment_method: {
                type: 'NEQUI',
                phone_number: input.phone_number,
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
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi create transaction error (${resp.status}): ${text}`);
        }

        const json = (await resp.json()) as WompiCreateTransactionResponse;
        const txId = String(json?.data?.id || '').trim();
        if (!txId) {
            throw new Error('Respuesta Wompi invalida: falta transaction id');
        }
        return { transaction_id: txId, status: json?.data?.status };
    }
    ,

    async createCardTransaction(input: {
        amount_in_cents: number;
        reference: string;
        customer_email: string;
        redirect_url: string;
        acceptance_token: string;
        token: string;
        installments: number;
    }): Promise<{ transaction_id: string; status?: string }> {
        const cfg = await resolveConfig();

        const url = `${cfg.baseUrl}/transactions`;
        const body = {
            amount_in_cents: input.amount_in_cents,
            currency: 'COP',
            acceptance_token: input.acceptance_token,
            reference: input.reference,
            customer_email: input.customer_email,
            redirect_url: input.redirect_url,
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
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi create transaction error (${resp.status}): ${text}`);
        }

        const json = (await resp.json()) as WompiCreateTransactionResponse;
        const txId = String(json?.data?.id || '').trim();
        if (!txId) {
            throw new Error('Respuesta Wompi invalida: falta transaction id');
        }
        return { transaction_id: txId, status: json?.data?.status };
    }
    ,

    async getTransaction(transactionId: string): Promise<{ id: string; status: string; reference: string }>
    {
        const cfg = await resolveConfig();
        const id = String(transactionId || '').trim();
        if (!id) throw new Error('transaction id requerido');

        const url = `${cfg.baseUrl}/transactions/${encodeURIComponent(id)}`;
        const resp = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${cfg.apiKey}` }
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi get transaction error (${resp.status}): ${text}`);
        }
        const json = (await resp.json()) as WompiGetTransactionResponse;
        const tid = String(json?.data?.id || '').trim();
        const status = String(json?.data?.status || '').trim();
        const ref = String(json?.data?.reference || '').trim();
        if (!tid || !status || !ref) {
            throw new Error('Respuesta Wompi invalida en getTransaction');
        }
        return { id: tid, status, reference: ref };
    }
};
