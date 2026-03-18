import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { OrderModel, CreateOrderParams, RegisterShippingParams } from '../models/order.model';
import { notifyOrderCreated, notifyOrderStatusChanged } from '../services/order-notification.service';
import { sendOrderShippingEmail } from '../services/email.service';
import PDFDocument from 'pdfkit';

export class OrderController {

    // ─── POST /api/orders ─────────────────────────────────────────────────────
    static async createOrder(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user_id = req.user?.id;
            if (!user_id) { res.status(401).json({ message: 'Usuario no autenticado' }); return; }

            const {
                shipping_address, items, transaction_code, telefono,
                metodo_pago, canal_pago,
                envio_prioritario, perfume_lujo,
                cart_session_id, cart_recovery_applied, cart_recovery_discount_pct
            } = req.body;

            // Validaciones
            if (!shipping_address || String(shipping_address).trim() === '') {
                res.status(400).json({ message: 'La dirección de envío es obligatoria' }); return;
            }
            if (!telefono || String(telefono).trim().length < 7) {
                res.status(400).json({ message: 'El teléfono es obligatorio (mínimo 7 dígitos)' }); return;
            }
            if (!items || !Array.isArray(items) || items.length === 0) {
                res.status(400).json({ message: 'El carrito no puede estar vacío' }); return;
            }
            for (const item of items) {
                if (!item.product_id || Number(item.quantity) < 1 || Number(item.price) <= 0) {
                    res.status(400).json({ message: 'Datos de producto inválidos en el carrito' }); return;
                }
            }

            // Nombre del cliente desde el token
            const nombre_cliente = String(req.user?.email || '').trim() || undefined;

            const orderData: CreateOrderParams = {
                user_id,
                shipping_address: String(shipping_address).trim(),
                items,
                transaction_code,
                telefono: String(telefono).trim(),
                nombre_cliente,
                metodo_pago: metodo_pago || null,
                canal_pago: canal_pago || null,
                envio_prioritario: !!envio_prioritario,
                perfume_lujo: !!perfume_lujo,
                cart_recovery_applied: !!cart_recovery_applied,
                cart_recovery_discount_pct
            };

            const created = await OrderModel.createOrder(orderData);

            const sessionId = String(cart_session_id || '').trim();
            if (sessionId) {
                try { await OrderModel.markCartSessionConverted(sessionId, created.orderId); }
                catch (e: any) { console.warn('No se pudo actualizar cart session:', e?.message); }
            }

            notifyOrderCreated(created.orderId).catch((e) => console.error('Order email error:', e));
            res.status(201).json({ message: 'Orden creada exitosamente', orderId: created.orderId });
        } catch (error: any) {
            console.error('Error al crear orden:', error);
            if (String(error?.message || '').toLowerCase().includes('stock insuficiente')) {
                res.status(409).json({ message: 'Stock insuficiente para completar la orden' }); return;
            }
            res.status(500).json({ message: 'Error interno del servidor', detail: error.message });
        }
    }

    // ─── GET /api/orders/my-orders ────────────────────────────────────────────
    static async getMyOrders(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user_id = req.user?.id;
            if (!user_id) { res.status(401).json({ message: 'Usuario no autenticado' }); return; }
            const orders = await OrderModel.getUserOrders(user_id);
            res.json(orders);
        } catch (error) {
            console.error('Error al obtener órdenes del usuario:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    // ─── GET /api/orders/my-orders/:id ───────────────────────────────────────
    static async getMyOrderById(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user_id = req.user?.id;
            if (!user_id) { res.status(401).json({ message: 'Usuario no autenticado' }); return; }
            const id = String(req.params['id'] || '').trim();
            if (!id) { res.status(400).json({ message: 'ID de orden requerido' }); return; }
            const order = await OrderModel.getOrderById(id, user_id);
            if (!order) { res.status(404).json({ message: 'Orden no encontrada' }); return; }
            res.status(200).json(order);
        } catch (error) {
            console.error('Error al obtener orden del usuario:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    // ─── GET /api/orders (admin) ──────────────────────────────────────────────
    static async getAllOrders(req: AuthRequest, res: Response): Promise<void> {
        try {
            const status = String(req.query['status'] || '').trim();
            const q = String(req.query['q'] || '').trim();
            const fechaDesde = String(req.query['fechaDesde'] || '').trim();
            const fechaHasta = String(req.query['fechaHasta'] || '').trim();
            const orders = await OrderModel.getAllOrders({ status, q, fechaDesde, fechaHasta });
            res.json(orders);
        } catch (error) {
            console.error('Error al obtener todas las órdenes:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    // ─── GET /api/orders/:id (admin) ──────────────────────────────────────────
    static async getOrderByIdAdmin(req: AuthRequest, res: Response): Promise<void> {
        try {
            const id = String(req.params['id'] || '').trim();
            if (!id) { res.status(400).json({ message: 'ID de orden requerido' }); return; }
            const order = await OrderModel.getAdminOrderById(id);
            if (!order) { res.status(404).json({ message: 'Orden no encontrada' }); return; }
            res.json(order);
        } catch (error) {
            console.error('Error al obtener detalle de orden:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    // ─── PATCH /api/orders/:id/status ────────────────────────────────────────
    static async updateOrderStatus(req: AuthRequest, res: Response): Promise<void> {
        try {
            const id = String(req.params['id'] || '').trim();
            const { estado, observacion } = req.body;
            const adminId = req.user?.id;

            const validStates = ['PENDIENTE', 'PAGADO', 'PROCESANDO', 'ENVIADO', 'CANCELADO', 'ENTREGADO'];
            if (!validStates.includes(estado)) {
                res.status(400).json({ message: `Estado inválido. Valores permitidos: ${validStates.join(', ')}` });
                return;
            }

            await OrderModel.updateOrderStatus(id, estado, adminId);

            // Si hay observación adicional, actualizar el historial recién creado
            if (observacion) {
                try {
                    await OrderModel.addHistorial(id, null, estado, adminId, observacion);
                } catch (_) { /* no bloquear */ }
            }

            notifyOrderStatusChanged(id, estado).catch((e) => console.error('Status email error:', e));
            res.json({ message: 'Estado actualizado exitosamente' });
        } catch (error: any) {
            console.error('Error al actualizar estado:', error);
            const msg = String(error?.message || '').toLowerCase();
            if (msg.includes('transición inválida')) {
                res.status(400).json({ message: error.message }); return;
            }
            if (msg.includes('debe registrar la guía')) {
                res.status(400).json({ message: error.message }); return;
            }
            if (msg.includes('ordenes_estado_check')) {
                res.status(400).json({ message: 'Estado no soportado. Verifique las migraciones de la base de datos.' }); return;
            }
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    // ─── POST /api/orders/:id/shipping ────────────────────────────────────────
    static async registerShipping(req: AuthRequest, res: Response): Promise<void> {
        try {
            const ordenId = String(req.params['id'] || '').trim();
            if (!ordenId) { res.status(400).json({ message: 'ID de orden requerido' }); return; }

            const { transportadora, numero_guia, link_rastreo, observacion, fecha_envio } = req.body;
            const adminId = req.user?.id;

            // Validaciones
            if (!transportadora || String(transportadora).trim() === '') {
                res.status(400).json({ message: 'La transportadora es obligatoria' }); return;
            }
            if (!numero_guia || String(numero_guia).trim() === '') {
                res.status(400).json({ message: 'El número de guía es obligatorio' }); return;
            }

            // Verificar que el pedido existe y no está en estado terminal inválido
            const estadoActual = await OrderModel.getOrderStatus(ordenId);
            if (!estadoActual) { res.status(404).json({ message: 'Pedido no encontrado' }); return; }
            if (['CANCELADO', 'ENTREGADO'].includes(estadoActual)) {
                res.status(400).json({ message: `No se puede registrar guía en un pedido ${estadoActual}` }); return;
            }

            const shippingData: RegisterShippingParams = {
                orden_id: ordenId,
                transportadora: String(transportadora).trim(),
                numero_guia: String(numero_guia).trim(),
                link_rastreo: link_rastreo ? String(link_rastreo).trim() : undefined,
                observacion: observacion ? String(observacion).trim() : undefined,
                fecha_envio: fecha_envio || undefined,
                admin_id: adminId
            };

            await OrderModel.registerShipping(shippingData);

            // Notificar al cliente por email (no bloquear)
            try {
                const order = await OrderModel.getAdminOrderById(ordenId);
                if (order?.cliente_email) {
                    await sendOrderShippingEmail({
                        to: order.cliente_email,
                        cliente_nombre: order.cliente_nombre || order.cliente_email,
                        orden_id: ordenId,
                        transportadora: shippingData.transportadora,
                        numero_guia: shippingData.numero_guia,
                        link_rastreo: shippingData.link_rastreo
                    });
                }
            } catch (emailErr) {
                console.warn('No se pudo enviar email de envío:', emailErr);
            }

            res.json({ message: 'Guía de envío registrada correctamente' });
        } catch (error: any) {
            console.error('Error al registrar envío:', error);
            res.status(500).json({ message: 'Error interno del servidor', detail: error.message });
        }
    }

    // ─── GET /api/orders/:id/pdf ──────────────────────────────────────────────
    static async getOrderPdf(req: AuthRequest, res: Response): Promise<void> {
        try {
            const orderId = String(req.params['id'] || '').trim();
            if (!orderId) { res.status(400).json({ message: 'ID de orden requerido' }); return; }

            const order = await OrderModel.getAdminOrderById(orderId);
            if (!order) { res.status(404).json({ message: 'Orden no encontrada' }); return; }

            // Verificar que el usuario tiene acceso (admin o dueño del pedido)
            const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(String(req.user?.rol || '').toUpperCase());
            if (!isAdmin && order.usuario_id !== req.user?.id) {
                res.status(403).json({ message: 'Acceso denegado' }); return;
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="pedido-${orderId.slice(0,8).toUpperCase()}.pdf"`);

            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            doc.pipe(res);

            // ── Encabezado ──────────────────────────────────────────────────
            doc.fontSize(20).font('Helvetica-Bold').text('PERFUMISSIMO', { align: 'center' });
            doc.fontSize(10).font('Helvetica').text('perfumissimocol.com', { align: 'center' });
            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
            doc.moveDown(0.5);

            // ── Info del pedido ─────────────────────────────────────────────
            doc.fontSize(13).font('Helvetica-Bold').text('DETALLE DEL PEDIDO');
            doc.moveDown(0.3);
            const row = (label: string, value: string) => {
                doc.fontSize(10).font('Helvetica-Bold').text(`${label}:`, { continued: true }).font('Helvetica').text(` ${value || '—'}`);
            };
            row('N° Pedido', String(orderId || '').slice(0, 8).toUpperCase());
            row('Fecha compra', order.creado_en ? new Date(order.creado_en).toLocaleString('es-CO') : '—');
            row('Estado pedido', order.estado || '—');

            doc.moveDown(0.5);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
            doc.moveDown(0.5);

            // ── Cliente ─────────────────────────────────────────────────────
            doc.fontSize(13).font('Helvetica-Bold').text('CLIENTE');
            doc.moveDown(0.3);
            row('Nombre', order.cliente_nombre || order.nombre_cliente || '—');
            row('Correo', order.cliente_email || '—');
            row('Teléfono', order.cliente_telefono || order.telefono || order.orden_telefono || '—');
            row('Dirección', order.direccion_envio || '—');

            doc.moveDown(0.5);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
            doc.moveDown(0.5);

            // ── Pago ────────────────────────────────────────────────────────
            doc.fontSize(13).font('Helvetica-Bold').text('INFORMACIÓN DE PAGO');
            doc.moveDown(0.3);
            row('Método de pago', order.metodo_pago || '—');
            row('Pasarela / Canal', order.canal_pago || '—');
            row('Estado del pago', order.estado_pago || '—');
            row('Referencia', order.referencia_pago || order.codigo_transaccion || '—');
            if (order.fecha_pago) row('Fecha de pago', new Date(order.fecha_pago).toLocaleString('es-CO'));

            doc.moveDown(0.5);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
            doc.moveDown(0.5);

            // ── Productos ───────────────────────────────────────────────────
            doc.fontSize(13).font('Helvetica-Bold').text('PRODUCTOS');
            doc.moveDown(0.3);

            const items: any[] = Array.isArray(order.items) ? order.items.filter((i: any) => i != null) : [];

            // Encabezado tabla
            const colX = { producto: 50, cant: 290, precio: 340, subtotal: 440 };
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('PRODUCTO', colX.producto, doc.y, { width: 230 });
            doc.text('CANT', colX.cant, doc.y - 11, { width: 45 });
            doc.text('P.UNIT', colX.precio, doc.y - 11, { width: 90 });
            doc.text('SUBTOTAL', colX.subtotal, doc.y - 11, { width: 90 });
            doc.moveDown(0.2);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#999999');
            doc.moveDown(0.2);

            let subtotalCheck = 0;
            for (const item of items) {
                const nombre = String(item.nombre || '—');
                const cant = Number(item.cantidad || 1);
                const precio = Number(item.precio_unitario || 0);
                const sub = Number(item.subtotal || precio * cant);
                subtotalCheck += sub;

                const yBefore = doc.y;
                doc.fontSize(9).font('Helvetica').text(nombre, colX.producto, yBefore, { width: 230 });
                doc.text(String(cant), colX.cant, yBefore, { width: 45 });
                doc.text(`$${precio.toLocaleString('es-CO')}`, colX.precio, yBefore, { width: 90 });
                doc.text(`$${sub.toLocaleString('es-CO')}`, colX.subtotal, yBefore, { width: 90 });
                doc.moveDown(0.8);
            }

            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
            doc.moveDown(0.3);

            // ── Totales ─────────────────────────────────────────────────────
            const totalX = 380;
            const totalValX = 460;
            const printTotal = (label: string, val: number, bold = false) => {
                const y = doc.y;
                doc.fontSize(10).font(bold ? 'Helvetica-Bold' : 'Helvetica')
                    .text(label, totalX, y, { width: 80 })
                    .text(`$${val.toLocaleString('es-CO')}`, totalValX, y, { width: 85 });
                doc.moveDown(0.5);
            };

            const costosExtra = Number(order.costo_envio_prioritario || 0) + Number(order.costo_perfume_lujo || 0);
            printTotal('Subtotal:', subtotalCheck);
            if (costosExtra > 0) printTotal('Adicionales:', costosExtra);
            printTotal('TOTAL:', Number(order.total || 0), true);

            // ── Envío ───────────────────────────────────────────────────────
            if (order.transportadora || order.numero_guia) {
                doc.moveDown(0.5);
                doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
                doc.moveDown(0.5);
                doc.fontSize(13).font('Helvetica-Bold').text('INFORMACIÓN DEL ENVÍO');
                doc.moveDown(0.3);
                if (order.transportadora) row('Transportadora', order.transportadora);
                if (order.numero_guia) row('N° de guía', order.numero_guia);
                if (order.fecha_envio) row('Fecha de envío', new Date(order.fecha_envio).toLocaleDateString('es-CO'));
                if (order.link_rastreo) row('Link de rastreo', order.link_rastreo);
                if (order.envio_observacion) row('Observación', order.envio_observacion);
            }

            // ── Historial ───────────────────────────────────────────────────
            if (Array.isArray(order.historial) && order.historial.length > 0) {
                doc.moveDown(0.5);
                doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
                doc.moveDown(0.5);
                doc.fontSize(13).font('Helvetica-Bold').text('HISTORIAL DE ESTADOS');
                doc.moveDown(0.3);
                for (const h of order.historial) {
                    const fecha = h.cambio_en ? new Date(h.cambio_en).toLocaleString('es-CO') : '—';
                    doc.fontSize(9).font('Helvetica').text(`${fecha}  →  ${h.estado_nuevo || '—'}`);
                    doc.moveDown(0.3);
                }
            }

            doc.end();
        } catch (error: any) {
            console.error('Error al generar PDF:', error);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Error al generar el PDF' });
            }
        }
    }
}
