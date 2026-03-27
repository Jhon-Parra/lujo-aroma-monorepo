import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────
export interface OrderItem {
    product_id: string;
    quantity: number;
    price: number;
}

export interface CreateOrderParams {
    user_id: string;
    shipping_address: string;
    items: OrderItem[];
    transaction_code?: string;
    telefono?: string;
    nombre_cliente?: string;
    metodo_pago?: string;
    canal_pago?: string;

    envio_prioritario?: boolean;
    perfume_lujo?: boolean;
    empaque_regalo?: boolean;

    cart_recovery_applied?: boolean;
    cart_recovery_discount_pct?: number;
}

export interface RegisterShippingParams {
    orden_id: string;
    transportadora: string;
    numero_guia: string;
    fecha_envio?: string;
    link_rastreo?: string;
    observacion?: string;
    admin_id?: string;
}

type AddonConfig = {
    envio_prioritario_precio: number;
    perfume_lujo_precio: number;
    empaque_regalo_precio: number;
    supported: boolean;
};

type OrderAddonCols = {
    subtotal_productos: boolean;
    envio_prioritario: boolean;
    costo_envio_prioritario: boolean;
    perfume_lujo: boolean;
    costo_perfume_lujo: boolean;
    empaque_regalo: boolean;
    costo_empaque_regalo: boolean;
    cart_recovery_applied: boolean;
    cart_recovery_discount_pct: boolean;
    cart_recovery_discount_amount: boolean;
};

type PaymentCols = {
    estado_pago: boolean;
    referencia_pago: boolean;
    fecha_pago: boolean;
};

let _paymentCols: PaymentCols | null = null;
const detectPaymentColumns = async (): Promise<PaymentCols> => {
    if (_paymentCols) return _paymentCols;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'ordenes'
               AND column_name IN ('estado_pago','referencia_pago','fecha_pago')`
        );
        const cols = new Set((rows || []).map((r: any) => String(r.COLUMN_NAME || r.column_name || r.Column_Name).toLowerCase()));
        _paymentCols = {
            estado_pago: cols.has('estado_pago'),
            referencia_pago: cols.has('referencia_pago'),
            fecha_pago: cols.has('fecha_pago')
        };
        return _paymentCols;
    } catch {
        _paymentCols = { estado_pago: false, referencia_pago: false, fecha_pago: false };
        return _paymentCols;
    }
};

export type CreateOrderResult = {
    orderId: string;
    subtotal_productos: number;
    envio_prioritario: boolean;
    costo_envio_prioritario: number;
    perfume_lujo: boolean;
    costo_perfume_lujo: number;
    empaque_regalo: boolean;
    costo_empaque_regalo: number;
    total: number;
};

// Mapa de transiciones válidas de estado
// Solo manejamos estados de cumplimiento/logística: PAGADO → ENVIADO → ENTREGADO | CANCELADO.
// El estado del pago (en verificación/aprobado/rechazado) se refleja en `estado_pago` cuando existe.
const VALID_TRANSITIONS: Record<string, string[]> = {
    PAGADO:    ['ENVIADO', 'CANCELADO'],
    ENVIADO:   ['ENTREGADO', 'CANCELADO'],
    ENTREGADO: [],   // terminal
    CANCELADO: [],   // terminal
    // Compatibilidad con pedidos legacy que puedan tener estos estados:
    // legacy (no usar en flujo nuevo)
    PENDIENTE:  ['PAGADO', 'ENVIADO', 'CANCELADO'],
    PROCESANDO: ['ENVIADO', 'CANCELADO'],
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: detecta tipo de ID (BINARY vs VARCHAR)
// ─────────────────────────────────────────────────────────────────────────────
let _idIsBinary: boolean | null = null;

const detectIdType = async (): Promise<boolean> => {
    if (_idIsBinary !== null) return _idIsBinary;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT DATA_TYPE FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND LOWER(table_name) IN ('ordenes','Ordenes')
               AND LOWER(column_name) = 'id'
             LIMIT 1`
        );
        const dtype = String(rows?.[0]?.DATA_TYPE || '').toLowerCase();
        _idIsBinary = dtype === 'binary' || dtype === 'varbinary';
    } catch {
        _idIsBinary = false;
    }
    return _idIsBinary;
};

const idToSql = async (uuid: string): Promise<{ expr: string; val: string }> => {
    const binary = await detectIdType();
    if (binary) return { expr: 'UUID_TO_BIN(?)', val: uuid };
    return { expr: '?', val: uuid };
};

const binToUuidExpr = async (field: string): Promise<string> => {
    const binary = await detectIdType();
    return binary ? `BIN_TO_UUID(${field})` : field;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: columnas dinámicas addon
// ─────────────────────────────────────────────────────────────────────────────
const detectAddonConfigColumns = async (): Promise<boolean> => {
    try {
        const [rows] = await pool.query<any[]>(
             `SELECT COUNT(*) AS cnt FROM information_schema.columns
              WHERE table_schema = DATABASE()
                AND lower(table_name) = 'configuracionglobal'
                AND column_name IN ('envio_prioritario_precio','perfume_lujo_precio')`
        );
        return Number(rows?.[0]?.cnt || 0) >= 2;
    } catch {
        return false;
    }
};

const getAddonConfig = async (): Promise<AddonConfig> => {
    const supported = await detectAddonConfigColumns();
    if (!supported) return { envio_prioritario_precio: 0, perfume_lujo_precio: 0, empaque_regalo_precio: 0, supported: false };
    try {
        // Detectar qué columnas de precio existen para no fallar si alguna falta
        const [existCols] = await pool.query<any[]>(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'configuracionglobal'
               AND column_name IN ('envio_prioritario_precio','perfume_lujo_precio','empaque_regalo_precio')`
        );
        const existSet = new Set((existCols || []).map((r: any) =>
            String(r.COLUMN_NAME || r.column_name || '').toLowerCase()
        ));

        const selectParts: string[] = [];
        if (existSet.has('envio_prioritario_precio')) selectParts.push('COALESCE(envio_prioritario_precio, 0) AS envio_prioritario_precio');
        else selectParts.push('0 AS envio_prioritario_precio');
        if (existSet.has('perfume_lujo_precio')) selectParts.push('COALESCE(perfume_lujo_precio, 0) AS perfume_lujo_precio');
        else selectParts.push('0 AS perfume_lujo_precio');
        if (existSet.has('empaque_regalo_precio')) selectParts.push('COALESCE(empaque_regalo_precio, 0) AS empaque_regalo_precio');
        else selectParts.push('0 AS empaque_regalo_precio');

        const [rows] = await pool.query<any[]>(`SELECT ${selectParts.join(', ')} FROM configuracionglobal WHERE id = 1`);
        const r = rows?.[0] || {};
        const ep = Number(r.envio_prioritario_precio || 0);
        const pl = Number(r.perfume_lujo_precio || 0);
        const er = Number(r.empaque_regalo_precio || 0);
        return {
            envio_prioritario_precio: Number.isFinite(ep) && ep > 0 ? ep : 0,
            perfume_lujo_precio: Number.isFinite(pl) && pl > 0 ? pl : 0,
            empaque_regalo_precio: Number.isFinite(er) && er > 0 ? er : 0,
            supported: true
        };
    } catch {
        return { envio_prioritario_precio: 0, perfume_lujo_precio: 0, empaque_regalo_precio: 0, supported: true };
    }
};

const detectOrderAddonColumns = async (): Promise<OrderAddonCols> => {
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'ordenes'
               AND column_name IN ('subtotal_productos','envio_prioritario','costo_envio_prioritario','perfume_lujo','costo_perfume_lujo','empaque_regalo','costo_empaque_regalo','cart_recovery_applied','cart_recovery_discount_pct','cart_recovery_discount_amount')`
        );
        const cols = new Set((rows || []).map((r: any) => String(r.COLUMN_NAME || r.column_name || r.Column_Name).toLowerCase()));
        return {
            subtotal_productos: cols.has('subtotal_productos'),
            envio_prioritario: cols.has('envio_prioritario'),
            costo_envio_prioritario: cols.has('costo_envio_prioritario'),
            perfume_lujo: cols.has('perfume_lujo'),
            costo_perfume_lujo: cols.has('costo_perfume_lujo'),
            empaque_regalo: cols.has('empaque_regalo'),
            costo_empaque_regalo: cols.has('costo_empaque_regalo'),
            cart_recovery_applied: cols.has('cart_recovery_applied'),
            cart_recovery_discount_pct: cols.has('cart_recovery_discount_pct'),
            cart_recovery_discount_amount: cols.has('cart_recovery_discount_amount')
        };
    } catch {
        return {
            subtotal_productos: false, envio_prioritario: false, costo_envio_prioritario: false,
            perfume_lujo: false, costo_perfume_lujo: false,
            empaque_regalo: false, costo_empaque_regalo: false,
            cart_recovery_applied: false,
            cart_recovery_discount_pct: false, cart_recovery_discount_amount: false
        };
    }
};

const computeSubtotal = (items: OrderItem[]): number =>
    round2((items || []).reduce((sum, it) => {
        const qty = Math.max(0, Math.trunc(Number(it?.quantity || 0)));
        const price = Number(it?.price || 0);
        if (!qty || !Number.isFinite(price) || price < 0) return sum;
        return sum + price * qty;
    }, 0));

// ─────────────────────────────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────────────────────────────
export class OrderModel {

    // ── Validar transición de estado ──────────────────────────────────────────
    static isValidTransition(actual: string, nuevo: string): boolean {
        const allowed = VALID_TRANSITIONS[actual?.toUpperCase()] || [];
        return allowed.includes(nuevo?.toUpperCase());
    }

    static async getOrderStatus(orderId: string): Promise<string | null> {
        const id = String(orderId || '').trim();
        if (!id) return null;
        const { expr, val } = await idToSql(id);
        const [rows] = await pool.query<any[]>(
            `SELECT estado FROM ordenes WHERE id = ${expr} LIMIT 1`, [val]
        );
        return String(rows?.[0]?.estado || '').trim() || null;
    }

    // ── Crear pedido ──────────────────────────────────────────────────────────
    static async createOrder(orderData: CreateOrderParams): Promise<CreateOrderResult> {
        const connection = await pool.getConnection();
        try {
            await connection.query('BEGIN');

            const orderId = uuidv4();
            const binary = await detectIdType();
            const subtotal_productos = computeSubtotal(orderData.items);
            if (!Number.isFinite(subtotal_productos) || subtotal_productos <= 0) {
                throw new Error('Total de la orden inválido');
            }

            const addons = await getAddonConfig();
            const envio_prioritario = !!orderData.envio_prioritario;
            const perfume_lujo = !!orderData.perfume_lujo;
            const empaque_regalo = !!orderData.empaque_regalo;
            const costo_envio_prioritario = envio_prioritario ? round2(addons.envio_prioritario_precio) : 0;
            const costo_perfume_lujo = perfume_lujo ? round2(addons.perfume_lujo_precio) : 0;
            const costo_empaque_regalo = empaque_regalo ? round2(addons.empaque_regalo_precio) : 0;
            const cart_recovery_applied = !!orderData.cart_recovery_applied;
            const cart_recovery_discount_pct = cart_recovery_applied
                ? Math.max(0, Math.min(80, Math.trunc(Number(orderData.cart_recovery_discount_pct || 0)))) : 0;
            const cart_recovery_discount_amount = cart_recovery_applied
                ? round2(subtotal_productos * (cart_recovery_discount_pct / 100)) : 0;
            const total = round2(
                Math.max(0, subtotal_productos - cart_recovery_discount_amount) +
                costo_envio_prioritario + costo_perfume_lujo + costo_empaque_regalo
            );

            const addonCols = await detectOrderAddonColumns();
            const paymentCols = await detectPaymentColumns();
            const idExpr = binary ? 'UUID_TO_BIN(?)' : '?';

            const initialEstado = 'PAGADO';

            const cols: string[] = ['id', 'usuario_id', 'total', 'direccion_envio', 'estado', 'codigo_transaccion', 'telefono', 'nombre_cliente', 'metodo_pago', 'canal_pago'];
            const vals: any[] = [
                orderId, orderData.user_id, total, orderData.shipping_address, initialEstado,
                orderData.transaction_code || null,
                orderData.telefono || null,
                orderData.nombre_cliente || null,
                orderData.metodo_pago || null,
                orderData.canal_pago || null,
            ];

            // Estado del pago (si la columna existe): inicia como PENDIENTE hasta confirmación Wompi.
            if (paymentCols.estado_pago) { cols.push('estado_pago'); vals.push('PENDIENTE'); }

            if (addonCols.subtotal_productos) { cols.push('subtotal_productos'); vals.push(subtotal_productos); }
            if (addonCols.envio_prioritario) { cols.push('envio_prioritario'); vals.push(envio_prioritario); }
            if (addonCols.costo_envio_prioritario) { cols.push('costo_envio_prioritario'); vals.push(costo_envio_prioritario); }
            if (addonCols.perfume_lujo) { cols.push('perfume_lujo'); vals.push(perfume_lujo); }
            if (addonCols.costo_perfume_lujo) { cols.push('costo_perfume_lujo'); vals.push(costo_perfume_lujo); }
            if (addonCols.empaque_regalo) { cols.push('empaque_regalo'); vals.push(empaque_regalo); }
            if (addonCols.costo_empaque_regalo) { cols.push('costo_empaque_regalo'); vals.push(costo_empaque_regalo); }
            if (addonCols.cart_recovery_applied) { cols.push('cart_recovery_applied'); vals.push(cart_recovery_applied); }
            if (addonCols.cart_recovery_discount_pct) { cols.push('cart_recovery_discount_pct'); vals.push(cart_recovery_discount_pct); }
            if (addonCols.cart_recovery_discount_amount) { cols.push('cart_recovery_discount_amount'); vals.push(cart_recovery_discount_amount); }

            const placeholders = cols.map((c) =>
                (c === 'id' || c === 'usuario_id') ? idExpr : '?'
            ).join(', ');

            await connection.query(
                `INSERT INTO ordenes (${cols.join(', ')}) VALUES (${placeholders})`, vals
            );

            // Items con snapshots del producto
            for (const item of orderData.items) {
                const itemId = uuidv4();
                const subtotal_item = round2(Number(item.price) * Number(item.quantity));

                // Obtener snapshot del producto (nombre e imagen)
                const [prodRows] = await connection.query(
                    binary
                        ? 'SELECT nombre, imagen_url FROM productos WHERE id = UUID_TO_BIN(?)'
                        : 'SELECT nombre, imagen_url FROM productos WHERE id = ?',
                    [item.product_id]
                );
                const prod = (prodRows as any[])?.[0];
                const nombre_snapshot = prod?.nombre || null;
                const imagen_snapshot = prod?.imagen_url || null;

                await connection.query(
                    binary
                        ? `INSERT INTO detalleordenes (id, orden_id, producto_id, cantidad, precio_unitario, nombre_producto, imagen_url, subtotal_snapshot)
                           VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?, ?, ?)`
                        : `INSERT INTO detalleordenes (id, orden_id, producto_id, cantidad, precio_unitario, nombre_producto, imagen_url, subtotal_snapshot)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [itemId, orderId, item.product_id, item.quantity, item.price, nombre_snapshot, imagen_snapshot, subtotal_item]
                );

                const [stockResult] = await connection.query(
                    binary
                        ? 'UPDATE productos SET stock = stock - ? WHERE id = UUID_TO_BIN(?) AND stock >= ?'
                        : 'UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?',
                    [item.quantity, item.product_id, item.quantity]
                );

                if ((stockResult as any)?.affectedRows === 0) {
                    throw new Error('Stock insuficiente para completar la orden');
                }
            }

            // Historial: estado inicial
            await connection.query(
                `INSERT INTO historial_pedido (id, orden_id, estado_anterior, estado_nuevo, observacion)
                 VALUES (${binary ? 'UUID_TO_BIN(?)' : '?'}, ${binary ? 'UUID_TO_BIN(?)' : '?'}, NULL, ?, ?)`,
                [uuidv4(), orderId, initialEstado, 'Pedido creado. Pago en verificacion.']
            );

            await connection.query('COMMIT');
            return { orderId, subtotal_productos, envio_prioritario, costo_envio_prioritario, perfume_lujo, costo_perfume_lujo, empaque_regalo, costo_empaque_regalo, total };
        } catch (error) {
            await connection.query('ROLLBACK');
            throw error;
        } finally {
            connection.release();
        }
    }

    static async markCartSessionConverted(sessionId: string, orderId: string): Promise<void> {
        const binary = await detectIdType();
        await pool.query(
            `UPDATE cartsessions SET status = 'CONVERTED', order_id = ${binary ? 'UUID_TO_BIN(?)' : '?'}, updated_at = NOW() WHERE session_id = ?`,
            [orderId, sessionId]
        );
    }

    // ── Historial de estados ──────────────────────────────────────────────────
    /** Registra un cambio en el historial del pedido */
    static async addHistorial(
        ordenId: string,
        estadoAnterior: string | null,
        estadoNuevo: string,
        adminId?: string | null,
        observacion?: string | null
    ): Promise<void> {
        const binary = await detectIdType();
        const idExpr = binary ? 'UUID_TO_BIN(?)' : '?';

        await pool.query(
            `INSERT INTO historial_pedido (id, orden_id, estado_anterior, estado_nuevo, admin_id, observacion)
             VALUES (${idExpr}, ${idExpr}, ?, ?, ${adminId ? idExpr : 'NULL'}, ?)`,
            [
                uuidv4(),
                ordenId,
                estadoAnterior || null,
                estadoNuevo,
                ...(adminId ? [adminId] : []),
                observacion || null
            ].filter((v, i) => {
                // Si adminId es null, el placeholder es 'NULL', así que no pasamos parámetro
                return true; 
            })
        );
    }

    static async getHistorial(ordenId: string): Promise<any[]> {
        const [rows] = await pool.query<any[]>(
            `SELECT h.estado_anterior, h.estado_nuevo, h.cambio_en, h.observacion,
                    CONCAT(COALESCE(u.nombre,''), ' ', COALESCE(u.apellido,'')) AS admin_nombre
             FROM historial_pedido h
             LEFT JOIN usuarios u ON u.id = h.admin_id
             WHERE h.orden_id = ?
             ORDER BY h.cambio_en ASC`,
            [ordenId]
        );
        return rows || [];
    }

    // ── Envíos ────────────────────────────────────────────────────────────────
    static async registerShipping(data: RegisterShippingParams): Promise<void> {
        const binary = await detectIdType();
        const idExpr = binary ? 'UUID_TO_BIN(?)' : '?';
        const envioId = uuidv4();

        await pool.query(
            `INSERT INTO envios (id, orden_id, transportadora, numero_guia, fecha_envio, link_rastreo, observacion, admin_id)
             VALUES (${idExpr}, ${idExpr}, ?, ?, ?, ?, ?, ${data.admin_id ? idExpr : 'NULL'})
             ON DUPLICATE KEY UPDATE
               transportadora = VALUES(transportadora),
               numero_guia = VALUES(numero_guia),
               link_rastreo = VALUES(link_rastreo),
               observacion = VALUES(observacion),
               admin_id = VALUES(admin_id)`,
            [
                envioId,
                data.orden_id,
                data.transportadora,
                data.numero_guia,
                data.fecha_envio || new Date().toISOString(),
                data.link_rastreo || null,
                data.observacion || null,
                ...(data.admin_id ? [data.admin_id] : [])
            ]
        );
    }

    static async getShipping(ordenId: string): Promise<any | null> {
        const [rows] = await pool.query<any[]>(
            `SELECT transportadora, numero_guia, fecha_envio, link_rastreo, observacion FROM envios WHERE orden_id = ? LIMIT 1`,
            [ordenId]
        );
        return (rows as any[])?.[0] || null;
    }

    // ── Actualizar estado con validación de transición ────────────────────────
    static async updateOrderStatus(orderId: string, estado: string, adminId?: string): Promise<void> {
        const estadoActual = await this.getOrderStatus(orderId);
        if (!estadoActual) throw new Error('Pedido no encontrado');

        if (!this.isValidTransition(estadoActual, estado)) {
            throw new Error(`Transición inválida: no se puede pasar de ${estadoActual} a ${estado}`);
        }

        // Verificar que ENVIADO requiere guía registrada
        if (estado === 'ENVIADO') {
            const envio = await this.getShipping(orderId);
            if (!envio) throw new Error('Debe registrar la guía de envío antes de marcar como ENVIADO');
        }

        const { expr, val } = await idToSql(orderId);
        await pool.query(
            `UPDATE ordenes SET estado = ?, actualizado_en = NOW() WHERE id = ${expr}`,
            [estado, val]
        );

        await this.addHistorial(orderId, estadoActual, estado, adminId || null, null);
    }

    static async updateTransactionCode(orderId: string, transactionCode: string | null): Promise<void> {
        const { expr, val } = await idToSql(orderId);
        await pool.query(
            `UPDATE ordenes SET codigo_transaccion = ?, actualizado_en = NOW() WHERE id = ${expr}`,
            [transactionCode, val]
        );
    }

    static async updatePaymentInfo(orderId: string, data: { estado_pago?: string; referencia_pago?: string | null; fecha_pago?: Date | null }): Promise<void> {
        const cols = await detectPaymentColumns();
        const sets: string[] = [];
        const params: any[] = [];

        if (cols.estado_pago && data.estado_pago !== undefined) {
            sets.push('estado_pago = ?');
            params.push(data.estado_pago);
        }
        if (cols.referencia_pago && data.referencia_pago !== undefined) {
            sets.push('referencia_pago = ?');
            params.push(data.referencia_pago);
        }
        if (cols.fecha_pago && data.fecha_pago !== undefined) {
            sets.push('fecha_pago = ?');
            params.push(data.fecha_pago);
        }

        if (!sets.length) return;

        const { expr, val } = await idToSql(orderId);
        sets.push('actualizado_en = NOW()');
        await pool.query(
            `UPDATE ordenes SET ${sets.join(', ')} WHERE id = ${expr}`,
            [...params, val]
        );
    }

    static async reinstateCancelledOrderPaid(orderId: string): Promise<void> {
        const connection = await pool.getConnection();
        const binary = await detectIdType();
        const idExpr = binary ? 'UUID_TO_BIN(?)' : '?';
        const productoIdRead = binary ? 'BIN_TO_UUID(producto_id)' : 'producto_id';

        try {
            await connection.query('BEGIN');

            const [resOrder] = await connection.query(
                `SELECT estado FROM ordenes WHERE id = ${idExpr} FOR UPDATE`,
                [orderId]
            );
            const current = String((resOrder as any)?.[0]?.estado || '').toUpperCase();
            if (current !== 'CANCELADO') {
                await connection.query('COMMIT');
                return;
            }

            const [resItems] = await connection.query(
                `SELECT ${productoIdRead} AS producto_id, cantidad FROM detalleordenes WHERE orden_id = ${idExpr}`,
                [orderId]
            );

            for (const it of (resItems as any[] || [])) {
                const pid = String(it?.producto_id || '').trim();
                const qty = Number(it?.cantidad || 0);
                if (!pid || !Number.isFinite(qty) || qty <= 0) continue;

                const [stockResult] = await connection.query(
                    binary
                        ? 'UPDATE productos SET stock = stock - ? WHERE id = UUID_TO_BIN(?) AND stock >= ?'
                        : 'UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?',
                    [qty, pid, qty]
                );

                if ((stockResult as any)?.affectedRows === 0) {
                    throw new Error('Stock insuficiente para reactivar el pedido pagado');
                }
            }

            await connection.query(
                `UPDATE ordenes SET estado = ?, actualizado_en = NOW() WHERE id = ${idExpr}`,
                ['PAGADO', orderId]
            );

            await connection.query(
                `INSERT INTO historial_pedido (id, orden_id, estado_anterior, estado_nuevo, observacion)
                 VALUES (${idExpr}, ${idExpr}, ?, ?, ?)`,
                [uuidv4(), orderId, 'CANCELADO', 'PAGADO', 'Pago aprobado en Wompi (reconciliado)']
            );

            await connection.query('COMMIT');
        } catch (e) {
            await connection.query('ROLLBACK');
            throw e;
        } finally {
            connection.release();
        }
    }

    static async cancelAndRestock(orderId: string): Promise<void> {
        const connection = await pool.getConnection();
        const binary = await detectIdType();
        const idExpr = binary ? 'UUID_TO_BIN(?)' : '?';
        const productoIdRead = binary ? 'BIN_TO_UUID(producto_id)' : 'producto_id';

        try {
            await connection.query('BEGIN');
            const [resOrder] = await connection.query(
                `SELECT estado FROM ordenes WHERE id = ${idExpr} FOR UPDATE`, [orderId]
            );
            const current = (resOrder as any)?.[0]?.estado;
            if (String(current || '').toUpperCase() === 'CANCELADO') {
                await connection.query('COMMIT');
                return;
            }

            await connection.query(
                `UPDATE ordenes SET estado = ?, actualizado_en = NOW() WHERE id = ${idExpr}`,
                ['CANCELADO', orderId]
            );

            const [resItems] = await connection.query(
                `SELECT ${productoIdRead} AS producto_id, cantidad FROM detalleordenes WHERE orden_id = ${idExpr}`,
                [orderId]
            );
            for (const it of (resItems as any[] || [])) {
                const pid = it?.producto_id;
                const qty = Number(it?.cantidad || 0);
                if (!pid || !Number.isFinite(qty) || qty <= 0) continue;
                await connection.query(
                    binary ? 'UPDATE productos SET stock = stock + ? WHERE id = UUID_TO_BIN(?)'
                           : 'UPDATE productos SET stock = stock + ? WHERE id = ?',
                    [qty, pid]
                );
            }

            await connection.query('COMMIT');
        } catch (e) {
            await connection.query('ROLLBACK');
            throw e;
        } finally {
            connection.release();
        }
    }

    // ── Pedidos del usuario ───────────────────────────────────────────────────
    static async getUserOrders(userId: string) {
        const addonCols = await detectOrderAddonColumns();
        const binary = await detectIdType();
        const idExprRead = binary ? 'BIN_TO_UUID(o.id)' : 'o.id';
        const productoIdRead = binary ? 'BIN_TO_UUID(d.producto_id)' : 'd.producto_id';
        const userWhere = binary ? 'UUID_TO_BIN(?)' : '?';

        const extraSelect = [
            addonCols.subtotal_productos ? 'o.subtotal_productos' : null,
            addonCols.envio_prioritario ? 'o.envio_prioritario' : null,
            addonCols.costo_envio_prioritario ? 'o.costo_envio_prioritario' : null,
            addonCols.perfume_lujo ? 'o.perfume_lujo' : null,
            addonCols.costo_perfume_lujo ? 'o.costo_perfume_lujo' : null
        ].filter(Boolean).join(', ');

        const [rows] = await pool.query(
            `SELECT 
                ${idExprRead} AS id,
                o.total, o.estado, o.direccion_envio, o.codigo_transaccion, o.creado_en,
                o.telefono, o.nombre_cliente, o.metodo_pago, o.canal_pago, o.estado_pago, o.referencia_pago
                ${extraSelect ? `, ${extraSelect}` : ''},
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'producto_id', ${productoIdRead},
                        'nombre', COALESCE(d.nombre_producto, p.nombre),
                        'cantidad', d.cantidad,
                        'precio_unitario', d.precio_unitario,
                        'subtotal', COALESCE(d.subtotal_snapshot, d.subtotal),
                        'imagen_url', COALESCE(d.imagen_url, p.imagen_url)
                    )
                ) AS items,
                (SELECT JSON_ARRAYAGG(JSON_OBJECT('estado_nuevo', h.estado_nuevo, 'cambio_en', h.cambio_en))
                 FROM historial_pedido h WHERE h.orden_id = o.id) AS historial,
                e.transportadora, e.numero_guia, e.fecha_envio, e.link_rastreo
            FROM ordenes o
            LEFT JOIN detalleordenes d ON d.orden_id = o.id
            LEFT JOIN productos p ON p.id = d.producto_id
            LEFT JOIN envios e ON e.orden_id = o.id
            WHERE o.usuario_id = ${userWhere}
            GROUP BY o.id ${extraSelect ? `, ${extraSelect}` : ''}
            ORDER BY o.creado_en DESC`,
            [userId]
        );
        return rows;
    }

    // ── Todos los pedidos (admin) ─────────────────────────────────────────────
    static async getAllOrders(filters?: { status?: string; q?: string; fechaDesde?: string; fechaHasta?: string }) {
        const status = (filters?.status || '').trim();
        const q = (filters?.q || '').trim();
        const fechaDesde = (filters?.fechaDesde || '').trim();
        const fechaHasta = (filters?.fechaHasta || '').trim();
        const binary = await detectIdType();
        const idExprRead = binary ? 'BIN_TO_UUID(o.id)' : 'o.id';

        const params: any[] = [];
        let where = 'WHERE 1=1';

        if (status) { params.push(status); where += ` AND o.estado = ?`; }
        if (fechaDesde) { params.push(fechaDesde); where += ` AND DATE(o.creado_en) >= ?`; }
        if (fechaHasta) { params.push(fechaHasta); where += ` AND DATE(o.creado_en) <= ?`; }
        if (q) {
            params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
            where += ` AND (
                ${idExprRead} LIKE ?
                OR CONCAT(COALESCE(u.nombre,''), ' ', COALESCE(u.apellido,'')) LIKE ?
                OR u.email LIKE ?
                OR o.nombre_cliente LIKE ?
                OR o.telefono LIKE ?
            )`;
        }

        const [rows] = await pool.query(
            `SELECT 
                ${idExprRead} AS id,
                o.total, o.estado, o.direccion_envio, o.codigo_transaccion, o.creado_en,
                o.telefono, o.nombre_cliente, o.metodo_pago, o.canal_pago, o.estado_pago, o.referencia_pago,
                CONCAT(COALESCE(u.nombre,''), ' ', COALESCE(u.apellido,'')) AS cliente_nombre,
                u.email AS cliente_email,
                COALESCE(u.telefono, o.telefono) AS cliente_telefono,
                COUNT(d.id) AS total_items
            FROM ordenes o
            LEFT JOIN usuarios u ON u.id = o.usuario_id
            LEFT JOIN detalleordenes d ON d.orden_id = o.id
            ${where}
            GROUP BY o.id, u.nombre, u.apellido, u.email, u.telefono
            ORDER BY o.creado_en DESC`,
            params
        );
        return rows;
    }

    // ── Detalle de un pedido (cliente) ────────────────────────────────────────
    static async getOrderById(orderId: string, userId?: string) {
        const addonCols = await detectOrderAddonColumns();
        const binary = await detectIdType();
        const idExprRead = binary ? 'BIN_TO_UUID(o.id)' : 'o.id';
        const productoIdRead = binary ? 'BIN_TO_UUID(d.producto_id)' : 'd.producto_id';
        const idExprWhere = binary ? 'UUID_TO_BIN(?)' : '?';

        const extraSelect = [
            addonCols.subtotal_productos ? 'o.subtotal_productos' : null,
            addonCols.envio_prioritario ? 'o.envio_prioritario' : null,
            addonCols.costo_envio_prioritario ? 'o.costo_envio_prioritario' : null,
            addonCols.perfume_lujo ? 'o.perfume_lujo' : null,
            addonCols.costo_perfume_lujo ? 'o.costo_perfume_lujo' : null
        ].filter(Boolean).join(', ');

        let query = `
            SELECT 
                ${idExprRead} AS id, o.total, o.estado, o.direccion_envio, o.codigo_transaccion, o.creado_en,
                o.telefono, o.nombre_cliente, o.metodo_pago, o.canal_pago, o.estado_pago
                ${extraSelect ? `, ${extraSelect}` : ''},
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'producto_id', ${productoIdRead},
                        'nombre', COALESCE(d.nombre_producto, p.nombre),
                        'cantidad', d.cantidad,
                        'precio_unitario', d.precio_unitario,
                        'subtotal', COALESCE(d.subtotal_snapshot, d.subtotal),
                        'imagen_url', COALESCE(d.imagen_url, p.imagen_url)
                    )
                ) AS items,
                e.transportadora, e.numero_guia, e.fecha_envio, e.link_rastreo
            FROM ordenes o
            LEFT JOIN detalleordenes d ON d.orden_id = o.id
            LEFT JOIN productos p ON p.id = d.producto_id
            LEFT JOIN envios e ON e.orden_id = o.id
            WHERE o.id = ${idExprWhere}`;

        const params: string[] = [orderId];
        if (userId) { query += ` AND o.usuario_id = ${idExprWhere}`; params.push(userId); }
        query += ` GROUP BY o.id ${extraSelect ? `, ${extraSelect}, e.transportadora, e.numero_guia, e.fecha_envio, e.link_rastreo` : ', e.transportadora, e.numero_guia, e.fecha_envio, e.link_rastreo'}`;
        const [rows] = await pool.query(query, params);
        return (rows as any[])[0] || null;
    }

    // ── Detalle de un pedido (admin) ──────────────────────────────────────────
    static async getAdminOrderById(orderId: string) {
        const addonCols = await detectOrderAddonColumns();
        const binary = await detectIdType();
        const idExprRead = binary ? 'BIN_TO_UUID(o.id)' : 'o.id';
        const productoIdRead = binary ? 'BIN_TO_UUID(d.producto_id)' : 'd.producto_id';
        const idExprWhere = binary ? 'UUID_TO_BIN(?)' : '?';

        const extraSelect = [
            addonCols.subtotal_productos ? 'o.subtotal_productos' : null,
            addonCols.envio_prioritario ? 'o.envio_prioritario' : null,
            addonCols.costo_envio_prioritario ? 'o.costo_envio_prioritario' : null,
            addonCols.perfume_lujo ? 'o.perfume_lujo' : null,
            addonCols.costo_perfume_lujo ? 'o.costo_perfume_lujo' : null
        ].filter(Boolean).join(', ');

        const [rows] = await pool.query<any[]>(
            `SELECT 
                ${idExprRead} AS id,
                o.total, o.estado, o.direccion_envio, o.codigo_transaccion, o.creado_en,
                o.telefono AS orden_telefono, o.nombre_cliente,
                o.metodo_pago, o.canal_pago, o.estado_pago, o.referencia_pago, o.fecha_pago
                ${extraSelect ? `, ${extraSelect}` : ''},
                CONCAT(COALESCE(u.nombre,''), ' ', COALESCE(u.apellido,'')) AS cliente_nombre,
                u.email AS cliente_email,
                COALESCE(o.telefono, u.telefono) AS cliente_telefono,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'producto_id', ${productoIdRead},
                        'nombre', COALESCE(d.nombre_producto, p.nombre),
                        'cantidad', d.cantidad,
                        'precio_unitario', d.precio_unitario,
                        'subtotal', COALESCE(d.subtotal_snapshot, d.subtotal),
                        'imagen_url', COALESCE(d.imagen_url, p.imagen_url)
                    )
                ) AS items,
                e.transportadora, e.numero_guia, e.fecha_envio, e.link_rastreo, e.observacion AS envio_observacion
            FROM ordenes o
            LEFT JOIN usuarios u ON u.id = o.usuario_id
            LEFT JOIN detalleordenes d ON d.orden_id = o.id
            LEFT JOIN productos p ON p.id = d.producto_id
            LEFT JOIN envios e ON e.orden_id = o.id
            WHERE o.id = ${idExprWhere}
            GROUP BY o.id, u.nombre, u.apellido, u.email, u.telefono, e.transportadora, e.numero_guia, e.fecha_envio, e.link_rastreo, e.observacion
                     ${extraSelect ? `, ${extraSelect}` : ''}`,
            [orderId]
        );

        const order = rows?.[0] || null;
        if (!order) return null;

        // Adjuntar historial
        const historial = await this.getHistorial(orderId);
        return { ...order, historial };
    }
}
