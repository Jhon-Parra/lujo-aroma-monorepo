import { pool } from '../config/database';

export const ORDER_EMAIL_STATUSES = [
    'PAGADO',
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
    PAGADO: {
        headline: 'Pedido recibido',
        message: 'Hemos recibido tu pedido y comenzamos a prepararlo. Si pagaste en linea, la confirmacion puede tardar unos minutos.',
        subject: 'Hemos recibido tu pedido #{{order_short_id}}'
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

const BASE_EMAIL_HTML = `
<div style="margin:0;padding:0;background:#f6f3ea;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    {{status_headline}} - Pedido #{{order_short_id}}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;background:#f6f3ea;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="border-collapse:separate;width:600px;max-width:600px;background:#ffffff;border:1px solid #efe8d8;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:#1b1b1b;padding:18px 22px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <a href="{{store_url}}" style="text-decoration:none;display:inline-block;">
                      <img src="{{logo_url}}" alt="Perfumissimo" width="150" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:150px;" />
                    </a>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;background:#b59a68;color:#ffffff;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:8px 10px;border-radius:999px;">
                      {{order_status_label}}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 22px 10px 22px;font-family:Arial,sans-serif;color:#1b1b1b;">
              <h1 style="margin:0;font-size:22px;line-height:1.25;letter-spacing:0.01em;">{{status_headline}}</h1>
              <p style="margin:10px 0 0 0;font-size:14px;line-height:1.55;color:#3c3c3c;">{{status_message}}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 22px 0 22px;">
              {{delivery_block_html}}
            </td>
          </tr>

          <tr>
            <td style="padding:10px 22px 0 22px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;width:100%;background:#fbf8f1;border:1px solid #f1e5cf;border-radius:14px;">
                <tr>
                  <td style="padding:14px 14px 6px 14px;font-family:Arial,sans-serif;color:#5a554a;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;">
                    Pedido
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 14px 14px 14px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
                      <tr>
                        <td style="font-size:16px;font-weight:800;color:#1b1b1b;">#{{order_short_id}}</td>
                        <td align="right" style="font-size:12px;color:#6b6456;">{{order_total}}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top:8px;font-size:12px;color:#6b6456;line-height:1.45;">
                          <strong style="color:#1b1b1b;">Direccion:</strong> {{shipping_address}}
                        </td>
                      </tr>
                      {{payment_block_html}}
                      {{shipping_block_html}}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 22px 0 22px;font-family:Arial,sans-serif;color:#1b1b1b;">
              <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#6b6456;">Productos</div>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 22px 0 22px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
                <tr>
                  <th align="left" style="padding:10px 0;border-bottom:1px solid #efe8d8;font-size:11px;color:#6b6456;text-transform:uppercase;letter-spacing:0.12em;">Producto</th>
                  <th align="center" style="padding:10px 0;border-bottom:1px solid #efe8d8;font-size:11px;color:#6b6456;text-transform:uppercase;letter-spacing:0.12em;">Cant</th>
                  <th align="right" style="padding:10px 0;border-bottom:1px solid #efe8d8;font-size:11px;color:#6b6456;text-transform:uppercase;letter-spacing:0.12em;">Subtotal</th>
                </tr>
                {{items_rows_html}}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 22px 0 22px;">
              {{addons_block_html}}
            </td>
          </tr>

          <tr>
            <td style="padding:18px 22px 24px 22px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
                <tr>
                  <td style="padding-top:8px;border-top:1px solid #efe8d8;color:#6b6456;font-size:12px;">Subtotal</td>
                  <td align="right" style="padding-top:8px;border-top:1px solid #efe8d8;color:#1b1b1b;font-size:12px;font-weight:800;">{{order_subtotal}}</td>
                </tr>
                {{discount_row_html}}
                <tr>
                  <td style="padding-top:10px;color:#6b6456;font-size:12px;">Total</td>
                  <td align="right" style="padding-top:10px;color:#1b1b1b;font-size:16px;font-weight:900;">{{order_total}}</td>
                </tr>
              </table>
              {{primary_cta_html}}
            </td>
          </tr>

          <tr>
            <td style="background:#fafafa;padding:14px 22px;text-align:center;font-family:Arial,sans-serif;color:#7a7468;font-size:12px;">
              © {{year}} Perfumissimo · <a href="{{store_url}}" style="color:#7a7468;text-decoration:underline;">perfumissimocol.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
`;

const DEFAULT_TEMPLATES: Record<OrderEmailStatus, { subject: string; body_html: string; body_text: string }> =
    ORDER_EMAIL_STATUSES.reduce((acc, status) => {
        const copy = STATUS_COPY[status];
        acc[status] = {
            subject: copy.subject,
            body_html: BASE_EMAIL_HTML,
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
             FROM orderemailtemplates`
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
             FROM orderemailtemplates
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
            `INSERT INTO orderemailtemplates (status, subject, body_html, body_text, updated_at)
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
