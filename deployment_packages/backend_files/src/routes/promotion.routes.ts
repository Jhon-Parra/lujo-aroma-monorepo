import { Router } from 'express';
import { createPromotion, getPromotions, getPromotionsAdmin, updatePromotion, updatePromotionActive, deletePromotion } from '../controllers/promotion.controller';
import { verifyToken, requirePermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createPromotionSchema, updatePromotionActiveSchema } from '../schemas/promotion.schema';
import { uploadSingleImage } from '../middleware/upload.middleware';

const router = Router();

router.get('/', getPromotions);

router.get('/admin', verifyToken, requirePermission('admin.promotions'), getPromotionsAdmin);

router.post('/', verifyToken, requirePermission('admin.promotions'), uploadSingleImage, validate(createPromotionSchema), createPromotion);

router.put('/:id', verifyToken, requirePermission('admin.promotions'), uploadSingleImage, validate(createPromotionSchema), updatePromotion);

// Toggle simple de activo/inactivo (evita revalidar fechas/reglas)
router.patch('/:id/active', verifyToken, requirePermission('admin.promotions'), validate(updatePromotionActiveSchema), updatePromotionActive);

router.delete('/:id', verifyToken, requirePermission('admin.promotions'), deletePromotion);

export default router;
