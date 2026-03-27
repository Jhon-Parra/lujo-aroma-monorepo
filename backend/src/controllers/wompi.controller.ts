import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { WompiService } from '../services/wompi.service';
import { OrderModel } from '../models/order.model';
import { notifyOrderCreated, notifyOrderStatusChanged } from '../services/order-notification.service';

const safeOriginFromReq = (req: any): string => {
    const origin = String(req?.headers?.origin || '').trim();
    if (origin) return origin;
    const fallback = String(process.env.FRONTEND_URL || '').trim();
    return fallback || 'http://localhost:4200';
};

const WOMPI_API_VERSION = '1.2.2-debug';

export class WompiController {
    static async getConfig(req: AuthRequest, res: Response): Promise<void> {
        try {
            const cfg = await WompiService.getClientConfig();
            const hasPrivateKey = await WompiService.hasPrivateKey();
            res.status(200).json({
                ...cfg,
                has_private_key: hasPrivateKey,
                configured: true,
                version: WOMPI_API_VERSION
            });
        } catch (e: any) {
            const msg = String(e?.message || '');
            // Si la clave simplemente no está configurada, devolver estado 200
            // con configured:false en lugar de 500 para no romper el frontend.
            if (msg.includes('WOMPI_PUBLIC_KEY') || msg.includes('WOMPI API key')) {
                res.status(200).json({
                    configured: false,
                    env: 'sandbox',
                    public_key: null,
                    base_url: 'https://sandbox.wompi.co/v1',
                    has_private_key: false,
                    version: WOMPI_API_VERSION,
                    message: 'Wompi no está configurado aún. Configura las llaves en el panel de administrador.'
                });
                return;
            }
            res.status(500).json({ error: msg || 'No se pudo obtener configuracion Wompi' });
        }
    }


    static async getMerchant(req: AuthRequest, res: Response): Promise<void> {
        try {
            const data = await WompiService.getMerchant();
            res.status(200).json({
                version: WOMPI_API_VERSION,
                name: data.name || null,
                presigned_acceptance: {
                    acceptance_token: data.acceptance_token,
                    permalink: data.permalink
                }
            });
        } catch (e: any) {
            res.status(500).json({ version: WOMPI_API_VERSION, error: e?.message || 'No se pudo obtener merchant de Wompi' });
        }
    }

    static async getDiagnostics(req: AuthRequest, res: Response): Promise<void> {
        try {
            const diag = await WompiService.getDiagnostics();
            res.status(200).json({
                version: WOMPI_API_VERSION,
                ...diag
            });
        } catch (e: any) {
            res.status(500).json({
                version: WOMPI_API_VERSION,
                error: e?.message || 'No se pudo obtener diagnostico Wompi'
            });
        }
    }

    static async getPseBanks(req: AuthRequest, res: Response): Promise<void> {
        try {
            const banks = await WompiService.getPseBanks();
            res.status(200).json({ data: banks });
        } catch (e: any) {
            res.status(500).json({ error: e?.message || 'No se pudo obtener bancos PSE' });
        }
    }

    static async createPseCheckout(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user_id = req.user?.id;
            const email = String(req.user?.email || '').trim();
            if (!user_id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            if (!email || !email.includes('@')) {
                res.status(400).json({ message: 'Email del usuario requerido para Wompi' });
                return;
            }

            const {
                shipping_address,
                items,
                acceptance_token,
                phone,
                telefono,
                nombre_cliente,
                metodo_pago,
                canal_pago,
                envio_prioritario,
                perfume_lujo,
                user_type,
                user_legal_id_type,
                user_legal_id,
                financial_institution_code
            } = req.body;

            const shipping = String(shipping_address || '').trim();
            if (!shipping) {
                res.status(400).json({ message: 'La dirección de envío es requerida' });
                return;
            }

            if (!Array.isArray(items) || items.length === 0) {
                res.status(400).json({ message: 'La orden debe tener al menos un producto' });
                return;
            }

            const accToken = String(acceptance_token || '').trim();
            if (!accToken) {
                res.status(400).json({ message: 'Debes aceptar los términos de Wompi para continuar' });
                return;
            }

            const utype = String(user_type || '').trim();
            if (utype !== '0' && utype !== '1') {
                res.status(400).json({ message: 'Tipo de persona inválido' });
                return;
            }

            const idType = String(user_legal_id_type || '').trim();
            const idNum = String(user_legal_id || '').trim();
            if (!idType || !idNum) {
                res.status(400).json({ message: 'Documento requerido para PSE' });
                return;
            }

            const bankCode = String(financial_institution_code || '').trim();
            if (!bankCode) {
                res.status(400).json({ message: 'Selecciona un banco' });
                return;
            }

            // Crear orden primero (reserva stock como esta hoy)
            const created = await OrderModel.createOrder({
                user_id,
                shipping_address: shipping,
                items,
                transaction_code: undefined,
                telefono: String(telefono || phone || '').trim() || undefined,
                nombre_cliente: String(nombre_cliente || '').trim() || undefined,
                metodo_pago: String(metodo_pago || 'WOMPI_PSE').trim(),
                canal_pago: String(canal_pago || 'Wompi').trim(),
                envio_prioritario: !!envio_prioritario,
                perfume_lujo: !!perfume_lujo
            });

            const amountInCents = Math.round(created.total * 100);
            const origin = safeOriginFromReq(req);
            const redirectUrl = `${origin}/order-success/${encodeURIComponent(created.orderId)}`;

            try {
                const tx = await WompiService.createPseTransaction({
                    amount_in_cents: amountInCents,
                    reference: created.orderId,
                    customer_email: email,
                    redirect_url: redirectUrl,
                    acceptance_token: accToken,
                    user_type: utype as '0' | '1',
                    user_legal_id_type: idType,
                    user_legal_id: idNum,
                    financial_institution_code: bankCode,
                    payment_description: `Pedido Perfumissimo ${created.orderId}`
                });

                await OrderModel.updateTransactionCode(created.orderId, tx.transaction_id);

                // Email de "pedido recibido" (no bloquear)
                notifyOrderCreated(created.orderId).catch((e) => console.error('Order email error (wompi pse):', e));

                res.status(201).json({
                    message: 'Checkout PSE creado',
                    orderId: created.orderId,
                    transactionId: tx.transaction_id,
                    asyncPaymentUrl: tx.async_payment_url,
                    redirectUrl
                });
            } catch (e: any) {
                // Si falla el pago, cancelar la orden y devolver stock
                await OrderModel.cancelAndRestock(created.orderId);
                throw e;
            }
        } catch (error: any) {
            const detail = error?.message || String(error);
            const status = /^WOMPI_/i.test(detail) ? 400 : 500;
            res.status(status).json({ message: 'Error creando checkout PSE', detail });
        }
    }

    static async createNequiCheckout(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user_id = req.user?.id;
            const email = String(req.user?.email || '').trim();
            if (!user_id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            if (!email || !email.includes('@')) {
                res.status(400).json({ message: 'Email del usuario requerido para Wompi' });
                return;
            }

            const { shipping_address, items, acceptance_token, phone_number, phone: phoneRaw, telefono, nombre_cliente, metodo_pago, canal_pago, envio_prioritario, perfume_lujo } = req.body;

            const shipping = String(shipping_address || '').trim();
            if (!shipping) {
                res.status(400).json({ message: 'La dirección de envío es requerida' });
                return;
            }

            if (!Array.isArray(items) || items.length === 0) {
                res.status(400).json({ message: 'La orden debe tener al menos un producto' });
                return;
            }

            const accToken = String(acceptance_token || '').trim();
            if (!accToken) {
                res.status(400).json({ message: 'Debes aceptar los términos de Wompi para continuar' });
                return;
            }

            const rawPhone = String(phone_number || '').trim();
            const phoneDigits = rawPhone.replace(/\D/g, '');
            if (!phoneDigits || phoneDigits.length < 10) {
                res.status(400).json({ message: 'Número de teléfono Nequi inválido' });
                return;
            }

            const created = await OrderModel.createOrder({
                user_id,
                shipping_address: shipping,
                items,
                transaction_code: undefined,
                telefono: String(telefono || phoneRaw || '').trim() || undefined,
                nombre_cliente: String(nombre_cliente || '').trim() || undefined,
                metodo_pago: String(metodo_pago || 'WOMPI_NEQUI').trim(),
                canal_pago: String(canal_pago || 'Wompi').trim(),
                envio_prioritario: !!envio_prioritario,
                perfume_lujo: !!perfume_lujo
            });

            const amountInCents = Math.round(created.total * 100);
            const origin = safeOriginFromReq(req);
            const redirectUrl = `${origin}/order-success/${encodeURIComponent(created.orderId)}`;

            try {
                const tx = await WompiService.createNequiTransaction({
                    amount_in_cents: amountInCents,
                    reference: created.orderId,
                    customer_email: email,
                    acceptance_token: accToken,
                    redirect_url: redirectUrl,
                    phone_number: phoneDigits,
                    payment_description: `Pedido Perfumissimo ${created.orderId}`
                });

                await OrderModel.updateTransactionCode(created.orderId, tx.transaction_id);

                notifyOrderCreated(created.orderId).catch((e) => console.error('Order email error (wompi nequi):', e));

                res.status(201).json({
                    message: 'Checkout Nequi creado',
                    orderId: created.orderId,
                    transactionId: tx.transaction_id,
                    status: tx.status || null,
                    redirectUrl
                });
            } catch (e: any) {
                await OrderModel.cancelAndRestock(created.orderId);
                throw e;
            }
        } catch (error: any) {
            const detail = error?.message || String(error);
            const status = /^WOMPI_/i.test(detail) ? 400 : 500;
            res.status(status).json({ message: 'Error creando checkout Nequi', detail });
        }
    }

    static async createCardCheckout(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user_id = req.user?.id;
            const email = String(req.user?.email || '').trim();
            if (!user_id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            if (!email || !email.includes('@')) {
                res.status(400).json({ message: 'Email del usuario requerido para Wompi' });
                return;
            }

            const { shipping_address, items, acceptance_token, token, installments, phone, telefono, nombre_cliente, metodo_pago, canal_pago, envio_prioritario, perfume_lujo } = req.body;

            const shipping = String(shipping_address || '').trim();
            if (!shipping) {
                res.status(400).json({ message: 'La dirección de envío es requerida' });
                return;
            }

            if (!Array.isArray(items) || items.length === 0) {
                res.status(400).json({ message: 'La orden debe tener al menos un producto' });
                return;
            }

            const accToken = String(acceptance_token || '').trim();
            if (!accToken) {
                res.status(400).json({ message: 'Debes aceptar los términos de Wompi para continuar' });
                return;
            }

            const cardToken = String(token || '').trim();
            if (!cardToken) {
                res.status(400).json({ message: 'Token de tarjeta inválido' });
                return;
            }

            const inst = Math.max(1, Math.min(36, Math.trunc(Number(installments || 1))));

            const created = await OrderModel.createOrder({
                user_id,
                shipping_address: shipping,
                items,
                transaction_code: undefined,
                telefono: String(telefono || phone || '').trim() || undefined,
                nombre_cliente: String(nombre_cliente || '').trim() || undefined,
                metodo_pago: String(metodo_pago || 'WOMPI_CARD').trim(),
                canal_pago: String(canal_pago || 'Wompi').trim(),
                envio_prioritario: !!envio_prioritario,
                perfume_lujo: !!perfume_lujo
            });

            const amountInCents = Math.round(created.total * 100);
            const origin = safeOriginFromReq(req);
            const redirectUrl = `${origin}/order-success/${encodeURIComponent(created.orderId)}`;

            try {
                const tx = await WompiService.createCardTransaction({
                    amount_in_cents: amountInCents,
                    reference: created.orderId,
                    customer_email: email,
                    redirect_url: redirectUrl,
                    acceptance_token: accToken,
                    token: cardToken,
                    installments: inst
                });

                await OrderModel.updateTransactionCode(created.orderId, tx.transaction_id);

                const status = String(tx.status || '').toUpperCase();
                if (status === 'APPROVED') {
                    await OrderModel.updateOrderStatus(created.orderId, 'PAGADO');
                } else if (status === 'DECLINED' || status === 'VOIDED' || status === 'ERROR') {
                    await OrderModel.cancelAndRestock(created.orderId);
                    res.status(402).json({ message: 'Pago con tarjeta rechazado', status });
                    return;
                }

                // En tarjeta, si queda aprobado, el email ya sale con estado PAGADO.
                notifyOrderCreated(created.orderId).catch((e) => console.error('Order email error (wompi card):', e));

                res.status(201).json({
                    message: 'Checkout tarjeta creado',
                    orderId: created.orderId,
                    transactionId: tx.transaction_id,
                    status: tx.status || null,
                    redirectUrl
                });
            } catch (e: any) {
                await OrderModel.cancelAndRestock(created.orderId);
                throw e;
            }
        } catch (error: any) {
            const detail = error?.message || String(error);
            const status = /^WOMPI_/i.test(detail) ? 400 : 500;
            res.status(status).json({ message: 'Error creando checkout tarjeta', detail });
        }
    }

    // Webhook (sin auth). Por seguridad, validamos consultando el estado real de la transaccion en Wompi.
    static async webhook(req: any, res: Response): Promise<void> {
        try {
            const txId =
                String(req?.body?.data?.transaction?.id || req?.body?.data?.transaction?.id || req?.body?.transaction?.id || '').trim();

            if (!txId) {
                res.status(200).json({ ok: true });
                return;
            }

            const tx = await WompiService.getTransaction(txId);
            const orderId = String(tx.reference || '').trim();
            if (!orderId) {
                res.status(200).json({ ok: true });
                return;
            }

            // Guardar transaction id si no estaba
            await OrderModel.updateTransactionCode(orderId, tx.id);

            const prevStatus = await OrderModel.getOrderStatus(orderId);
            const status = String(tx.status || '').toUpperCase();
            if (status === 'APPROVED') {
                await OrderModel.updatePaymentInfo(orderId, { estado_pago: 'APROBADO', referencia_pago: tx.id, fecha_pago: new Date() });
                if (prevStatus !== 'PAGADO') {
                    if (String(prevStatus || '').toUpperCase() === 'CANCELADO') {
                        await OrderModel.reinstateCancelledOrderPaid(orderId);
                    } else {
                        await OrderModel.updateOrderStatus(orderId, 'PAGADO');
                    }
                    notifyOrderStatusChanged(orderId, 'PAGADO').catch((e) => console.error('Order status email error (wompi webhook):', e));
                }
            } else if (status === 'DECLINED') {
                await OrderModel.updatePaymentInfo(orderId, { estado_pago: 'RECHAZADO', referencia_pago: tx.id, fecha_pago: null });
                const prev = String(prevStatus || '').toUpperCase();
                if (!['PAGADO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'].includes(prev)) {
                    await OrderModel.cancelAndRestock(orderId);
                    notifyOrderStatusChanged(orderId, 'CANCELADO').catch((e) => console.error('Order status email error (wompi webhook):', e));
                }
            } else if (status === 'VOIDED') {
                await OrderModel.updatePaymentInfo(orderId, { estado_pago: 'CANCELADO', referencia_pago: tx.id, fecha_pago: null });
                const prev = String(prevStatus || '').toUpperCase();
                if (!['PAGADO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'].includes(prev)) {
                    await OrderModel.cancelAndRestock(orderId);
                    notifyOrderStatusChanged(orderId, 'CANCELADO').catch((e) => console.error('Order status email error (wompi webhook):', e));
                }
            } else if (status === 'ERROR') {
                await OrderModel.updatePaymentInfo(orderId, { estado_pago: 'PENDIENTE', referencia_pago: tx.id, fecha_pago: null });
            }

            res.status(200).json({ ok: true });
        } catch (e: any) {
            // No reintentar indefinidamente: responder 200, pero loguear
            console.error('Wompi webhook error:', e?.message || e);
            res.status(200).json({ ok: true });
        }
    }

    static async syncOrderPayment(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user_id = req.user?.id;
            if (!user_id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const orderId = String(req.params?.id || '').trim();
            if (!orderId) {
                res.status(400).json({ message: 'Orden inválida' });
                return;
            }

            const order = await OrderModel.getOrderById(orderId, user_id);
            if (!order) {
                res.status(404).json({ message: 'Orden no encontrada' });
                return;
            }

            const txId = String(order?.codigo_transaccion || '').trim();
            if (!txId) {
                res.status(400).json({ message: 'La orden no tiene transacción asociada' });
                return;
            }

            const tx = await WompiService.getTransaction(txId);
            if (String(tx.reference || '').trim() !== orderId) {
                res.status(400).json({ message: 'Transacción no corresponde a la orden' });
                return;
            }

            const status = String(tx.status || '').toUpperCase();
            if (status === 'APPROVED') {
                await OrderModel.updatePaymentInfo(orderId, { estado_pago: 'APROBADO', referencia_pago: tx.id, fecha_pago: new Date() });
                const prev = await OrderModel.getOrderStatus(orderId);
                if (prev !== 'PAGADO') {
                    if (String(prev || '').toUpperCase() === 'CANCELADO') {
                        await OrderModel.reinstateCancelledOrderPaid(orderId);
                    } else {
                        await OrderModel.updateOrderStatus(orderId, 'PAGADO');
                    }
                    notifyOrderStatusChanged(orderId, 'PAGADO').catch((e) => console.error('Order status email error (wompi sync):', e));
                }
            } else if (status === 'DECLINED') {
                await OrderModel.updatePaymentInfo(orderId, { estado_pago: 'RECHAZADO', referencia_pago: tx.id, fecha_pago: null });
                const prev = String((await OrderModel.getOrderStatus(orderId)) || '').toUpperCase();
                if (!['PAGADO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'].includes(prev)) {
                    await OrderModel.cancelAndRestock(orderId);
                    notifyOrderStatusChanged(orderId, 'CANCELADO').catch((e) => console.error('Order status email error (wompi sync):', e));
                }
            } else if (status === 'VOIDED') {
                await OrderModel.updatePaymentInfo(orderId, { estado_pago: 'CANCELADO', referencia_pago: tx.id, fecha_pago: null });
                const prev = String((await OrderModel.getOrderStatus(orderId)) || '').toUpperCase();
                if (!['PAGADO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'].includes(prev)) {
                    await OrderModel.cancelAndRestock(orderId);
                    notifyOrderStatusChanged(orderId, 'CANCELADO').catch((e) => console.error('Order status email error (wompi sync):', e));
                }
            } else if (status === 'ERROR') {
                await OrderModel.updatePaymentInfo(orderId, { estado_pago: 'PENDIENTE', referencia_pago: tx.id, fecha_pago: null });
            }

            res.status(200).json({
                ok: true,
                orderId,
                wompiStatus: status
            });
        } catch (e: any) {
            res.status(500).json({ message: 'No se pudo sincronizar el pago', detail: e?.message || String(e) });
        }
    }
}
