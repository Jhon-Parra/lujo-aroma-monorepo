import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

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

    envio_prioritario?: boolean;
    perfume_lujo?: boolean;

    cart_recovery_applied?: boolean;
    cart_recovery_discount_pct?: number;
}

type AddonConfig = {
    envio_prioritario_precio: number;
    perfume_lujo_precio: number;
    supported: boolean;
};

type OrderAddonCols = {
    subtotal_productos: boolean;
    envio_prioritario: boolean;
    costo_envio_prioritario: boolean;
    perfume_lujo: boolean;
    costo_perfume_lujo: boolean;
    cart_recovery_applied: boolean;
    cart_recovery_discount_pct: boolean;
    cart_recovery_discount_amount: boolean;
};

export type CreateOrderResult = {
    orderId: string;
    subtotal_productos: number;
    envio_prioritario: boolean;
    costo_envio_prioritario: number;
    perfume_lujo: boolean;
    costo_perfume_lujo: number;
    total: number;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: detecta si las IDs se guardan como BINARY(16) o CHAR(36)/VARCHAR
// ─────────────────────────────────────────────────────────────────────────────
let _idIsBinary: boolean | null = null;

const detectIdType = async (): Promise<boolean> => {
    if (_idIsBinary !== null) return _idIsBinary;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT DATA_TYPE
             FROM information_schema.columns
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

/**
 * Convierte un UUID string al formato adecuado para usar en WHERE id = ?
 * Si las IDs son BINARY(16) devuelve UUID_TO_BIN(?) como expresión SQL y
 * el valor para el placeholder; si no, devuelve '?' y el string tal cual.
 */
const idToSql = async (uuid: string): Promise<{ expr: string; val: string }> => {
    const binary = await detectIdType();
    if (binary) return { expr: 'UUID_TO_BIN(?)', val: uuid };
    return { expr: '?', val: uuid };
};

/**
 * Función SQL para leer un campo BINARY(16) de ID como UUID legible.
 * Si no es binario, simplemente usa el campo tal cual.
 */
const binToUuidExpr = async (field: string): Promise<string> => {
    const binary = await detectIdType();
    return binary ? `BIN_TO_UUID(${field})` : field;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: columnas dinámicas
// ─────────────────────────────────────────────────────────────────────────────
const detectAddonConfigColumns = async (): Promise<boolean> => {
    try {
        const [rows] = await pool.query<any[]>(
             `SELECT COUNT(*) AS cnt
             FROM information_schema.columns
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
    if (!supported) {
        return { envio_prioritario_precio: 0, perfume_lujo_precio: 0, supported: false };
    }

    try {
        const [rows] = await pool.query<any[]>(
            'SELECT COALESCE(envio_prioritario_precio, 0) AS envio_prioritario_precio, COALESCE(perfume_lujo_precio, 0) AS perfume_lujo_precio FROM ConfiguracionGlobal WHERE id = 1'
        );
        const r = rows?.[0] || {};
        const ep = Number(r.envio_prioritario_precio || 0);
        const pl = Number(r.perfume_lujo_precio || 0);
        return {
            envio_prioritario_precio: Number.isFinite(ep) && ep > 0 ? ep : 0,
            perfume_lujo_precio: Number.isFinite(pl) && pl > 0 ? pl : 0,
            supported: true
        };
    } catch {
        return { envio_prioritario_precio: 0, perfume_lujo_precio: 0, supported: true };
    }
};

const detectOrderAddonColumns = async (): Promise<OrderAddonCols> => {
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'ordenes'
               AND column_name IN ('subtotal_productos','envio_prioritario','costo_envio_prioritario','perfume_lujo','costo_perfume_lujo','cart_recovery_applied','cart_recovery_discount_pct','cart_recovery_discount_amount')`
        );
        const cols = new Set((rows || []).map((r: any) => String(r.COLUMN_NAME || r.column_name || r.Column_Name).toLowerCase()));
        return {
            subtotal_productos: cols.has('subtotal_productos'),
            envio_prioritario: cols.has('envio_prioritario'),
            costo_envio_prioritario: cols.has('costo_envio_prioritario'),
            perfume_lujo: cols.has('perfume_lujo'),
            costo_perfume_lujo: cols.has('costo_perfume_lujo'),
            cart_recovery_applied: cols.has('cart_recovery_applied'),
            cart_recovery_discount_pct: cols.has('cart_recovery_discount_pct'),
            cart_recovery_discount_amount: cols.has('cart_recovery_discount_amount')
        };
    } catch {
        return {
            subtotal_productos: false,
            envio_prioritario: false,
            costo_envio_prioritario: false,
            perfume_lujo: false,
            costo_perfume_lujo: false,
            cart_recovery_applied: false,
            cart_recovery_discount_pct: false,
            cart_recovery_discount_amount: false
        };
    }
};

const computeSubtotal = (items: OrderItem[]): number => {
    return round2(
        (items || []).reduce((sum, it) => {
            const qty = Math.max(0, Math.trunc(Number(it?.quantity || 0)));
            const price = Number(it?.price || 0);
            if (!qty || !Number.isFinite(price) || price < 0) return sum;
            return sum + (price * qty);
        }, 0)
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────────────────────────────
export class OrderModel {
    static async getOrderStatus(orderId: string): Promise<string | null> {
        const id = String(orderId || '').trim();
        if (!id) return null;
        const { expr, val } = await idToSql(id);
        const [rows] = await pool.query<any[]>(
            `SELECT estado FROM Ordenes WHERE id = ${expr} LIMIT 1`,
            [val]
        );
        const estado = String(rows?.[0]?.estado || '').trim();
        return estado || null;
    }

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
            const costo_envio_prioritario = envio_prioritario ? round2(addons.envio_prioritario_precio) : 0;
            const costo_perfume_lujo = perfume_lujo ? round2(addons.perfume_lujo_precio) : 0;
            const cart_recovery_applied = !!orderData.cart_recovery_applied;
            const cart_recovery_discount_pct = cart_recovery_applied
                ? Math.max(0, Math.min(80, Math.trunc(Number(orderData.cart_recovery_discount_pct || 0))))
                : 0;
            const cart_recovery_discount_amount = cart_recovery_applied
                ? round2(subtotal_productos * (cart_recovery_discount_pct / 100))
                : 0;
            const total = round2(Math.max(0, subtotal_productos - cart_recovery_discount_amount) + costo_envio_prioritario + costo_perfume_lujo);

            const addonCols = await detectOrderAddonColumns();

            // IDs como expresión correcta según el tipo de columna
            const idExpr = binary ? 'UUID_TO_BIN(?)' : '?';

            const cols: string[] = ['id', 'usuario_id', 'total', 'direccion_envio', 'estado', 'codigo_transaccion'];
            const vals: any[] = [orderId, orderData.user_id, total, orderData.shipping_address, 'PENDIENTE', orderData.transaction_code || null];

            if (addonCols.subtotal_productos) { cols.push('subtotal_productos'); vals.push(subtotal_productos); }
            if (addonCols.envio_prioritario) { cols.push('envio_prioritario'); vals.push(envio_prioritario); }
            if (addonCols.costo_envio_prioritario) { cols.push('costo_envio_prioritario'); vals.push(costo_envio_prioritario); }
            if (addonCols.perfume_lujo) { cols.push('perfume_lujo'); vals.push(perfume_lujo); }
            if (addonCols.costo_perfume_lujo) { cols.push('costo_perfume_lujo'); vals.push(costo_perfume_lujo); }
            if (addonCols.cart_recovery_applied) { cols.push('cart_recovery_applied'); vals.push(cart_recovery_applied); }
            if (addonCols.cart_recovery_discount_pct) { cols.push('cart_recovery_discount_pct'); vals.push(cart_recovery_discount_pct); }
            if (addonCols.cart_recovery_discount_amount) { cols.push('cart_recovery_discount_amount'); vals.push(cart_recovery_discount_amount); }

            // Reemplazar los dos primeros '?' por UUID_TO_BIN si aplica
            const placeholders = cols.map((c) =>
                (c === 'id' || c === 'usuario_id') ? idExpr : '?'
            ).join(', ');

            await connection.query(
                `INSERT INTO Ordenes (${cols.join(', ')}) VALUES (${placeholders})`,
                vals
            );

            for (const item of orderData.items) {
                const itemId = uuidv4();
                await connection.query(
                    binary
                        ? `INSERT INTO Detalle_Ordenes (id, orden_id, producto_id, cantidad, precio_unitario)
                           VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)`
                        : `INSERT INTO Detalle_Ordenes (id, orden_id, producto_id, cantidad, precio_unitario)
                           VALUES (?, ?, ?, ?, ?)`,
                    [itemId, orderId, item.product_id, item.quantity, item.price]
                );

                const [stockResult] = await connection.query(
                    binary
                        ? 'UPDATE Productos SET stock = stock - ? WHERE id = UUID_TO_BIN(?) AND stock >= ?'
                        : 'UPDATE Productos SET stock = stock - ? WHERE id = ? AND stock >= ?',
                    [item.quantity, item.product_id, item.quantity]
                );

                if ((stockResult as any)?.affectedRows === 0) {
                    throw new Error('Stock insuficiente para completar la orden');
                }
            }

            await connection.query('COMMIT');
            return {
                orderId,
                subtotal_productos,
                envio_prioritario,
                costo_envio_prioritario,
                perfume_lujo,
                costo_perfume_lujo,
                total
            };
        } catch (error) {
            await connection.query('ROLLBACK');
            throw error;
        } finally {
            connection.release();
        }
    }

    static async markCartSessionConverted(sessionId: string, orderId: string): Promise<void> {
        await pool.query(
            `UPDATE cartsessions
             SET status = 'CONVERTED', order_id = ?, updated_at = NOW()
             WHERE session_id = ?`,
            [orderId, sessionId]
        );
    }

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

        const groupBy = [`${idExprRead}`];
        if (addonCols.subtotal_productos) groupBy.push('o.subtotal_productos');
        if (addonCols.envio_prioritario) groupBy.push('o.envio_prioritario');
        if (addonCols.costo_envio_prioritario) groupBy.push('o.costo_envio_prioritario');
        if (addonCols.perfume_lujo) groupBy.push('o.perfume_lujo');
        if (addonCols.costo_perfume_lujo) groupBy.push('o.costo_perfume_lujo');

        const [rows] = await pool.query(
            `SELECT 
                ${idExprRead} AS id,
                o.total,
                o.estado,
                o.direccion_envio,
                o.codigo_transaccion,
                o.creado_en
                ${extraSelect ? `, ${extraSelect}` : ''},
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'producto_id', ${productoIdRead},
                        'nombre', p.nombre,
                        'cantidad', d.cantidad,
                        'precio_unitario', d.precio_unitario,
                        'subtotal', d.subtotal,
                        'imagen_url', p.imagen_url
                    )
                ) as items
            FROM Ordenes o
            JOIN Detalle_Ordenes d ON d.orden_id = o.id
            JOIN Productos p ON p.id = d.producto_id
            WHERE o.usuario_id = ${userWhere}
            GROUP BY ${idExprRead}${extraSelect ? `, ${extraSelect}` : ''}
            ORDER BY o.creado_en DESC`,
            [userId]
        );
        return rows;
    }

    static async getAllOrders(filters?: { status?: string; q?: string }) {
        const status = (filters?.status || '').trim();
        const q = (filters?.q || '').trim();
        const binary = await detectIdType();
        const idExprRead = binary ? 'BIN_TO_UUID(o.id)' : 'o.id';

        const params: any[] = [];
        let where = 'WHERE 1=1';

        if (status) {
            params.push(status);
            where += ` AND o.estado = ?`;
        }

        if (q) {
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
            where += ` AND (
                ${idExprRead} LIKE ?
                OR CONCAT(u.nombre, ' ', u.apellido) LIKE ?
                OR u.email LIKE ?
            )`;
        }

        const [rows] = await pool.query(
            `SELECT 
                ${idExprRead} AS id,
                o.total,
                o.estado,
                o.direccion_envio,
                o.codigo_transaccion,
                o.creado_en,
                CONCAT(u.nombre, ' ', u.apellido) AS cliente_nombre,
                u.email AS cliente_email,
                COUNT(d.id) AS total_items
            FROM Ordenes o
            JOIN Usuarios u ON u.id = o.usuario_id
            JOIN Detalle_Ordenes d ON d.orden_id = o.id
            ${where}
            GROUP BY o.id, u.nombre, u.apellido, u.email
            ORDER BY o.creado_en DESC`,
            params
        );
        return rows;
    }

    static async updateOrderStatus(orderId: string, estado: string) {
        const { expr, val } = await idToSql(orderId);
        await pool.query(
            `UPDATE Ordenes SET estado = ?, actualizado_en = NOW() WHERE id = ${expr}`,
            [estado, val]
        );
        return true;
    }

    static async updateTransactionCode(orderId: string, transactionCode: string | null): Promise<void> {
        const { expr, val } = await idToSql(orderId);
        await pool.query(
            `UPDATE Ordenes SET codigo_transaccion = ?, actualizado_en = NOW() WHERE id = ${expr}`,
            [transactionCode, val]
        );
    }

    static async cancelAndRestock(orderId: string): Promise<void> {
        const connection = await pool.getConnection();
        const binary = await detectIdType();
        const idExpr = binary ? 'UUID_TO_BIN(?)' : '?';
        const productoIdRead = binary ? 'BIN_TO_UUID(producto_id)' : 'producto_id';

        try {
            await connection.query('BEGIN');

            const [resOrder] = await connection.query(
                `SELECT estado FROM Ordenes WHERE id = ${idExpr} FOR UPDATE`,
                [orderId]
            );
            const current = (resOrder as any)?.[0]?.estado;
            if (String(current || '').toUpperCase() === 'CANCELADO') {
                await connection.query('COMMIT');
                return;
            }

            await connection.query(
                `UPDATE Ordenes SET estado = ?, actualizado_en = NOW() WHERE id = ${idExpr}`,
                ['CANCELADO', orderId]
            );

            const [resItems] = await connection.query(
                `SELECT ${productoIdRead} AS producto_id, cantidad FROM Detalle_Ordenes WHERE orden_id = ${idExpr}`,
                [orderId]
            );
            const items: any[] = resItems as any[] || [];
            for (const it of items) {
                const pid = it?.producto_id;
                const qty = Number(it?.cantidad || 0);
                if (!pid || !Number.isFinite(qty) || qty <= 0) continue;
                await connection.query(
                    binary
                        ? 'UPDATE Productos SET stock = stock + ? WHERE id = UUID_TO_BIN(?)'
                        : 'UPDATE Productos SET stock = stock + ? WHERE id = ?',
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
                ${idExprRead} AS id, o.total, o.estado, o.direccion_envio, o.codigo_transaccion, o.creado_en${extraSelect ? `, ${extraSelect}` : ''},
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'producto_id', ${productoIdRead},
                        'nombre', p.nombre,
                        'cantidad', d.cantidad,
                        'precio_unitario', d.precio_unitario,
                        'subtotal', d.subtotal,
                        'imagen_url', p.imagen_url
                    )
                ) as items
            FROM Ordenes o
            JOIN Detalle_Ordenes d ON d.orden_id = o.id
            JOIN Productos p ON p.id = d.producto_id
            WHERE o.id = ${idExprWhere}`;
        const params: string[] = [orderId];
        if (userId) {
            query += ` AND o.usuario_id = ${idExprWhere}`;
            params.push(userId);
        }
        query += ` GROUP BY ${idExprRead}${extraSelect ? `, ${extraSelect}` : ''}`;
        const [rows] = await pool.query(query, params);
        return (rows as any[])[0] || null;
    }

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
                o.total,
                o.estado,
                o.direccion_envio,
                o.codigo_transaccion,
                o.creado_en
                ${extraSelect ? `, ${extraSelect}` : ''},
                u.nombre, u.apellido, u.email, u.telefono,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'producto_id', ${productoIdRead},
                        'nombre', p.nombre,
                        'cantidad', d.cantidad,
                        'precio_unitario', d.precio_unitario,
                        'subtotal', d.subtotal,
                        'imagen_url', p.imagen_url
                    )
                ) as items
            FROM Ordenes o
            JOIN Usuarios u ON u.id = o.usuario_id
            JOIN Detalle_Ordenes d ON d.orden_id = o.id
            JOIN Productos p ON p.id = d.producto_id
            WHERE o.id = ${idExprWhere}
            GROUP BY o.id, u.nombre, u.apellido, u.email, u.telefono${extraSelect ? `, ${extraSelect}` : ''}`,
            [orderId]
        );
        return rows?.[0] || null;
    }
}
