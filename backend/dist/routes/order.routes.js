"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_controller_1 = require("../controllers/order.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const security_middleware_1 = require("../middleware/security.middleware");
const router = (0, express_1.Router)();
// ── Cliente: crear pedido y ver sus órdenes ──────────────────────────────────
router.post('/', security_middleware_1.createOrderLimiter, auth_middleware_1.verifyToken, order_controller_1.OrderController.createOrder);
router.get('/my-orders', auth_middleware_1.verifyToken, order_controller_1.OrderController.getMyOrders);
router.get('/my-orders/:id', auth_middleware_1.verifyToken, order_controller_1.OrderController.getMyOrderById);
// ── Admin: gestión de pedidos ────────────────────────────────────────────────
router.get('/', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.orders'), order_controller_1.OrderController.getAllOrders);
router.get('/:id', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.orders'), order_controller_1.OrderController.getOrderByIdAdmin);
// PATCH (permite mantener compatibilidad con PUT también)
router.patch('/:id/status', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.orders'), order_controller_1.OrderController.updateOrderStatus);
router.put('/:id/status', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.orders'), order_controller_1.OrderController.updateOrderStatus);
// Registrar guía de envío
router.post('/:id/shipping', auth_middleware_1.verifyToken, (0, auth_middleware_1.requirePermission)('admin.orders'), order_controller_1.OrderController.registerShipping);
// Descargar PDF del pedido (admin o dueño del pedido)
router.get('/:id/pdf', auth_middleware_1.verifyToken, order_controller_1.OrderController.getOrderPdf);
exports.default = router;
