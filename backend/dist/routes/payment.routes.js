"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const wompi_controller_1 = require("../controllers/wompi.controller");
const security_middleware_1 = require("../middleware/security.middleware");
const router = (0, express_1.Router)();
// Public endpoints (solo para poblar UI)
router.get('/wompi/config', wompi_controller_1.WompiController.getConfig);
router.get('/wompi/merchant', wompi_controller_1.WompiController.getMerchant);
router.get('/wompi/pse/banks', wompi_controller_1.WompiController.getPseBanks);
// Diagnostico (admin)
router.get('/wompi/diag', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.settings'), wompi_controller_1.WompiController.getDiagnostics);
// Checkout (requiere sesion)
router.post('/wompi/pse/checkout', security_middleware_1.createOrderLimiter, auth_middleware_1.verifyToken, wompi_controller_1.WompiController.createPseCheckout);
router.post('/wompi/nequi/checkout', security_middleware_1.createOrderLimiter, auth_middleware_1.verifyToken, wompi_controller_1.WompiController.createNequiCheckout);
router.post('/wompi/card/checkout', security_middleware_1.createOrderLimiter, auth_middleware_1.verifyToken, wompi_controller_1.WompiController.createCardCheckout);
// Webhook (Wompi)
router.post('/wompi/webhook', wompi_controller_1.WompiController.webhook);
// Sync manual desde el cliente (si el webhook no llega)
router.post('/wompi/orders/:id/sync', auth_middleware_1.verifyToken, wompi_controller_1.WompiController.syncOrderPayment);
exports.default = router;
