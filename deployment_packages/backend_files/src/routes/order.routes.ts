import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { verifyToken, requirePermission } from '../middleware/auth.middleware';
import { createOrderLimiter } from '../middleware/security.middleware';

const router = Router();

// Rutas para usuarios (crear orden y ver sus propias órdenes)
router.post('/', createOrderLimiter, verifyToken, OrderController.createOrder);
router.get('/my-orders', verifyToken, OrderController.getMyOrders);
router.get('/my-orders/:id', verifyToken, OrderController.getMyOrderById);

// Rutas para administradores (ver todas las órdenes y actualizar estados)
router.get('/', verifyToken, requirePermission('admin.orders'), OrderController.getAllOrders);
router.get('/:id', verifyToken, requirePermission('admin.orders'), OrderController.getOrderByIdAdmin);
router.put('/:id/status', verifyToken, requirePermission('admin.orders'), OrderController.updateOrderStatus);

export default router;
