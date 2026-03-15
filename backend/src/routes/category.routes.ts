import { Router } from 'express';
import { verifyToken, requirePermission } from '../middleware/auth.middleware';
import {
    getCategories,
    getCategoriesAdmin,
    createCategory,
    updateCategory,
    deleteCategory
} from '../controllers/category.controller';

const router = Router();

router.get('/', getCategories);

router.get('/admin', verifyToken, requirePermission('admin.products'), getCategoriesAdmin);
router.post('/', verifyToken, requirePermission('admin.products'), createCategory);
router.put('/:id', verifyToken, requirePermission('admin.products'), updateCategory);
router.delete('/:id', verifyToken, requirePermission('admin.products'), deleteCategory);

export default router;
