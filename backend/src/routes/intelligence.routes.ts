import { Router } from 'express';
import { getIntelligenceSummary, trackCartSession, trackProductView, trackSearchEvent, convertCartSession } from '../controllers/intelligence.controller';
import { verifyToken, requirePermission, optionalVerifyToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/summary', verifyToken, requirePermission('admin.dashboard'), getIntelligenceSummary);
router.post('/search', optionalVerifyToken, trackSearchEvent);
router.post('/product-view', optionalVerifyToken, trackProductView);
router.post('/cart', optionalVerifyToken, trackCartSession);
router.post('/cart/convert', optionalVerifyToken, convertCartSession);

export default router;
