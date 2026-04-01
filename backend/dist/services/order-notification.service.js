"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOrderStatusChanged = exports.notifyOrderCreated = void 0;
const order_model_1 = require("../models/order.model");
const database_1 = require("../config/database");
const email_service_1 = require("./email.service");
const order_email_logs_service_1 = require("./order-email-logs.service");
const order_email_templates_service_1 = require("./order-email-templates.service");
const FRONTEND_URL = String(process.env.FRONTEND_URL || 'https://lujo_aromacol.com').replace(/\/$/, '');
const BRAND_NAME = 'Lujo&Aroma | Perfumes Bogotá';
let cachedLogoUrl = null;
const LOGO_CACHE_MS = 60_000;
const resolveLogoUrl = async () => {
    const now = Date.now();
    if (cachedLogoUrl && cachedLogoUrl.expiresAt > now)
        return cachedLogoUrl.value;
    // Prefer configured logo_url (often a PNG in Supabase) because many email clients
    // don't render SVG reliably.
    try {
        const [rows] = await database_1.pool.query(`SELECT logo_url
             FROM configuracionglobal
             WHERE id = 1
             LIMIT 1`);
        const url = String(rows?.[0]?.logo_url || '').trim();
        if (url) {
            cachedLogoUrl = { value: url, expiresAt: now + LOGO_CACHE_MS };
            return url;
        }
    }
    catch {
        // ignore
    }
    const fallback = `${FRONTEND_URL}/assets/images/logo.svg`;
    cachedLogoUrl = { value: fallback, expiresAt: now + LOGO_CACHE_MS };
    return fallback;
};
/** MariaDB JSON_ARRAYAGG devuelve strings — parsear siempre antes de usar */
const parseOrderJson = (val, fallback = []) => {
    if (!val)
        return fallback;
    if (typeof val === 'string') {
        try {
            return JSON.parse(val);
        }
        catch {
            return fallback;
        }
    }
    return val;
};
const statusLabel = (estado) => {
    const labels = {
        PAGADO: 'Pagado',
        ENVIADO: 'Enviado',
        ENTREGADO: 'Entregado',
        CANCELADO: 'Cancelado'
    };
    const key = String(estado || '').toUpperCase();
    if (key === 'PENDIENTE' || key === 'PROCESANDO')
        return 'Pagado';
    return labels[key] || estado;
};
const formatMoneyCop = (value) => {
    const n = Number(value || 0);
    try {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
    }
    catch {
        return String(n);
    }
};
const escapeHtml = (input) => {
    const s = String(input ?? '');
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
const escapeAttr = (input) => escapeHtml(String(input ?? '').replace(/\s+/g, ' ').trim());
const buildItemsRowsHtml = (items) => {
    const rows = (items || []).filter(Boolean).map((i) => {
        const name = escapeHtml(String(i.nombre || 'Producto'));
        const qty = Math.max(0, Math.trunc(Number(i.cantidad || 0)));
        const subtotal = formatMoneyCop(i.subtotal ?? (Number(i.precio_unitario || 0) * qty));
        return `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #f3efe4;color:#1b1b1b;font-size:13px;">
              <div style="font-weight:800;">${name}</div>
              <div style="color:#6b6456;font-size:12px;margin-top:3px;">${escapeHtml(formatMoneyCop(i.precio_unitario || 0))} c/u</div>
            </td>
            <td align="center" style="padding:12px 0;border-bottom:1px solid #f3efe4;color:#1b1b1b;font-size:13px;font-weight:800;">${qty}</td>
            <td align="right" style="padding:12px 0;border-bottom:1px solid #f3efe4;color:#1b1b1b;font-size:13px;font-weight:900;">${escapeHtml(subtotal)}</td>
          </tr>`;
    });
    return rows.join('') || `
      <tr>
        <td colspan="3" style="padding:12px 0;color:#6b6456;font-size:13px;">(Sin productos)</td>
      </tr>`;
};
const buildPaymentBlockHtml = (order) => {
    const metodo = String(order?.metodo_pago || '').trim();
    const canal = String(order?.canal_pago || '').trim();
    const estadoPago = String(order?.estado_pago || '').trim();
    const ref = String(order?.referencia_pago || order?.codigo_transaccion || '').trim();
    const parts = [];
    if (metodo)
        parts.push(`<strong style="color:#1b1b1b;">Metodo:</strong> ${escapeHtml(metodo)}`);
    if (canal)
        parts.push(`<strong style="color:#1b1b1b;">Canal:</strong> ${escapeHtml(canal)}`);
    if (estadoPago)
        parts.push(`<strong style="color:#1b1b1b;">Estado pago:</strong> ${escapeHtml(estadoPago)}`);
    if (ref)
        parts.push(`<strong style="color:#1b1b1b;">Referencia:</strong> ${escapeHtml(ref)}`);
    if (!parts.length)
        return '';
    return `
      <tr>
        <td colspan="2" style="padding-top:10px;font-size:12px;color:#6b6456;line-height:1.55;">
          ${parts.join(' &nbsp;·&nbsp; ')}
        </td>
      </tr>`;
};
const buildShippingBlockHtml = (order) => {
    const transportadora = String(order?.transportadora || '').trim();
    const guia = String(order?.numero_guia || '').trim();
    const link = String(order?.link_rastreo || '').trim();
    if (!transportadora && !guia && !link)
        return '';
    const linkHtml = link
        ? ` <a href="${escapeAttr(link)}" style="display:inline-block;margin-top:10px;background:#1b1b1b;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:800;font-size:12px;">Rastrear pedido</a>`
        : '';
    const lines = [];
    if (transportadora)
        lines.push(`<strong style="color:#1b1b1b;">Transportadora:</strong> ${escapeHtml(transportadora)}`);
    if (guia)
        lines.push(`<strong style="color:#1b1b1b;">Guia:</strong> ${escapeHtml(guia)}`);
    return `
      <tr>
        <td colspan="2" style="padding-top:10px;font-size:12px;color:#6b6456;line-height:1.55;">
          ${lines.join(' &nbsp;·&nbsp; ')}${linkHtml}
        </td>
      </tr>`;
};
const buildDeliveryBlockHtml = (status, order) => {
    if (status !== 'ENTREGADO')
        return '';
    const address = String(order?.direccion_envio || '').trim();
    if (!address)
        return '';
    return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;width:100%;margin-top:12px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:14px;">
        <tr>
          <td style="padding:14px 14px;font-family:Arial,sans-serif;">
            <div style="font-size:11px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#065f46;">Entrega confirmada</div>
            <div style="margin-top:8px;font-size:13px;line-height:1.5;color:#064e3b;">
              Tu pedido fue entregado en: <strong style="color:#052e16;">${escapeHtml(address)}</strong>
            </div>
          </td>
        </tr>
      </table>`;
};
const buildAddonsBlockHtml = (order) => {
    const rows = [];
    const subtotalProductos = Number(order?.subtotal_productos ?? 0);
    const discountAmount = Number(order?.cart_recovery_discount_amount ?? 0);
    const ep = order?.envio_prioritario ? Number(order?.costo_envio_prioritario || 0) : 0;
    const pl = order?.perfume_lujo ? Number(order?.costo_perfume_lujo || 0) : 0;
    const er = order?.empaque_regalo ? Number(order?.costo_empaque_regalo || 0) : 0;
    if (Number.isFinite(discountAmount) && discountAmount > 0) {
        rows.push(`<tr><td style="padding:6px 0;color:#6b6456;font-size:12px;">Descuento</td><td align="right" style="padding:6px 0;color:#b59a68;font-size:12px;font-weight:900;">-${escapeHtml(formatMoneyCop(discountAmount))}</td></tr>`);
    }
    if (Number.isFinite(ep) && ep > 0) {
        rows.push(`<tr><td style="padding:6px 0;color:#6b6456;font-size:12px;">Envio prioritario</td><td align="right" style="padding:6px 0;color:#1b1b1b;font-size:12px;font-weight:900;">${escapeHtml(formatMoneyCop(ep))}</td></tr>`);
    }
    if (Number.isFinite(pl) && pl > 0) {
        rows.push(`<tr><td style="padding:6px 0;color:#6b6456;font-size:12px;">Perfume de lujo</td><td align="right" style="padding:6px 0;color:#1b1b1b;font-size:12px;font-weight:900;">${escapeHtml(formatMoneyCop(pl))}</td></tr>`);
    }
    if (Number.isFinite(er) && er > 0) {
        rows.push(`<tr><td style="padding:6px 0;color:#6b6456;font-size:12px;">Empaque de regalo</td><td align="right" style="padding:6px 0;color:#1b1b1b;font-size:12px;font-weight:900;">${escapeHtml(formatMoneyCop(er))}</td></tr>`);
    }
    if (!rows.length)
        return '';
    return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
        ${rows.join('')}
      </table>`;
};
const buildItemsText = (items) => {
    return (items || [])
        .map((i) => `${String(i.nombre || '')} x${String(i.cantidad || '')} - ${formatMoneyCop(i.precio_unitario)}`)
        .join('\n');
};
const buildAddonsText = (order) => {
    const parts = [];
    if (order?.envio_prioritario) {
        parts.push(`Envio Prioritario: ${formatMoneyCop(order?.costo_envio_prioritario || 0)}`);
    }
    if (order?.perfume_lujo) {
        parts.push(`Perfume de Lujo: ${formatMoneyCop(order?.costo_perfume_lujo || 0)}`);
    }
    return parts.length ? parts.join('\n') : '';
};
const replaceTokens = (template, data) => {
    return String(template || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key) => {
        const k = String(key || '').toLowerCase();
        return data[k] !== undefined ? data[k] : '';
    });
};
const buildTemplatePayload = async (status, order) => {
    const fallback = order_email_templates_service_1.OrderEmailTemplateService.getDefaultTemplate(status);
    let template = fallback;
    try {
        template = await order_email_templates_service_1.OrderEmailTemplateService.getTemplate(status);
    }
    catch (e) {
        console.warn('[OrderEmailTemplates] No se pudo cargar plantilla personalizada, usando default:', e?.message || e);
        template = fallback;
    }
    const copy = order_email_templates_service_1.OrderEmailTemplateService.getStatusCopy(status);
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsText = buildItemsText(items);
    const addonsText = buildAddonsText(order);
    const shortId = String(order.id || '').slice(0, 8).toUpperCase();
    const statusLabelValue = statusLabel(status);
    const subtotalValue = order?.subtotal_productos !== undefined
        ? formatMoneyCop(order?.subtotal_productos || 0)
        : formatMoneyCop(order?.total || 0);
    const common = {
        order_id: String(order.id || ''),
        order_short_id: shortId,
        order_status: String(status || ''),
        order_status_label: statusLabelValue,
        customer_name: String(order?.cliente_nombre || '').trim(),
        customer_email: String(order?.cliente_email || '').trim(),
        shipping_address: String(order?.direccion_envio || '').trim(),
        order_total: formatMoneyCop(order?.total || 0),
        order_subtotal: subtotalValue,
        status_headline: copy.headline,
        status_message: copy.message
    };
    const year = String(new Date().getFullYear());
    const paymentBlockHtml = buildPaymentBlockHtml(order);
    const shippingBlockHtml = buildShippingBlockHtml(order);
    const deliveryBlockHtml = buildDeliveryBlockHtml(status, order);
    const itemsRowsHtml = buildItemsRowsHtml(items);
    const addonsBlockHtml = buildAddonsBlockHtml(order);
    const discountAmount = Number(order?.cart_recovery_discount_amount ?? 0);
    const discountRowHtml = Number.isFinite(discountAmount) && discountAmount > 0
        ? `<tr><td style="padding-top:10px;color:#6b6456;font-size:12px;">Descuento</td><td align="right" style="padding-top:10px;color:#b59a68;font-size:12px;font-weight:900;">-${escapeHtml(formatMoneyCop(discountAmount))}</td></tr>`
        : '';
    const primaryCtaHtml = (() => {
        // Nota: no incluimos enlace directo al pedido (requiere auth). En su lugar, dejamos un CTA a promociones/catalogo.
        const href = `${FRONTEND_URL}/catalog`;
        const label = status === 'ENVIADO' && String(order?.link_rastreo || '').trim() ? 'Rastrear pedido' : 'Ver catalogo';
        const finalHref = (status === 'ENVIADO' && String(order?.link_rastreo || '').trim()) ? String(order.link_rastreo).trim() : href;
        return `
          <div style="margin-top:16px;">
            <a href="${escapeAttr(finalHref)}" style="display:inline-block;background:#b59a68;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:900;font-family:Arial,sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(label)}</a>
          </div>`;
    })();
    const logoUrl = await resolveLogoUrl();
    const textMap = {
        ...common,
        items_text: itemsText,
        addons_text: addonsText,
        transportadora: String(order?.transportadora || '').trim(),
        numero_guia: String(order?.numero_guia || '').trim(),
        link_rastreo: String(order?.link_rastreo || '').trim(),
        year,
        brand_name: BRAND_NAME,
        store_url: FRONTEND_URL,
        logo_url: logoUrl
    };
    // Para HTML: escapar todos los tokens de texto para evitar inyeccion via direccion/nombres.
    const htmlTextMap = Object.keys(textMap).reduce((acc, key) => {
        acc[key] = escapeHtml(textMap[key]);
        return acc;
    }, {});
    // URLs en atributos
    htmlTextMap.store_url = escapeAttr(FRONTEND_URL);
    htmlTextMap.logo_url = escapeAttr(logoUrl);
    htmlTextMap.link_rastreo = escapeAttr(String(order?.link_rastreo || '').trim());
    const htmlMap = {
        ...htmlTextMap,
        // HTML blocks (already escaped/safe)
        payment_block_html: paymentBlockHtml,
        shipping_block_html: shippingBlockHtml,
        delivery_block_html: deliveryBlockHtml,
        items_rows_html: itemsRowsHtml,
        addons_block_html: addonsBlockHtml,
        discount_row_html: discountRowHtml,
        primary_cta_html: primaryCtaHtml
    };
    const subjectTemplate = template.subject || fallback.subject;
    const textTemplate = template.body_text || fallback.body_text;
    const htmlTemplate = String(template.body_html || '').trim() ? template.body_html : fallback.body_html;
    return {
        subject: replaceTokens(subjectTemplate, textMap),
        text: replaceTokens(textTemplate, textMap),
        html: replaceTokens(htmlTemplate, htmlMap)
    };
};
const notifyOrderCreated = async (orderId) => {
    const orderRaw = await order_model_1.OrderModel.getAdminOrderById(orderId);
    if (!orderRaw?.cliente_email)
        return;
    const order = { ...orderRaw, items: parseOrderJson(orderRaw.items, []).filter((i) => i?.producto_id), historial: parseOrderJson(orderRaw.historial, []) };
    const status = order_email_templates_service_1.OrderEmailTemplateService.normalizeStatus(order.estado) || 'PAGADO';
    const payload = await buildTemplatePayload(status, order);
    const result = await (0, email_service_1.sendEmail)({
        to: order.cliente_email,
        subject: payload.subject,
        text: payload.text,
        html: payload.html
    });
    if (!result.skipped) {
        await order_email_logs_service_1.OrderEmailLogsService.logSend({
            orderId: String(order.id),
            status,
            to: order.cliente_email,
            from: result.from || null,
            subject: payload.subject,
            success: result.success,
            errorMessage: result.error || null
        });
    }
};
exports.notifyOrderCreated = notifyOrderCreated;
const notifyOrderStatusChanged = async (orderId, newStatus) => {
    const orderRaw = await order_model_1.OrderModel.getAdminOrderById(orderId);
    if (!orderRaw?.cliente_email)
        return;
    const order = { ...orderRaw, items: parseOrderJson(orderRaw.items, []).filter((i) => i?.producto_id), historial: parseOrderJson(orderRaw.historial, []) };
    const status = order_email_templates_service_1.OrderEmailTemplateService.normalizeStatus(newStatus) || 'PAGADO';
    const payload = await buildTemplatePayload(status, order);
    const result = await (0, email_service_1.sendEmail)({
        to: order.cliente_email,
        subject: payload.subject,
        text: payload.text,
        html: payload.html
    });
    if (!result.skipped) {
        await order_email_logs_service_1.OrderEmailLogsService.logSend({
            orderId: String(order.id),
            status,
            to: order.cliente_email,
            from: result.from || null,
            subject: payload.subject,
            success: result.success,
            errorMessage: result.error || null
        });
    }
};
exports.notifyOrderStatusChanged = notifyOrderStatusChanged;
