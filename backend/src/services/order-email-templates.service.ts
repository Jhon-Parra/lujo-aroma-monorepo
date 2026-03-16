import { pool } from '../config/database';

export const ORDER_EMAIL_STATUSES = [
    'PENDIENTE',
    'PAGADO',
    'PROCESANDO',
    'ENVIADO',
    'ENTREGADO',
    'CANCELADO'
] as const;

export type OrderEmailStatus = typeof ORDER_EMAIL_STATUSES[number];

export type OrderEmailTemplate = {
    status: OrderEmailStatus;
    subject: string;
    body_html: string;
    body_text?: string | null;
    source?: 'custom' | 'default';
};

const STATUS_COPY: Record<OrderEmailStatus, { headline: string; message: string; subject: string }> = {
    PENDIENTE: {
        headline: 'Gracias por tu compra',
        message: 'Hemos recibido tu pedido correctamente. A continuacion te presentamos el resumen de tu orden.',
        subject: 'Tu compra ha sido realizada exitosamente (Pedido #{{order_short_id}})'
    },
    PAGADO: {
        headline: 'Pago confirmado',
        message: 'Tu pago ha sido confirmado y comenzamos a preparar tu pedido.',
        subject: 'Pago confirmado para tu pedido #{{order_short_id}}'
    },
    PROCESANDO: {
        headline: 'Pedido en preparacion',
        message: 'Tu pedido se encuentra en proceso de alistamiento.',
        subject: 'Tu pedido #{{order_short_id}} esta en proceso'
    },
    ENVIADO: {
        headline: 'Pedido enviado',
        message: 'Tu pedido ya fue despachado. Pronto estara en camino.',
        subject: 'Tu pedido #{{order_short_id}} ha sido enviado'
    },
    ENTREGADO: {
        headline: 'Pedido entregado',
        message: 'Tu pedido fue entregado satisfactoriamente. Esperamos que lo disfrutes.',
        subject: 'Tu pedido ha sido entregado (#{{order_short_id}})'
    },
    CANCELADO: {
        headline: 'Pedido cancelado',
        message: 'Tu pedido fue cancelado. Si necesitas ayuda, contactanos.',
        subject: 'Tu pedido #{{order_short_id}} ha sido cancelado'
    }
};

const BASE_EMAIL_TEXT = `
{{status_headline}}
{{status_message}}

Pedido: {{order_short_id}}
Direccion: {{shipping_address}}
Estado: {{order_status_label}}

Productos:
{{items_text}}

{{addons_text}}
Subtotal: {{order_subtotal}}
Total: {{order_total}}
`;

const DEFAULT_TEMPLATES: Record<OrderEmailStatus, { subject: string; body_html: string; body_text: string }> =
    ORDER_EMAIL_STATUSES.reduce((acc, status) => {
        const copy = STATUS_COPY[status];
        acc[status] = {
            subject: copy.subject,
            body_html: '',
            body_text: BASE_EMAIL_TEXT
        };
        return acc;
    }, {} as Record<OrderEmailStatus, { subject: string; body_html: string; body_text: string }>);

const normalizeStatus = (value: string): OrderEmailStatus | null => {
    const status = String(value || '').trim().toUpperCase();
    return (ORDER_EMAIL_STATUSES as readonly string[]).includes(status) ? (status as OrderEmailStatus) : null;
};

export const OrderEmailTemplateService = {
    normalizeStatus,

    getDefaultTemplate(status: OrderEmailStatus): OrderEmailTemplate {
        const tpl = DEFAULT_TEMPLATES[status];
        return {
            status,
            subject: tpl.subject,
            body_html: tpl.body_html,
            body_text: tpl.body_text,
            source: 'default'
        };
    },

    getStatusCopy(status: OrderEmailStatus) {
        return STATUS_COPY[status];
    },

    async listTemplates(): Promise<OrderEmailTemplate[]> {
        const [rows] = await pool.query<any[]>(
            `SELECT status, subject, body_html, body_text
             FROM OrderEmailTemplates`
        );

        const map = new Map<string, any>((rows || []).map((r: any) => [String(r.status || '').toUpperCase(), r]));
        return ORDER_EMAIL_STATUSES.map((status) => {
            const row = map.get(status);
            if (!row) return this.getDefaultTemplate(status);
            return {
                status,
                subject: String(row.subject || ''),
                body_html: String(row.body_html || ''),
                body_text: row.body_text !== null && row.body_text !== undefined ? String(row.body_text) : null,
                source: 'custom'
            };
        });
    },

    async getTemplate(status: OrderEmailStatus): Promise<OrderEmailTemplate> {
        const [rows] = await pool.query<any[]>(
            `SELECT status, subject, body_html, body_text
             FROM OrderEmailTemplates
             WHERE status = ?
             LIMIT 1`,
            [status]
        );

        const row = rows?.[0];
        if (!row) return this.getDefaultTemplate(status);

        return {
            status,
            subject: String(row.subject || ''),
            body_html: String(row.body_html || ''),
            body_text: row.body_text !== null && row.body_text !== undefined ? String(row.body_text) : null,
            source: 'custom'
        };
    },

    async upsertTemplate(status: OrderEmailStatus, input: { subject: string; body_html?: string | null; body_text?: string | null }): Promise<OrderEmailTemplate> {
        const subject = String(input.subject || '').trim();
        const body_html = input.body_html !== undefined && input.body_html !== null ? String(input.body_html).trim() : '';
        const body_text = input.body_text !== undefined && input.body_text !== null ? String(input.body_text).trim() : null;

        await pool.query(
            `INSERT INTO OrderEmailTemplates (status, subject, body_html, body_text, updated_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE subject = VALUES(subject), body_html = VALUES(body_html), body_text = VALUES(body_text), updated_at = NOW()`,
            [status, subject, body_html, body_text]
        );

        return {
            status,
            subject,
            body_html,
            body_text,
            source: 'custom'
        };
    }
};
