import { Router } from 'express';
import { getUsers, updateUserRole, updateUserSegment } from '../controllers/user.controller';
import { verifyToken, requirePermission, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { updateUserRoleSchema, updateUserSegmentSchema } from '../schemas/user.schema';

const router = Router();

router.get('/', verifyToken, requirePermission('admin.users'), getUsers);

router.put('/:id/role', verifyToken, requirePermission('admin.users'), validate(updateUserRoleSchema), updateUserRole);

router.put('/:id/segment', verifyToken, requirePermission('admin.users'), validate(updateUserSegmentSchema), updateUserSegment);

export default router;
