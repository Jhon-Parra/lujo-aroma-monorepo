import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

type DashboardTopProduct = {
    id: string;
    nombre: string;
    imagen_url: string | null;
    unidades: number;
    ingresos: number;
};

type DashboardOrderItem = {
    producto_id: string;
    nombre: string;
    cantidad: number;
    imagen_url: string | null;
};

type DashboardOrderPreview = {
    id: string;
    total: number;
    estado: string;
    creado_en: string;
    cliente_nombre: string;
    cliente_email: string;
    items: DashboardOrderItem[];
};

const toNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
};

const normalizeOrderStateExpr = (colExpr: string): string => {
    return `UPPER(TRIM(COALESCE(${colExpr}, '')))`;
};

export const getDashboardSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const okStates = ['PAGADO', 'ENVIADO', 'ENTREGADO'];
        const normalizedStateExpr = normalizeOrderStateExpr('estado');

        const monthsBackParsed = z.coerce.number().int().min(1).max(24).catch(12).safeParse((req.query as any)?.months_back);
        const monthsBack = monthsBackParsed.success ? monthsBackParsed.data : 12;

        const [revRows] = await pool.query<any[]>(
            `SELECT COALESCE(SUM(total), 0) AS total
             FROM ordenes
             WHERE ${normalizedStateExpr} IN (?, ?, ?)`,
            okStates
        );

        const [byStatusRows] = await pool.query<any[]>(
            `SELECT ${normalizedStateExpr} AS estado, CAST(COUNT(*) AS SIGNED) AS count
             FROM ordenes
             GROUP BY estado`
        );

        const orders_by_status: Record<string, number> = {
            PENDIENTE: 0,
            PAGADO: 0,
            PROCESANDO: 0,
            ENVIADO: 0,
            ENTREGADO: 0,
            CANCELADO: 0
        };
        for (const r of byStatusRows || []) {
            const key = String(r.estado || '').toUpperCase();
            if (orders_by_status[key] !== undefined) {
                orders_by_status[key] = toNumber(r.count);
            }
        }

        const [pendingRows] = await pool.query<any[]>(
            `SELECT CAST(COUNT(*) AS SIGNED) AS count
             FROM ordenes
             WHERE ${normalizedStateExpr} = 'PENDIENTE'`
        );

        const [prodRows] = await pool.query<any[]>(
            `SELECT CAST(COUNT(*) AS SIGNED) AS count
             FROM productos`
        );

        const [userRows] = await pool.query<any[]>(
            `SELECT CAST(COUNT(*) AS SIGNED) AS count
             FROM usuarios`
        );

        const [monthRows] = await pool.query<any[]>(
            `WITH RECURSIVE months AS (
                SELECT DATE_FORMAT(NOW(), '%Y-%m-01') AS month_start, 1 AS n
                UNION ALL
                SELECT DATE_FORMAT(month_start - INTERVAL 1 MONTH, '%Y-%m-01'), n + 1
                FROM months
                WHERE n < ?
            ),
            sales AS (
                SELECT
                    DATE_FORMAT(o.creado_en, '%Y-%m-01') AS month_start,
                    COALESCE(SUM(o.total), 0) AS revenue,
                    CAST(COUNT(*) AS SIGNED) AS orders_count
                FROM ordenes o
                 WHERE ${normalizeOrderStateExpr('o.estado')} IN (?, ?, ?)
                   AND o.creado_en >= DATE_FORMAT(NOW() - INTERVAL (? - 1) MONTH, '%Y-%m-01')
                GROUP BY 1
            )
            SELECT
                m.month_start,
                COALESCE(s.revenue, 0) AS revenue,
                CAST(COALESCE(s.orders_count, 0) AS SIGNED) AS orders_count
            FROM months m
            LEFT JOIN sales s ON s.month_start = m.month_start
            ORDER BY m.month_start ASC`,
            [monthsBack, ...okStates, monthsBack]
        );

        const [pendingPreviewRows] = await pool.query<any[]>(
            `SELECT
                o.id,
                o.total,
                CAST(o.estado AS CHAR) AS estado,
                o.creado_en,
                CONCAT(u.nombre, ' ', u.apellido) AS cliente_nombre,
                u.email AS cliente_email
            FROM ordenes o
            JOIN usuarios u ON u.id = o.usuario_id
            WHERE ${normalizeOrderStateExpr('o.estado')} = 'PENDIENTE'
            ORDER BY o.creado_en DESC
            LIMIT 10`
        );

        const pending_orders_preview = [];
        for (const r of (pendingPreviewRows || [])) {
            const [itemRows] = await pool.query<any[]>(
                `SELECT d.producto_id, p.nombre, d.cantidad, p.imagen_url
                 FROM detalleordenes d
                 JOIN productos p ON p.id = d.producto_id
                 WHERE d.orden_id = ?`,
                [r.id]
            );
            pending_orders_preview.push({
                ...r,
                total: toNumber(r.total),
                items: (itemRows || []).map(it => ({
                    producto_id: String(it.producto_id),
                    nombre: String(it.nombre || ''),
                    cantidad: toNumber(it.cantidad),
                    imagen_url: it.imagen_url ? String(it.imagen_url) : null
                }))
            });
        }

        const [topRows] = await pool.query<any[]>(
            `SELECT
                p.id,
                p.nombre,
                p.imagen_url,
                CAST(COALESCE(SUM(d.cantidad), 0) AS SIGNED) AS unidades,
                COALESCE(SUM(d.subtotal), 0) AS ingresos
             FROM detalleordenes d
             JOIN ordenes o ON o.id = d.orden_id
             JOIN productos p ON p.id = d.producto_id
              WHERE ${normalizeOrderStateExpr('o.estado')} IN (?, ?, ?)
              GROUP BY p.id, p.nombre, p.imagen_url
              ORDER BY unidades DESC, ingresos DESC
              LIMIT 5`,
            okStates
        );

        const top_products: DashboardTopProduct[] = (topRows || []).map((r) => ({
            id: String(r.id),
            nombre: String(r.nombre || ''),
            imagen_url: r.imagen_url ? String(r.imagen_url) : null,
            unidades: toNumber(r.unidades),
            ingresos: toNumber(r.ingresos)
        }));

        res.status(200).json({
            months_back: monthsBack,
            total_revenue: toNumber(revRows?.[0]?.total),
            pending_orders: toNumber(pendingRows?.[0]?.count),
            products_count: toNumber(prodRows?.[0]?.count),
            users_count: toNumber(userRows?.[0]?.count),
            orders_by_status,
            monthly_sales: (monthRows || []).map((r) => ({
                month_start: r.month_start,
                revenue: toNumber(r.revenue),
                orders_count: toNumber(r.orders_count)
            })),
            pending_orders_preview,
            top_products
        });
    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ error: 'Error al cargar métricas del dashboard' });
    }
};
