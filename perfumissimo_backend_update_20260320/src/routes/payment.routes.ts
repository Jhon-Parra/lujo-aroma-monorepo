import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { WompiController } from '../controllers/wompi.controller';
import { createOrderLimiter } from '../middleware/security.middleware';

const router = Router();

// Public endpoints (solo para poblar UI)
router.get('/wompi/config', WompiController.getConfig);
router.get('/wompi/merchant', WompiController.getMerchant);
router.get('/wompi/pse/banks', WompiController.getPseBanks);

// Checkout (requiere sesion)
router.post('/wompi/pse/checkout', createOrderLimiter, verifyToken, WompiController.createPseCheckout);
router.post('/wompi/nequi/checkout', createOrderLimiter, verifyToken, WompiController.createNequiCheckout);
router.post('/wompi/card/checkout', createOrderLimiter, verifyToken, WompiController.createCardCheckout);

// Webhook (Wompi)
router.post('/wompi/webhook', WompiController.webhook);

// Sync manual desde el cliente (si el webhook no llega)
router.post('/wompi/orders/:id/sync', verifyToken, WompiController.syncOrderPayment);

export default router;
