import { Request, Response } from 'express';
import { OrderEmailTemplateService } from '../services/order-email-templates.service';
import { OrderEmailLogsService } from '../services/order-email-logs.service';

const TEMPLATE_MIGRATION_HINT = 'Tu base de datos no soporta plantillas de correo. Ejecuta database/migrations/20260313_order_email_templates.sql en Supabase y vuelve a intentar.';

export const getOrderEmailTemplates = async (_req: Request, res: Response): Promise<void> => {
    try {
        const templates = await OrderEmailTemplateService.listTemplates();
        res.status(200).json({ templates });
    } catch (e: any) {
        const msg = String(e?.message || '');
        if (/orderemailtemplates/i.test(msg) && /does not exist|relation/i.test(msg)) {
            res.status(400).json({ error: TEMPLATE_MIGRATION_HINT });
            return;
        }
        res.status(500).json({ error: 'No se pudieron cargar las plantillas de correo' });
    }
};

export const updateOrderEmailTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawStatus = String(req.params['status'] || '').trim();
        const status = OrderEmailTemplateService.normalizeStatus(rawStatus);
        if (!status) {
            res.status(400).json({ error: 'Estado invalido para plantilla de correo' });
            return;
        }

        const { subject, body_text } = req.body || {};
        const template = await OrderEmailTemplateService.upsertTemplate(status, {
            subject,
            body_text,
            body_html: ''
        });
        res.status(200).json(template);
    } catch (e: any) {
        const msg = String(e?.message || '');
        if (/orderemailtemplates/i.test(msg) && /does not exist|relation/i.test(msg)) {
            res.status(400).json({ error: TEMPLATE_MIGRATION_HINT });
            return;
        }
        res.status(500).json({ error: 'No se pudo actualizar la plantilla de correo' });
    }
};

export const getOrderEmailLogs = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = Number(req.query['limit'] || 50);
        const rows = await OrderEmailLogsService.listRecent(limit);
        res.status(200).json({ logs: rows });
    } catch (e: any) {
        const msg = String(e?.message || '');
        if (/orderemaillogs/i.test(msg) && /does not exist|relation/i.test(msg)) {
            res.status(400).json({ error: 'Tu base de datos no soporta logs de correo. Ejecuta database/migrations/20260313_order_email_logs.sql en Supabase y vuelve a intentar.' });
            return;
        }
        res.status(500).json({ error: 'No se pudieron cargar los logs de correo' });
    }
};
