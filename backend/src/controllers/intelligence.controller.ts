import { Request, Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const okStates = ['PAGADO', 'PROCESANDO', 'ENVIADO', 'ENTREGADO'];

type AlertConfig = {
    sales_delta_pct: number;
    abandoned_delta_pct: number;
    abandoned_value_threshold: number;
    negative_reviews_threshold: number;
    trend_growth_pct: number;
    trend_min_units: number;
    failed_login_threshold: number;
    abandoned_hours: number;
};

const DEFAULT_ALERT_CONFIG: AlertConfig = {
    sales_delta_pct: 20,
    abandoned_delta_pct: 20,
    abandoned_value_threshold: 1000000,
    negative_reviews_threshold: 3,
    trend_growth_pct: 30,
    trend_min_units: 5,
    failed_login_threshold: 5,
    abandoned_hours: 24
};

const toNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
};

const getRangeDays = (req: Request): number => {
    return z.coerce.number().int().min(7).max(365).catch(30).parse((req.query as any)?.days);
};

const normalizeOrderStateExpr = (colExpr: string): string => {
    return `UPPER(TRIM(COALESCE(${colExpr}, '')))`;
};

const detectColumns = async (columns: string[]): Promise<Record<string, boolean>> => {
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT column_name
             FROM information_schema.columns
             WHERE lower(table_name) = 'configuracionglobal'
               AND column_name IN (${columns.map(() => '?').join(', ')})`,
            columns
        );

        const found = new Set((rows || []).map((r: any) => String(r.column_name)));
        const result: Record<string, boolean> = {};
        for (const c of columns) result[c] = found.has(c);
        return result;
    } catch {
        const result: Record<string, boolean> = {};
        for (const c of columns) result[c] = false;
        return result;
    }
};

const normalizeNumber = (value: any, fallback: number, min?: number, max?: number): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const num = Math.trunc(n);
    if (min !== undefined && num < min) return min;
    if (max !== undefined && num > max) return max;
    return num;
};

const getAlertConfig = async (): Promise<AlertConfig> => {
    try {
        const columns = await detectColumns([
            'alert_sales_delta_pct',
            'alert_abandoned_delta_pct',
            'alert_abandoned_value_threshold',
            'alert_negative_reviews_threshold',
            'alert_trend_growth_pct',
            'alert_trend_min_units',
            'alert_failed_login_threshold',
            'alert_abandoned_hours'
        ]);

        const selectParts = Object.keys(columns).filter((k) => (columns as any)[k]);
        if (!selectParts.length) return { ...DEFAULT_ALERT_CONFIG };

        const [rows] = await pool.query<any[]>(
            `SELECT ${selectParts.join(', ')} FROM ConfiguracionGlobal WHERE id = 1`
        );

        const row = rows?.[0] || {};
        return {
            sales_delta_pct: normalizeNumber(row.alert_sales_delta_pct, DEFAULT_ALERT_CONFIG.sales_delta_pct, 0, 100),
            abandoned_delta_pct: normalizeNumber(row.alert_abandoned_delta_pct, DEFAULT_ALERT_CONFIG.abandoned_delta_pct, 0, 100),
            abandoned_value_threshold: Number.isFinite(Number(row.alert_abandoned_value_threshold))
                ? Number(row.alert_abandoned_value_threshold)
                : DEFAULT_ALERT_CONFIG.abandoned_value_threshold,
            negative_reviews_threshold: normalizeNumber(row.alert_negative_reviews_threshold, DEFAULT_ALERT_CONFIG.negative_reviews_threshold, 1, 50),
            trend_growth_pct: normalizeNumber(row.alert_trend_growth_pct, DEFAULT_ALERT_CONFIG.trend_growth_pct, 0, 300),
            trend_min_units: normalizeNumber(row.alert_trend_min_units, DEFAULT_ALERT_CONFIG.trend_min_units, 1, 2000),
            failed_login_threshold: normalizeNumber(row.alert_failed_login_threshold, DEFAULT_ALERT_CONFIG.failed_login_threshold, 3, 50),
            abandoned_hours: normalizeNumber(row.alert_abandoned_hours, DEFAULT_ALERT_CONFIG.abandoned_hours, 1, 240)
        };
    } catch {
        return { ...DEFAULT_ALERT_CONFIG };
    }
};

const getSearchTrends = async (productId: string): Promise<number[]> => {
    // MySQL 7-day series hack using UNION ALL
    const [rows] = await pool.query<any[]>(
        `WITH days AS (
            SELECT CURDATE() - INTERVAL 0 DAY AS day UNION ALL
            SELECT CURDATE() - INTERVAL 1 DAY UNION ALL
            SELECT CURDATE() - INTERVAL 2 DAY UNION ALL
            SELECT CURDATE() - INTERVAL 3 DAY UNION ALL
            SELECT CURDATE() - INTERVAL 4 DAY UNION ALL
            SELECT CURDATE() - INTERVAL 5 DAY UNION ALL
            SELECT CURDATE() - INTERVAL 6 DAY
        ),
        hits AS (
            SELECT
                DATE(created_at) AS day,
                product_id
            FROM (
                SELECT created_at, p_id as product_id
                FROM SearchEvents,
                JSON_TABLE(product_ids, "$[*]" COLUMNS (p_id VARCHAR(255) PATH "$")) as jt
                WHERE created_at >= CURDATE() - INTERVAL 6 DAY
                  AND product_ids IS NOT NULL
            ) sub
        )
        SELECT d.day,
               CAST(COALESCE(COUNT(h.product_id), 0) AS SIGNED) AS count
        FROM days d
        LEFT JOIN hits h ON h.day = d.day AND h.product_id = ?
        GROUP BY d.day
        ORDER BY d.day ASC`,
        [productId]
    );

    return (rows || []).map((r) => toNumber(r.count));
};

export const trackSearchEvent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const query = String(req.body?.query || '').trim();
        if (!query) {
            res.status(400).json({ error: 'Query requerida' });
            return;
        }

        const productIds = Array.isArray(req.body?.product_ids)
            ? req.body.product_ids.map((x: any) => String(x)).filter(Boolean)
            : [];

        const resultsCount = Number(req.body?.results_count || 0);
        const sessionId = String(req.body?.session_id || '').trim() || null;
        const userId = req.user?.id || null;

        await pool.query(
            `INSERT INTO SearchEvents (user_id, session_id, \`query\`, product_ids, results_count)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, sessionId, query, productIds.length ? JSON.stringify(productIds) : null, Number.isFinite(resultsCount) ? resultsCount : 0]
        );

        res.status(201).json({ ok: true });
    } catch (error) {
        console.error('Error tracking search:', error);
        res.status(500).json({ error: 'No se pudo registrar la búsqueda' });
    }
};

export const trackProductView = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const productId = String(req.body?.product_id || '').trim();
        if (!productId) {
            res.status(400).json({ error: 'product_id requerido' });
            return;
        }

        const sessionId = String(req.body?.session_id || '').trim() || null;
        const userId = req.user?.id || null;

        await pool.query(
            `INSERT INTO ProductViewEvents (user_id, session_id, product_id)
             VALUES (?, ?, ?)`,
            [userId, sessionId, productId]
        );

        res.status(201).json({ ok: true });
    } catch (error) {
        console.error('Error tracking product view:', error);
        res.status(500).json({ error: 'No se pudo registrar la vista' });
    }
};

export const trackCartSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const sessionId = String(req.body?.session_id || '').trim();
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const total = Number(req.body?.total || 0);

        if (!sessionId) {
            res.status(400).json({ error: 'session_id requerido' });
            return;
        }

        await pool.query(
            `INSERT INTO CartSessions (session_id, user_id, items, total, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'OPEN', NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                user_id = COALESCE(?, user_id),
                items = ?,
                total = ?,
                updated_at = NOW(),
                status = CASE WHEN status = 'CONVERTED' THEN status ELSE 'OPEN' END`,
            [sessionId, req.user?.id || null, JSON.stringify(items), Number.isFinite(total) ? total : 0, req.user?.id || null, JSON.stringify(items), Number.isFinite(total) ? total : 0]
        );

        res.status(201).json({ ok: true });
    } catch (error) {
        console.error('Error tracking cart session:', error);
        res.status(500).json({ error: 'No se pudo registrar el carrito' });
    }
};

export const convertCartSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const sessionId = String(req.body?.session_id || '').trim();
        const orderId = String(req.body?.order_id || '').trim() || null;

        if (!sessionId) {
            res.status(400).json({ error: 'session_id requerido' });
            return;
        }

        await pool.query(
            `UPDATE CartSessions
             SET status = 'CONVERTED', order_id = COALESCE(?, order_id), updated_at = NOW()
             WHERE session_id = ?`,
            [orderId, sessionId]
        );

        res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Error converting cart session:', error);
        res.status(500).json({ error: 'No se pudo cerrar el carrito' });
    }
};

export const getIntelligenceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const config = await getAlertConfig();
        const abandonedHours = config.abandoned_hours;
        const days = getRangeDays(req);
        const categoryFilter = String((req.query as any)?.category || '').trim();
        const productFilter = String((req.query as any)?.product_id || '').trim();
        const normalizedStateExpr = normalizeOrderStateExpr('o.estado');

        // 1. Top Searches
        const [topSearchRows] = await pool.query<any[]>(
            `WITH events AS (
                SELECT product_ids
                FROM SearchEvents
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                  AND product_ids IS NOT NULL
            ),
            ids AS (
                SELECT p_id AS product_id
                FROM events,
                JSON_TABLE(product_ids, "$[*]" COLUMNS (p_id VARCHAR(255) PATH "$")) as jt
            )
            SELECT p.id, p.nombre, CAST(COUNT(*) AS SIGNED) AS searches
            FROM ids i
            JOIN Productos p ON p.id = i.product_id
            GROUP BY p.id, p.nombre
            ORDER BY searches DESC
            LIMIT 10`,
            [days]
        );

        const topSearches = [] as any[];
        for (const row of topSearchRows || []) {
            const trend = await getSearchTrends(String(row.id));
            topSearches.push({
                product_id: String(row.id),
                nombre: String(row.nombre || ''),
                searches: toNumber(row.searches),
                trend
            });
        }

        // 2. Abandoned Total
        const [abandonedRows] = await pool.query<any[]>(
            `WITH abandoned AS (
                SELECT *
                FROM CartSessions
                WHERE status = 'OPEN'
                  AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
            )
            SELECT CAST(COUNT(*) AS SIGNED) AS total, COALESCE(SUM(total), 0) AS lost_value
            FROM abandoned`,
            [abandonedHours]
        );

        // 3. Abandoned Trend (7 days)
        const [abandonedTrendRows] = await pool.query<any[]>(
            `WITH days AS (
                SELECT CURDATE() - INTERVAL 0 DAY AS day UNION ALL
                SELECT CURDATE() - INTERVAL 1 DAY UNION ALL
                SELECT CURDATE() - INTERVAL 2 DAY UNION ALL
                SELECT CURDATE() - INTERVAL 3 DAY UNION ALL
                SELECT CURDATE() - INTERVAL 4 DAY UNION ALL
                SELECT CURDATE() - INTERVAL 5 DAY UNION ALL
                SELECT CURDATE() - INTERVAL 6 DAY
            ),
            abandoned AS (
                SELECT DATE(updated_at) AS day
                FROM CartSessions
                WHERE status = 'OPEN'
                  AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
                  AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            )
            SELECT d.day, CAST(COALESCE(COUNT(a.day), 0) AS SIGNED) AS count
            FROM days d
            LEFT JOIN abandoned a ON a.day = d.day
            GROUP BY d.day
            ORDER BY d.day ASC`,
            [abandonedHours]
        );

        // 4. Abandoned Top Products
        const [abandonedTopRows] = await pool.query<any[]>(
            `WITH abandoned AS (
                SELECT *
                FROM CartSessions
                WHERE status = 'OPEN'
                  AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
            ),
            items AS (
                SELECT item
                FROM abandoned,
                JSON_TABLE(items, "$[*]" COLUMNS (item JSON PATH "$")) as jt
            ),
            flat AS (
                SELECT
                    JSON_UNQUOTE(JSON_EXTRACT(item, '$.product_id')) AS product_id,
                    CAST(COALESCE(JSON_EXTRACT(item, '$.quantity'), 1) AS SIGNED) AS qty
                FROM items
                WHERE JSON_EXTRACT(item, '$.product_id') IS NOT NULL
            )
            SELECT p.id, p.nombre, CAST(COALESCE(SUM(f.qty), 0) AS SIGNED) AS count
            FROM flat f
            JOIN Productos p ON p.id = f.product_id
            GROUP BY p.id, p.nombre
            ORDER BY count DESC
            LIMIT 5`,
            [abandonedHours]
        );

        // 5. Abandoned Recent
        const [abandonedRecentRows] = await pool.query<any[]>(
            `WITH abandoned AS (
                SELECT *
                FROM CartSessions
                WHERE status = 'OPEN'
                  AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
            )
            SELECT a.session_id, a.user_id, a.total, a.updated_at, a.items,
                   u.email AS user_email
            FROM abandoned a
            LEFT JOIN Usuarios u ON u.id = a.user_id
            ORDER BY a.updated_at DESC
            LIMIT 10`,
            [abandonedHours]
        );

        // 6. Frequent Clients
        const [frequentRows] = await pool.query<any[]>(
            `SELECT u.id, u.nombre, u.apellido, u.email,
                    CAST(COUNT(*) AS SIGNED) AS orders_count,
                    COALESCE(SUM(o.total), 0) AS total_spent
             FROM Ordenes o
             JOIN Usuarios u ON u.id = o.usuario_id
             WHERE ${normalizedStateExpr} IN (?, ?, ?, ?)
               AND o.creado_en >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY u.id, u.nombre, u.apellido, u.email
             ORDER BY total_spent DESC
             LIMIT 10`,
            [...okStates, days]
        );

        // 7. Sales by Category
        const salesParams: any[] = [...okStates, days];
        let salesWhere = `${normalizedStateExpr} IN (?, ?, ?, ?) AND o.creado_en >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
        if (categoryFilter) {
            salesWhere += ` AND p.genero = ?`;
            salesParams.push(categoryFilter);
        }
        if (productFilter) {
            salesWhere += ` AND p.id = ?`;
            salesParams.push(productFilter);
        }

        const [salesRows] = await pool.query<any[]>(
            `WITH sales AS (
                SELECT
                    p.genero AS category_slug,
                    COALESCE(c.nombre, p.genero, 'Sin categoria') AS category_name,
                    p.id AS product_id,
                    p.nombre AS product_name,
                    CAST(COALESCE(SUM(d.cantidad), 0) AS SIGNED) AS units,
                    COALESCE(SUM(revenue), 0) AS revenue
                FROM (
                    SELECT 
                        producto_id, 
                        SUM(cantidad) as cantidad, 
                        SUM(subtotal) as subtotal,
                        orden_id
                    FROM DetalleOrdenes
                    GROUP BY producto_id, orden_id
                ) d
                JOIN Ordenes o ON o.id = d.orden_id
                JOIN Productos p ON p.id = d.producto_id
                LEFT JOIN Categorias c ON c.slug = p.genero
                WHERE ${salesWhere}
                GROUP BY p.genero, c.nombre, p.id, p.nombre
            ),
            category_totals AS (
                SELECT category_slug, category_name,
                       CAST(COALESCE(SUM(units), 0) AS SIGNED) AS units,
                       COALESCE(SUM(revenue), 0) AS revenue
                FROM sales
                GROUP BY category_slug, category_name
            ),
            top_products AS (
                /* MySQL 8.0 rank simulate or subquery for top product per category */
                SELECT category_slug, product_name, units
                FROM (
                    SELECT category_slug, product_name, units,
                           ROW_NUMBER() OVER(PARTITION BY category_slug ORDER BY units DESC) as rn
                    FROM sales
                ) tmp
                WHERE rn = 1
            )
            SELECT t.category_name, t.units, t.revenue,
                   COALESCE(tp.product_name, '') AS top_product
            FROM category_totals t
            LEFT JOIN top_products tp ON tp.category_slug = t.category_slug
            ORDER BY t.revenue DESC`,
            salesParams
        );

        // 8. Sales Stats
        const [salesCurrentRows] = await pool.query<any[]>(
            `SELECT COALESCE(SUM(total), 0) AS total
             FROM Ordenes o
             WHERE ${normalizedStateExpr} IN (?, ?, ?, ?)
               AND o.creado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
            [...okStates]
        );

        const [salesPrevRows] = await pool.query<any[]>(
            `SELECT COALESCE(SUM(total), 0) AS total
             FROM Ordenes o
             WHERE ${normalizedStateExpr} IN (?, ?, ?, ?)
               AND o.creado_en >= DATE_SUB(NOW(), INTERVAL 14 DAY)
               AND o.creado_en < DATE_SUB(NOW(), INTERVAL 7 DAY)`,
            [...okStates]
        );

        const currentSales = toNumber(salesCurrentRows?.[0]?.total);
        const previousSales = toNumber(salesPrevRows?.[0]?.total);
        const salesDelta = previousSales > 0 ? ((currentSales - previousSales) / previousSales) * 100 : (currentSales > 0 ? 100 : 0);

        // 9. Abandoned Deltas
        const [abandonedRecentCount] = await pool.query<any[]>(
            `SELECT CAST(COUNT(*) AS SIGNED) AS count, COALESCE(SUM(total), 0) AS lost
             FROM CartSessions
             WHERE status = 'OPEN'
               AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
               AND updated_at >= DATE_SUB(NOW(), INTERVAL 3 DAY)`,
            [abandonedHours]
        );

        const [abandonedPrevCount] = await pool.query<any[]>(
            `SELECT CAST(COUNT(*) AS SIGNED) AS count
             FROM CartSessions
             WHERE status = 'OPEN'
               AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
               AND updated_at >= DATE_SUB(NOW(), INTERVAL 6 DAY)
               AND updated_at < DATE_SUB(NOW(), INTERVAL 3 DAY)`,
            [abandonedHours]
        );

        const abCurrent = toNumber(abandonedRecentCount?.[0]?.count);
        const abPrev = toNumber(abandonedPrevCount?.[0]?.count);
        const abLost = toNumber(abandonedRecentCount?.[0]?.lost);
        const abDelta = abPrev > 0 ? ((abCurrent - abPrev) / abPrev) * 100 : (abCurrent > 0 ? 100 : 0);

        // 10. Negative Reviews
        const [negativeRows] = await pool.query<any[]>(
            `SELECT p.id, p.nombre, CAST(COUNT(*) AS SIGNED) AS negative_count,
                    GROUP_CONCAT(r.comentario SEPARATOR ' · ') AS comentarios
             FROM Resenas r
             JOIN Productos p ON p.id = r.producto_id
             WHERE r.rating <= 2
               AND r.creado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY)
               AND r.comentario IS NOT NULL
             GROUP BY p.id, p.nombre
             HAVING COUNT(*) >= ?
             ORDER BY negative_count DESC
             LIMIT 3`,
            [config.negative_reviews_threshold]
        );

        // 11. Trends
        const [trendRows] = await pool.query<any[]>(
            `WITH current_sales AS (
                SELECT d.producto_id, CAST(COALESCE(SUM(d.cantidad), 0) AS SIGNED) AS units
                FROM DetalleOrdenes d
                JOIN Ordenes o ON o.id = d.orden_id
                WHERE ${normalizedStateExpr} IN (?, ?, ?, ?)
                  AND o.creado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY d.producto_id
            ),
            prev_sales AS (
                SELECT d.producto_id, CAST(COALESCE(SUM(d.cantidad), 0) AS SIGNED) AS units
                FROM DetalleOrdenes d
                JOIN Ordenes o ON o.id = d.orden_id
                WHERE ${normalizedStateExpr} IN (?, ?, ?, ?)
                  AND o.creado_en >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                  AND o.creado_en < DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY d.producto_id
            )
            SELECT p.id, p.nombre, c.units AS current_units, COALESCE(pv.units, 0) AS prev_units
            FROM current_sales c
            JOIN Productos p ON p.id = c.producto_id
            LEFT JOIN prev_sales pv ON pv.producto_id = c.producto_id
            WHERE c.units >= ?
            ORDER BY (c.units - COALESCE(pv.units, 0)) DESC
            LIMIT 5`,
            [...okStates, ...okStates, config.trend_min_units]
        );

        // 12. Security
        const [suspiciousRows] = await pool.query<any[]>(
            `SELECT COALESCE(email, ip) AS subject, CAST(COUNT(*) AS SIGNED) AS attempts
             FROM AuthSecurityEvents
             WHERE event_type = 'login_failed'
               AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
             GROUP BY subject
             HAVING COUNT(*) >= ?
             ORDER BY attempts DESC
             LIMIT 3`,
            [config.failed_login_threshold]
        );

        const alerts: any[] = [];
        if (Math.abs(salesDelta) >= config.sales_delta_pct) {
            alerts.push({
                type: 'Ventas',
                title: `Ventas ${salesDelta >= 0 ? '+' : ''}${salesDelta.toFixed(1)}% vs periodo anterior`,
                detail: `Comparacion ultimos 7 dias`,
                meta: 'Ultimos 14 dias',
                tone: salesDelta >= 0 ? 'up' : 'down'
            });
        }

        if (Math.abs(abDelta) >= config.abandoned_delta_pct || abLost >= config.abandoned_value_threshold) {
            alerts.push({
                type: 'Carritos',
                title: 'Carritos abandonados en alerta',
                detail: `${abCurrent} carritos · $${abLost.toFixed(0)} perdidos`,
                meta: 'Ultimos 3 dias',
                tone: abDelta >= 0 ? 'down' : 'warn'
            });
        }

        for (const r of negativeRows || []) {
            const comments = String(r.comentarios || '').split(' · ').slice(0, 2).join(' · ');
            alerts.push({
                type: 'Reseñas',
                title: `Reseñas negativas en ${String(r.nombre || '')}`,
                detail: `${toNumber(r.negative_count)} reseñas 1-2★. ${comments}`.trim(),
                meta: 'Ultimos 7 dias',
                tone: 'warn'
            });
        }

        for (const r of trendRows || []) {
            const currentUnits = toNumber(r.current_units);
            const prevUnits = toNumber(r.prev_units);
            if (prevUnits === 0) continue;
            const delta = ((currentUnits - prevUnits) / prevUnits) * 100;
            if (delta < config.trend_growth_pct) continue;
            alerts.push({
                type: 'Tendencia',
                title: `Producto en tendencia: ${String(r.nombre || '')}`,
                detail: `Ventas +${delta.toFixed(1)}% (${currentUnits} uds)`,
                meta: 'Ultimos 7 dias',
                tone: 'up'
            });
        }

        for (const r of suspiciousRows || []) {
            alerts.push({
                type: 'Seguridad',
                title: 'Actividad sospechosa detectada',
                detail: `${String(r.subject || 'Usuario')} con ${toNumber(r.attempts)} intentos fallidos`,
                meta: 'Ultima hora',
                tone: 'warn'
            });
        }

        res.status(200).json({
            days,
            filters: { category: categoryFilter || null, product_id: productFilter || null },
            top_searches: topSearches,
            abandoned: {
                total: toNumber(abandonedRows?.[0]?.total),
                lost_value: toNumber(abandonedRows?.[0]?.lost_value),
                trend_days: (abandonedTrendRows || []).map((r) => r.day),
                trend_counts: (abandonedTrendRows || []).map((r) => toNumber(r.count)),
                top_products: (abandonedTopRows || []).map((r) => ({
                    product_id: String(r.id),
                    nombre: String(r.nombre || ''),
                    count: toNumber(r.count)
                })),
                recent: (abandonedRecentRows || []).map((r) => ({
                    session_id: String(r.session_id),
                    user_email: r.user_email ? String(r.user_email) : null,
                    total: toNumber(r.total),
                    updated_at: r.updated_at,
                    items: Array.isArray(r.items) ? r.items : []
                }))
            },
            frequent_clients: (frequentRows || []).map((r) => ({
                user_id: String(r.id),
                nombre: String(r.nombre || ''),
                apellido: String(r.apellido || ''),
                email: String(r.email || ''),
                orders_count: toNumber(r.orders_count),
                total_spent: toNumber(r.total_spent)
            })),
            sales_by_category: (salesRows || []).map((r) => ({
                category: String(r.category_name || ''),
                revenue: toNumber(r.revenue),
                units: toNumber(r.units),
                top_product: String(r.top_product || '')
            })),
            alerts
        });
    } catch (error) {
        console.error('Error fetching intelligence summary:', error);
        res.status(500).json({ error: 'Error al cargar inteligencia y alertas' });
    }
};
