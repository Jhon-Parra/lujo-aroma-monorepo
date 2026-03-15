import { OrderModel } from '../models/order.model';
import { sendEmail, SendEmailResult } from './email.service';
import { OrderEmailLogsService } from './order-email-logs.service';
import { OrderEmailTemplateService, OrderEmailStatus } from './order-email-templates.service';

const statusLabel = (estado: string): string => {
    const labels: Record<string, string> = {
        PENDIENTE: 'Pendiente',
        PAGADO: 'Pagado',
        PROCESANDO: 'Procesando',
        ENVIADO: 'Enviado',
        ENTREGADO: 'Entregado',
        CANCELADO: 'Cancelado'
    };
    return labels[estado] || estado;
};

const formatMoneyCop = (value: any): string => {
    const n = Number(value || 0);
    try {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
    } catch {
        return String(n);
    }
};

const buildItemsText = (items: any[]): string => {
    return (items || [])
        .map((i: any) => `${String(i.nombre || '')} x${String(i.cantidad || '')} - ${formatMoneyCop(i.precio_unitario)}`)
        .join('\n');
};

const buildAddonsText = (order: any): string => {
    const parts: string[] = [];
    if (order?.envio_prioritario) {
        parts.push(`Envio Prioritario: ${formatMoneyCop(order?.costo_envio_prioritario || 0)}`);
    }
    if (order?.perfume_lujo) {
        parts.push(`Perfume de Lujo: ${formatMoneyCop(order?.costo_perfume_lujo || 0)}`);
    }
    return parts.length ? parts.join('\n') : '';
};

const replaceTokens = (template: string | null | undefined, data: Record<string, string>): string => {
    return String(template || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key) => {
        const k = String(key || '').toLowerCase();
        return data[k] !== undefined ? data[k] : '';
    });
};

const buildTemplatePayload = async (status: OrderEmailStatus, order: any) => {
    const fallback = OrderEmailTemplateService.getDefaultTemplate(status);
    let template = fallback;
    try {
        template = await OrderEmailTemplateService.getTemplate(status);
    } catch (e: any) {
        console.warn('[OrderEmailTemplates] No se pudo cargar plantilla personalizada, usando default:', e?.message || e);
        template = fallback;
    }
    const copy = OrderEmailTemplateService.getStatusCopy(status);

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsText = buildItemsText(items);
    const addonsText = buildAddonsText(order);

    const shortId = String(order.id || '').slice(0, 8).toUpperCase();
    const statusLabelValue = statusLabel(status);
    const subtotalValue = order?.subtotal_productos !== undefined
        ? formatMoneyCop(order?.subtotal_productos || 0)
        : formatMoneyCop(order?.total || 0);

    const common: Record<string, string> = {
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

    const textMap: Record<string, string> = {
        ...common,
        items_text: itemsText,
        addons_text: addonsText
    };

    const subjectTemplate = template.subject || fallback.subject;
    const textTemplate = template.body_text || fallback.body_text;

    return {
        subject: replaceTokens(subjectTemplate, textMap),
        text: replaceTokens(textTemplate, textMap)
    };
};

export const notifyOrderCreated = async (orderId: string): Promise<void> => {
    const order = await OrderModel.getAdminOrderById(orderId);
    if (!order?.cliente_email) return;
    const status = OrderEmailTemplateService.normalizeStatus(order.estado) || 'PENDIENTE';
    const payload = await buildTemplatePayload(status, order);
    const result = await sendEmail({
        to: order.cliente_email,
        subject: payload.subject,
        text: payload.text
    });

    if (!result.skipped) {
        await OrderEmailLogsService.logSend({
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

export const notifyOrderStatusChanged = async (orderId: string, newStatus: string): Promise<void> => {
    const order = await OrderModel.getAdminOrderById(orderId);
    if (!order?.cliente_email) return;
    const status = OrderEmailTemplateService.normalizeStatus(newStatus) || 'PENDIENTE';
    const payload = await buildTemplatePayload(status, order);
    const result = await sendEmail({
        to: order.cliente_email,
        subject: payload.subject,
        text: payload.text
    });

    if (!result.skipped) {
        await OrderEmailLogsService.logSend({
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
