import nodemailer from 'nodemailer';
import { pool } from '../config/database';
import { decryptString } from '../utils/encryption.util';

type MailOptions = {
    to: string;
    subject: string;
    html?: string;
    text?: string;
};

export type SendEmailResult = {
    success: boolean;
    skipped?: boolean;
    messageId?: string;
    from?: string;
    error?: string;
};

let transporter: nodemailer.Transporter | null = null;
let warnedNotConfigured = false;
let smtpCache: { expiresAt: number; value: SmtpConfig | null } | null = null;
let smtpColsReady: boolean | null = null;
let lastTransportKey = '';

type SenderConfig = {
    from: string;
    replyTo?: string;
    bccOrders?: string;
};

type SmtpConfig = {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    source: 'db' | 'env';
};

let senderCache: { expiresAt: number; value: SenderConfig | null } | null = null;
let senderColsReady: boolean | null = null;

const detectSenderColumns = async (): Promise<boolean> => {
    if (senderColsReady !== null) return senderColsReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) AS cnt
             FROM information_schema.columns
             WHERE table_name = 'configuracionglobal'
               AND column_name IN ('email_from_name','email_from_address','email_reply_to','email_bcc_orders')`
        );
        senderColsReady = Number(rows?.[0]?.cnt || 0) >= 4;
        return senderColsReady;
    } catch {
        senderColsReady = false;
        return false;
    }
};

const parseEmailList = (raw: string | null | undefined): string[] => {
    const value = String(raw || '').trim();
    if (!value) return [];
    return value
        .split(/\s|,|;/)
        .map((s) => s.trim())
        .filter(Boolean);
};

const buildFrom = (name: string | null | undefined, address: string | null | undefined, fallback: string): string => {
    const n = String(name || '').trim();
    const a = String(address || '').trim();
    if (a) {
        if (n) return `${n} <${a}>`;
        return a;
    }
    return fallback;
};

const resolveSenderConfig = async (fallbackFrom?: string): Promise<SenderConfig> => {
    const now = Date.now();
    if (senderCache && senderCache.expiresAt > now && senderCache.value) {
        return senderCache.value;
    }

    const baseFrom = String(fallbackFrom || process.env.SMTP_FROM || '').trim();
    const fallback: SenderConfig = { from: baseFrom };

    const colsReady = await detectSenderColumns();
    if (!colsReady) {
        // Use env-level BCC if available (e.g. EMAIL_BCC_ORDERS=ventas@perfumissimocol.com)
        const envBcc = String(process.env.EMAIL_BCC_ORDERS || '').trim() || undefined;
        const value: SenderConfig = { from: baseFrom, bccOrders: envBcc };
        senderCache = { expiresAt: now + 5 * 60 * 1000, value };
        return value;
    }

    try {
        const [rows] = await pool.query<any[]>(
            `SELECT email_from_name, email_from_address, email_reply_to, email_bcc_orders
             FROM configuracionglobal WHERE id = 1`
        );

        const r = rows?.[0] || {};
        const from = buildFrom(r.email_from_name, r.email_from_address, baseFrom);
        const replyTo = String(r.email_reply_to || '').trim() || undefined;
        // DB value takes precedence; fall back to env
        const bccRaw = String(r.email_bcc_orders || '').trim() || process.env.EMAIL_BCC_ORDERS || '';
        const bccOrders = parseEmailList(bccRaw).join(',') || undefined;

        const value: SenderConfig = { from, replyTo, bccOrders };
        senderCache = { expiresAt: now + 5 * 60 * 1000, value };
        return value;
    } catch {
        senderCache = { expiresAt: now + 2 * 60 * 1000, value: fallback };
        return fallback;
    }
};

const detectSmtpColumns = async (): Promise<boolean> => {
    if (smtpColsReady !== null) return smtpColsReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) AS cnt
             FROM information_schema.columns
             WHERE table_name = 'configuracionglobal'
               AND column_name IN (
                 'smtp_host','smtp_port','smtp_secure','smtp_user','smtp_from',
                 'smtp_pass_enc','smtp_pass_iv','smtp_pass_tag'
               )`
        );
        smtpColsReady = Number(rows?.[0]?.cnt || 0) >= 8;
        return smtpColsReady;
    } catch {
        smtpColsReady = false;
        return false;
    }
};

const resolveSmtpConfig = async (): Promise<SmtpConfig | null> => {
    const now = Date.now();
    if (smtpCache && smtpCache.expiresAt > now) {
        return smtpCache.value;
    }

    const envConfig: SmtpConfig | null = (() => {
        const host = String(process.env.SMTP_HOST || '').trim();
        const port = Number(process.env.SMTP_PORT || 587);
        const secure = String(process.env.SMTP_SECURE || '').trim() === 'true';
        const user = String(process.env.SMTP_USER || '').trim();
        const pass = String(process.env.SMTP_PASS || '').trim();
        const from = String(process.env.SMTP_FROM || '').trim();
        if (!host || !user || !pass || !from) return null;
        return { host, port, secure, user, pass, from, source: 'env' };
    })();

    const colsReady = await detectSmtpColumns();
    if (!colsReady) {
        smtpCache = { expiresAt: now + 2 * 60 * 1000, value: envConfig };
        return envConfig;
    }

    try {
        const [rows] = await pool.query<any[]>(
            `SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from,
                    smtp_pass_enc, smtp_pass_iv, smtp_pass_tag
             FROM configuracionglobal WHERE id = 1`
        );
        const r = rows?.[0] || {};
        const host = String(r.smtp_host || '').trim();
        const user = String(r.smtp_user || '').trim();
        const from = String(r.smtp_from || '').trim();
        const port = Number(r.smtp_port || 587);
        const secure = r.smtp_secure === true || String(r.smtp_secure).trim() === 'true';
        let pass = '';
        if (r.smtp_pass_enc && r.smtp_pass_iv && r.smtp_pass_tag) {
            try {
                pass = decryptString({ enc: r.smtp_pass_enc, iv: r.smtp_pass_iv, tag: r.smtp_pass_tag });
            } catch (e: any) {
                console.warn('[email] No se pudo descifrar smtp_pass:', e?.message || e);
            }
        }

        const dbConfig = host && user && from && pass
            ? { host, port, secure, user, pass, from, source: 'db' as const }
            : null;

        smtpCache = { expiresAt: now + 2 * 60 * 1000, value: dbConfig || envConfig };
        return dbConfig || envConfig;
    } catch {
        smtpCache = { expiresAt: now + 2 * 60 * 1000, value: envConfig };
        return envConfig;
    }
};

const getTransporter = (config: SmtpConfig): nodemailer.Transporter => {
    const key = `${config.host}|${config.port}|${config.secure}|${config.user}|${config.pass}`;
    if (transporter && lastTransportKey === key) return transporter;

    transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.pass }
    });
    lastTransportKey = key;
    return transporter;
};

export const sendEmail = async (options: MailOptions): Promise<SendEmailResult> => {
    const smtp = await resolveSmtpConfig();
    if (!smtp) {
        // No romper el flujo de pedidos si no hay SMTP
        if (!warnedNotConfigured) {
            warnedNotConfigured = true;
            console.warn('[email] SMTP no configurado. Omitiendo envio de correos. Configura SMTP en el panel o en .env');
        }
        return { success: false, skipped: true };
    }

    const sender = await resolveSenderConfig(smtp.from);
    const t = getTransporter(smtp);
    try {
        console.log(`[EmailService] Intentando enviar correo a: ${options.to} con asunto: "${options.subject}"`);
        const info = await t.sendMail({
            from: sender.from,
            to: options.to,
            replyTo: sender.replyTo,
            bcc: sender.bccOrders,
            subject: options.subject,
            html: options.html || undefined,
            text: options.text || undefined
        });
        console.log(`[EmailService] ✅ Correo enviado exitosamente a ${options.to}. MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId, from: sender.from };
    } catch (err: any) {
        console.error(`[EmailService] ❌ Falla crítica al enviar correo a ${options.to}. Detalle:`, err?.message || err);
        // No lanzamos (re-throw) el error para evitar que el request HTTP de checkout devuelva 500
        // y el usuario piense que la orden falló por culpa del correo.
        return { success: false, error: err?.message || String(err), from: sender.from };
    }
};
