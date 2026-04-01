"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderEmailLogs = exports.updateOrderEmailTemplate = exports.getOrderEmailTemplates = void 0;
const order_email_templates_service_1 = require("../services/order-email-templates.service");
const order_email_logs_service_1 = require("../services/order-email-logs.service");
const TEMPLATE_MIGRATION_HINT = 'Tu base de datos no soporta plantillas/logs de correo. ' +
    'Si usas MySQL/MariaDB ejecuta backend/database/migrations/mysql/05_create_email_tables.sql. ' +
    'Si usas Supabase/Postgres ejecuta backend/database/migrations/20260313_order_email_templates.sql y backend/database/migrations/20260313_order_email_logs.sql.';
const getOrderEmailTemplates = async (_req, res) => {
    try {
        const templates = await order_email_templates_service_1.OrderEmailTemplateService.listTemplates();
        res.status(200).json({ templates });
    }
    catch (e) {
        const msg = String(e?.message || '');
        if (/orderemailtemplates/i.test(msg) && /does not exist|relation/i.test(msg)) {
            res.status(400).json({ error: TEMPLATE_MIGRATION_HINT });
            return;
        }
        res.status(500).json({ error: 'No se pudieron cargar las plantillas de correo' });
    }
};
exports.getOrderEmailTemplates = getOrderEmailTemplates;
const updateOrderEmailTemplate = async (req, res) => {
    try {
        const rawStatus = String(req.params['status'] || '').trim();
        const status = order_email_templates_service_1.OrderEmailTemplateService.normalizeStatus(rawStatus);
        if (!status) {
            res.status(400).json({ error: 'Estado invalido para plantilla de correo' });
            return;
        }
        const { subject, body_text, body_html } = req.body || {};
        const template = await order_email_templates_service_1.OrderEmailTemplateService.upsertTemplate(status, {
            subject,
            body_text,
            body_html: body_html !== undefined ? body_html : ''
        });
        res.status(200).json(template);
    }
    catch (e) {
        const msg = String(e?.message || '');
        if (/orderemailtemplates/i.test(msg) && /does not exist|relation/i.test(msg)) {
            res.status(400).json({ error: TEMPLATE_MIGRATION_HINT });
            return;
        }
        res.status(500).json({ error: 'No se pudo actualizar la plantilla de correo' });
    }
};
exports.updateOrderEmailTemplate = updateOrderEmailTemplate;
const getOrderEmailLogs = async (req, res) => {
    try {
        const limit = Number(req.query['limit'] || 50);
        const rows = await order_email_logs_service_1.OrderEmailLogsService.listRecent(limit);
        res.status(200).json({ logs: rows });
    }
    catch (e) {
        const msg = String(e?.message || '');
        if (/orderemaillogs/i.test(msg) && /does not exist|relation/i.test(msg)) {
            res.status(400).json({ error: TEMPLATE_MIGRATION_HINT });
            return;
        }
        res.status(500).json({ error: 'No se pudieron cargar los logs de correo' });
    }
};
exports.getOrderEmailLogs = getOrderEmailLogs;
