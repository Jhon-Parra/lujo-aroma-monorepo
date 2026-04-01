"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOrderShippingEmail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const database_1 = require("../config/database");
let transporter = null;
let warnedNotConfigured = false;
let lastTransportKey = '';
const parseEmailList = (raw) => {
    const value = String(raw || '').trim();
    if (!value)
        return [];
    return value
        .split(/\s|,|;/)
        .map((s) => s.trim())
        .filter(Boolean);
};
const buildFrom = (name, address, fallback) => {
    const n = String(name || '').trim();
    const a = String(address || '').trim();
    if (a) {
        if (n)
            return `${n} <${a}>`;
        return a;
    }
    return fallback;
};
let senderDbCache = null;
const SENDER_DB_CACHE_MS = 60_000;
const resolveSenderDbConfig = async () => {
    const now = Date.now();
    if (senderDbCache && senderDbCache.expiresAt > now)
        return senderDbCache.value;
    try {
        const [rows] = await database_1.pool.query(`SELECT email_from_name, email_from_address, email_reply_to, email_bcc_orders
             FROM configuracionglobal
             WHERE id = 1
             LIMIT 1`);
        const row = rows?.[0] || {};
        const value = {
            email_from_name: row.email_from_name ?? null,
            email_from_address: row.email_from_address ?? null,
            email_reply_to: row.email_reply_to ?? null,
            email_bcc_orders: row.email_bcc_orders ?? null
        };
        senderDbCache = { value, expiresAt: now + SENDER_DB_CACHE_MS };
        return value;
    }
    catch {
        // DB might not have columns/migrations in some environments.
        const value = {};
        senderDbCache = { value, expiresAt: now + SENDER_DB_CACHE_MS };
        return value;
    }
};
const resolveSmtpConfig = async () => {
    const host = String(process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || '').trim() === 'true';
    const user = String(process.env.SMTP_USER || '').trim();
    const pass = String(process.env.SMTP_PASS || '').trim();
    const from = String(process.env.SMTP_FROM || '').trim();
    if (!host || !user || !pass || !from)
        return null;
    return { host, port, secure, user, pass, from };
};
const resolveSenderConfig = async (fallbackFrom) => {
    const baseFrom = String(fallbackFrom || process.env.SMTP_FROM || '').trim();
    const envReplyTo = String(process.env.EMAIL_REPLY_TO || '').trim() || undefined;
    const envBcc = parseEmailList(process.env.EMAIL_BCC_ORDERS).join(',') || undefined;
    const db = await resolveSenderDbConfig();
    const from = buildFrom(db.email_from_name, db.email_from_address, baseFrom);
    const replyTo = String(db.email_reply_to || '').trim() || envReplyTo;
    const bccOrders = parseEmailList(db.email_bcc_orders).join(',') || envBcc;
    return { from, replyTo, bccOrders };
};
const getTransporter = (config) => {
    const key = `${config.host}|${config.port}|${config.secure}|${config.user}|${config.pass}`;
    if (transporter && lastTransportKey === key)
        return transporter;
    transporter = nodemailer_1.default.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.pass },
        tls: {
            // Esto ayuda en algunos hostings (como Hostinger) si hay problemas de certificados o versiones de TLS
            rejectUnauthorized: false
        },
        greetingTimeout: 30000, // Aumentar a 30 segundos para evitar "Greeting never received"
        connectionTimeout: 30000, // Aumentar a 30 segundos
        socketTimeout: 30000 // Aumentar a 30 segundos
    });
    lastTransportKey = key;
    return transporter;
};
const sendEmail = async (options) => {
    const smtp = await resolveSmtpConfig();
    if (!smtp) {
        // No romper el flujo de pedidos si no hay SMTP
        if (!warnedNotConfigured) {
            warnedNotConfigured = true;
            console.warn('[email] SMTP no configurado. Omitiendo envio de correos. Configura SMTP en .env');
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
    }
    catch (err) {
        console.error(`[EmailService] ❌ Falla crítica al enviar correo a ${options.to}. Detalle:`, err?.message || err);
        // No lanzamos (re-throw) el error para evitar que el request HTTP de checkout devuelva 500
        // y el usuario piense que la orden falló por culpa del correo.
        return { success: false, error: err?.message || String(err), from: sender.from };
    }
};
exports.sendEmail = sendEmail;
const sendOrderShippingEmail = async (params) => {
    const { to, cliente_nombre, orden_id, transportadora, numero_guia, link_rastreo } = params;
    const pedidoRef = String(orden_id || '').slice(0, 8).toUpperCase();
    const rastreoLink = link_rastreo
        ? `<p style="margin-top:12px"><a href="${link_rastreo}" style="background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">🔍 Rastrear mi pedido</a></p>`
        : '';
    const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden">
          <div style="background:#1a1a1a;padding:24px;text-align:center">
            <h1 style="color:#e8c96a;margin:0;font-size:24px">Lujo&Aroma | Perfumes Bogotá</h1>
          </div>
          <div style="padding:32px">
            <h2 style="color:#1a1a1a;margin-top:0">🚚 ¡Tu pedido está en camino!</h2>
            <p>Hola <strong>${cliente_nombre}</strong>,</p>
            <p>Tu pedido <strong>#${pedidoRef}</strong> ha sido enviado y ya está en manos de la transportadora.</p>
            <div style="background:#f9f6f0;border-left:4px solid #e8c96a;padding:16px;border-radius:4px;margin:20px 0">
              <p style="margin:0 0 8px"><strong>Transportadora:</strong> ${transportadora}</p>
              <p style="margin:0"><strong>Número de guía:</strong> ${numero_guia}</p>
            </div>
            ${rastreoLink}
            <p style="color:#666;font-size:13px;margin-top:24px">Si tienes alguna pregunta, responde a este correo o contáctanos.</p>
          </div>
          <div style="background:#f5f5f5;padding:16px;text-align:center">
            <p style="color:#888;font-size:12px;margin:0">© ${new Date().getFullYear()} Lujo&Aroma | Perfumes Bogotá — perfumesbogota.com</p>
          </div>
        </div>`;
    await (0, exports.sendEmail)({ to, subject: `Tu pedido #${pedidoRef} ha sido enviado 🚚`, html });
};
exports.sendOrderShippingEmail = sendOrderShippingEmail;
