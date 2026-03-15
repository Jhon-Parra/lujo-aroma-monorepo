import { Router } from 'express';
import {
    getProducts,
    getPublicCatalog,
    getNewestProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    importProductsFromSpreadsheet,
    downloadProductImportTemplate,
    getLowStockProducts,
    getRelatedProducts
} from '../controllers/product.controller';
import { uploadSingleImage, uploadSingleSpreadsheet } from '../middleware/upload.middleware';
import { verifyToken, requirePermission, optionalVerifyToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';

const router = Router();

router.get('/catalog', optionalVerifyToken, getPublicCatalog);
router.get('/newest', optionalVerifyToken, getNewestProducts);
router.get('/', getProducts);

router.get('/low-stock', verifyToken, requirePermission('admin.products'), getLowStockProducts);

router.get('/import/template', verifyToken, requirePermission('admin.products'), downloadProductImportTemplate);

router.get('/:id/related', optionalVerifyToken, getRelatedProducts);
router.get('/:id', optionalVerifyToken, getProductById);

router.post('/', verifyToken, requirePermission('admin.products'), uploadSingleImage, validate(createProductSchema), createProduct);
router.post('/import', verifyToken, requirePermission('admin.products'), uploadSingleSpreadsheet, importProductsFromSpreadsheet);
router.put('/:id', verifyToken, requirePermission('admin.products'), uploadSingleImage, validate(updateProductSchema), updateProduct);
router.delete('/:id', verifyToken, requirePermission('admin.products'), deleteProduct);

export default router;
