import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { verifyToken, requirePermission } from '../middleware/auth.middleware';
import { createOrderLimiter } from '../middleware/security.middleware';

const router = Router();

// ── Cliente: crear pedido y ver sus órdenes ──────────────────────────────────
router.post('/', createOrderLimiter, verifyToken, OrderController.createOrder);
router.get('/my-orders', verifyToken, OrderController.getMyOrders);
router.get('/my-orders/:id', verifyToken, OrderController.getMyOrderById);

// ── Admin: gestión de pedidos ────────────────────────────────────────────────
router.get('/', verifyToken, requirePermission('admin.orders'), OrderController.getAllOrders);
router.get('/:id', verifyToken, requirePermission('admin.orders'), OrderController.getOrderByIdAdmin);

// PATCH (permite mantener compatibilidad con PUT también)
router.patch('/:id/status', verifyToken, requirePermission('admin.orders'), OrderController.updateOrderStatus);
router.put('/:id/status', verifyToken, requirePermission('admin.orders'), OrderController.updateOrderStatus);

// Registrar guía de envío
router.post('/:id/shipping', verifyToken, requirePermission('admin.orders'), OrderController.registerShipping);

// Descargar PDF del pedido (admin o dueño del pedido)
router.get('/:id/pdf', verifyToken, OrderController.getOrderPdf);

export default router;
