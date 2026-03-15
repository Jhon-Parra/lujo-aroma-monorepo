import { Router } from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller';
import { verifyToken, requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.get('/summary', verifyToken, requirePermission('admin.dashboard'), getDashboardSummary);

export default router;
