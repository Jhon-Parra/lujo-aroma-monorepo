import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { verifyToken, requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { updateSettingsSchema } from '../schemas/settings.schema';
import { uploadSettingsAssets } from '../middleware/upload.middleware';

const router = Router();

router.get('/', getSettings);

router.put(
    '/',
    verifyToken,
    requirePermission('admin.settings'),
    uploadSettingsAssets,
    validate(updateSettingsSchema),
    updateSettings
);

export default router;
