"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const promotion_controller_1 = require("../controllers/promotion.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const promotion_schema_1 = require("../schemas/promotion.schema");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = (0, express_1.Router)();
router.get('/', promotion_controller_1.getPromotions);
// Public: registrar click del boton flotante
router.post('/fab/click', promotion_controller_1.trackPromotionsFabClick);
router.get('/admin', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.promotions'), promotion_controller_1.getPromotionsAdmin);
// Admin: ver contador de clicks del boton flotante
router.get('/fab/metrics', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.promotions'), promotion_controller_1.getPromotionsFabMetrics);
router.post('/', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.promotions'), upload_middleware_1.uploadSingleImage, (0, validation_middleware_1.validate)(promotion_schema_1.createPromotionSchema), promotion_controller_1.createPromotion);
router.put('/:id', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.promotions'), upload_middleware_1.uploadSingleImage, (0, validation_middleware_1.validate)(promotion_schema_1.createPromotionSchema), promotion_controller_1.updatePromotion);
// Toggle simple de activo/inactivo (evita revalidar fechas/reglas)
router.patch('/:id/active', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.promotions'), (0, validation_middleware_1.validate)(promotion_schema_1.updatePromotionActiveSchema), promotion_controller_1.updatePromotionActive);
router.delete('/:id', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.promotions'), promotion_controller_1.deletePromotion);
exports.default = router;
