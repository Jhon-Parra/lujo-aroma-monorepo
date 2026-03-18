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
              WHERE table_schema = DATABASE()
                AND lower(table_name) = 'configuracionglobal'
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
    try {
        // Fetch searches from last 7 days
        const [rows] = await pool.query<any[]>(
            `SELECT created_at, product_ids
             FROM searchevents
             WHERE created_at >= CURDATE() - INTERVAL 6 DAY
               AND product_ids IS NOT NULL`
        );

        const counts: Record<string, number> = {};
        // Initialize last 7 days
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            counts[d.toISOString().split('T')[0]] = 0;
        }

        (rows || []).forEach(row => {
            try {
                const ids = typeof row.product_ids === 'string' ? JSON.parse(row.product_ids) : row.product_ids;
                if (Array.isArray(ids) && ids.includes(productId)) {
                    const day = new Date(row.created_at).toISOString().split('T')[0];
                    if (counts[day] !== undefined) counts[day]++;
                }
            } catch {}
        });

        return Object.keys(counts).sort().map(k => counts[k]);
    } catch (e) {
        console.error('Error in getSearchTrends:', e);
        return [0, 0, 0, 0, 0, 0, 0];
    }
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
            `INSERT INTO searchevents (user_id, session_id, \`query\`, product_ids, results_count)
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
            `INSERT INTO productviewevents (user_id, session_id, product_id)
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
            `INSERT INTO cartsessions (session_id, user_id, items, total, status, created_at, updated_at)
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
            `UPDATE cartsessions
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

        // 1. Top Searches (Refactored to avoid JSON_TABLE)
        const [searchEvents] = await pool.query<any[]>(
            `SELECT product_ids
             FROM searchevents
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
               AND product_ids IS NOT NULL`,
            [days]
        );

        const searchCounts: Record<string, number> = {};
        searchEvents.forEach(e => {
            try {
                const ids = typeof e.product_ids === 'string' ? JSON.parse(e.product_ids) : e.product_ids;
                if (Array.isArray(ids)) {
                    ids.forEach((id: string) => {
                        searchCounts[id] = (searchCounts[id] || 0) + 1;
                    });
                }
            } catch {}
        });

        const sortedSearchIds = Object.keys(searchCounts)
            .sort((a, b) => searchCounts[b] - searchCounts[a])
            .slice(0, 10);

        const topSearches: any[] = [];
        if (sortedSearchIds.length > 0) {
            const [pRows] = await pool.query<any[]>(
                `SELECT id, nombre FROM Productos WHERE id IN (${sortedSearchIds.map(() => '?').join(', ')})`,
                sortedSearchIds
            );
            
            for (const id of sortedSearchIds) {
                const p = pRows.find(r => String(r.id) === id);
                if (p) {
                    const trend = await getSearchTrends(id);
                    topSearches.push({
                        product_id: id,
                        nombre: String(p.nombre || ''),
                        searches: searchCounts[id],
                        trend
                    });
                }
            }
        }

        // 2. Abandoned Total
        const [abandonedRows] = await pool.query<any[]>(
            `SELECT CAST(COUNT(*) AS SIGNED) AS total, COALESCE(SUM(total), 0) AS lost_value
             FROM cartsessions
             WHERE status = 'OPEN'
               AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
            [abandonedHours]
        );

        // 3. Abandoned Trend (7 days) (Refactored to avoid WITH days)
        const [abandonedTrendData] = await pool.query<any[]>(
            `SELECT DATE(updated_at) AS day, COUNT(*) AS count
             FROM cartsessions
             WHERE status = 'OPEN'
               AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
               AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
             GROUP BY day`,
            [abandonedHours]
        );

        const abTrendDays = [];
        const abTrendCounts = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            abTrendDays.push(dateStr);
            const found = abandonedTrendData.find(r => {
                const rDate = new Date(r.day).toISOString().split('T')[0];
                return rDate === dateStr;
            });
            abTrendCounts.push(found ? toNumber(found.count) : 0);
        }

        // 4. Abandoned Top Products (Refactored to avoid JSON_TABLE)
        const [abandonedSessions] = await pool.query<any[]>(
            `SELECT items
             FROM cartsessions
             WHERE status = 'OPEN'
               AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
            [abandonedHours]
        );

        const abProductCounts: Record<string, number> = {};
        abandonedSessions.forEach(s => {
            try {
                const items = typeof s.items === 'string' ? JSON.parse(s.items) : s.items;
                if (Array.isArray(items)) {
                    items.forEach((it: any) => {
                        const pid = String(it.product_id || '');
                        if (pid) {
                            abProductCounts[pid] = (abProductCounts[pid] || 0) + toNumber(it.quantity || 1);
                        }
                    });
                }
            } catch {}
        });

        const sortedAbIds = Object.keys(abProductCounts)
            .sort((a, b) => abProductCounts[b] - abProductCounts[a])
            .slice(0, 5);

        const abandonedTopProducts: any[] = [];
        if (sortedAbIds.length > 0) {
            const [pRows] = await pool.query<any[]>(
                `SELECT id, nombre FROM Productos WHERE id IN (${sortedAbIds.map(() => '?').join(', ')})`,
                sortedAbIds
            );
            sortedAbIds.forEach(id => {
                const p = pRows.find(r => String(r.id) === id);
                if (p) {
                    abandonedTopProducts.push({
                        product_id: id,
                        nombre: String(p.nombre || ''),
                        count: abProductCounts[id]
                    });
                }
            });
        }

        // 5. Abandoned Recent
        const [abandonedRecentRows] = await pool.query<any[]>(
            `SELECT a.session_id, a.user_id, a.total, a.updated_at, a.items,
                    u.email AS user_email
             FROM cartsessions a
             LEFT JOIN Usuarios u ON u.id = a.user_id
             WHERE a.status = 'OPEN'
               AND a.updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
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

        // 7. Sales by Category (Refactored to avoid ROW_NUMBER)
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

        const [salesData] = await pool.query<any[]>(
            `SELECT 
                p.genero AS category_slug,
                COALESCE(c.nombre, p.genero, 'Sin categoria') AS category_name,
                p.nombre AS product_name,
                SUM(d.cantidad) as units,
                SUM(d.subtotal) as revenue
             FROM Detalle_Ordenes d
             JOIN Ordenes o ON o.id = d.orden_id
             JOIN Productos p ON p.id = d.producto_id
             LEFT JOIN Categorias c ON c.slug = p.genero
             WHERE ${salesWhere}
             GROUP BY p.genero, c.nombre, p.nombre`,
            salesParams
        );

        const categorySummary: Record<string, any> = {};
        salesData.forEach(r => {
            const cat = r.category_slug || 'sin-categoria';
            if (!categorySummary[cat]) {
                categorySummary[cat] = {
                    category: r.category_name,
                    revenue: 0,
                    units: 0,
                    top_product: '',
                    max_units: -1
                };
            }
            categorySummary[cat].revenue += toNumber(r.revenue);
            categorySummary[cat].units += toNumber(r.units);
            if (toNumber(r.units) > categorySummary[cat].max_units) {
                categorySummary[cat].max_units = toNumber(r.units);
                categorySummary[cat].top_product = r.product_name;
            }
        });

        const salesByCategory = Object.values(categorySummary)
            .sort((a, b) => b.revenue - a.revenue)
            .map(c => ({
                category: c.category,
                revenue: c.revenue,
                units: c.units,
                top_product: c.top_product
            }));

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
             FROM cartsessions
             WHERE status = 'OPEN'
               AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
               AND updated_at >= DATE_SUB(NOW(), INTERVAL 3 DAY)`,
            [abandonedHours]
        );

        const [abandonedPrevCount] = await pool.query<any[]>(
            `SELECT CAST(COUNT(*) AS SIGNED) AS count
             FROM cartsessions
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
             FROM resenas r
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
            `SELECT d.producto_id, p.nombre, 
                    SUM(CASE WHEN o.creado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN d.cantidad ELSE 0 END) AS current_units,
                    SUM(CASE WHEN o.creado_en < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN d.cantidad ELSE 0 END) AS prev_units
             FROM Detalle_Ordenes d
             JOIN Ordenes o ON o.id = d.orden_id
             JOIN Productos p ON p.id = d.producto_id
             WHERE ${normalizedStateExpr} IN (?, ?, ?, ?)
               AND o.creado_en >= DATE_SUB(NOW(), INTERVAL 14 DAY)
             GROUP BY d.producto_id, p.nombre
              HAVING SUM(CASE WHEN o.creado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN d.cantidad ELSE 0 END) >= ?
              ORDER BY (
                SUM(CASE WHEN o.creado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN d.cantidad ELSE 0 END) -
                SUM(CASE WHEN o.creado_en < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN d.cantidad ELSE 0 END)
              ) DESC
              LIMIT 5`,
            [...okStates, config.trend_min_units]
        );

        // 12. Security
        const [suspiciousRows] = await pool.query<any[]>(
            `SELECT COALESCE(email, ip) AS subject, CAST(COUNT(*) AS SIGNED) AS attempts
             FROM authsecurityevents
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
                trend_days: abTrendDays,
                trend_counts: abTrendCounts,
                top_products: abandonedTopProducts,
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
            sales_by_category: salesByCategory,
            alerts
        });
    } catch (error) {
        console.error('Error fetching intelligence summary:', error);
        res.status(500).json({ error: 'Error al cargar inteligencia y alertas' });
    }
};
