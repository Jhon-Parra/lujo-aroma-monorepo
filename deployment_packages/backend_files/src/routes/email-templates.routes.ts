import { Router } from 'express';
import { verifyToken, requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { getOrderEmailLogs, getOrderEmailTemplates, updateOrderEmailTemplate } from '../controllers/email-templates.controller';
import { updateOrderEmailTemplateSchema } from '../schemas/email-templates.schema';

const router = Router();

router.get('/orders', verifyToken, requirePermission('admin.settings'), getOrderEmailTemplates);
router.get('/orders/logs', verifyToken, requirePermission('admin.settings'), getOrderEmailLogs);

router.put(
    '/orders/:status',
    verifyToken,
    requirePermission('admin.settings'),
    validate(updateOrderEmailTemplateSchema),
    updateOrderEmailTemplate
);

export default router;
