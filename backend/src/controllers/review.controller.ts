import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

let reviewsReady: boolean | null = null;

const isUuid = (value: string): boolean => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

const detectReviewsSchema = async (): Promise<boolean> => {
    if (reviewsReady !== null) return reviewsReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) AS has_reviews 
             FROM information_schema.tables 
             WHERE table_schema = DATABASE() 
               AND lower(table_name) = 'resenas'`
        );
        reviewsReady = Number(rows?.[0]?.has_reviews || 0) > 0;
        return reviewsReady;
    } catch {
        reviewsReady = false;
        return false;
    }
};

const requireReviewsSchema = async (res: Response): Promise<boolean> => {
    const ok = await detectReviewsSchema();
    if (!ok) {
        res.status(400).json({
            error: 'La base de datos no tiene la tabla de reseñas. Ejecuta la migración database/migrations/20260312_reviews.sql en Supabase.'
        });
        return false;
    }
    return true;
};

export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!(await requireReviewsSchema(res))) return;

        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Acceso Denegado. Token no proporcionado.' });
            return;
        }

        const { product_id, order_id, rating, comment } = req.body as any;

        // Verificar compra (solo orden ENTREGADO)
        if (order_id) {
            const [rows] = await pool.query<any[]>(
                `SELECT 1
                 FROM Ordenes o
                 JOIN detalle_ordenes d ON d.orden_id = o.id
                 WHERE o.id = ?
                   AND o.usuario_id = ?
                   AND o.estado = 'ENTREGADO'
                   AND d.producto_id = ?
                 LIMIT 1`,
                [order_id, userId, product_id]
            );
            if (!rows || rows.length === 0) {
                res.status(403).json({ error: 'Solo puedes reseñar productos de pedidos entregados.' });
                return;
            }
        } else {
            const [rows] = await pool.query<any[]>(
                `SELECT 1
                 FROM Ordenes o
                 JOIN detalle_ordenes d ON d.orden_id = o.id
                 WHERE o.usuario_id = ?
                   AND o.estado = 'ENTREGADO'
                   AND d.producto_id = ?
                 LIMIT 1`,
                [userId, product_id]
            );
            if (!rows || rows.length === 0) {
                res.status(403).json({ error: 'Solo puedes reseñar productos de pedidos entregados.' });
                return;
            }
        }

        const id = uuidv4();

        try {
            await pool.query(
                `INSERT INTO Resenas (id, usuario_id, producto_id, orden_id, rating, comentario, verificada)
                 VALUES (?, ?, ?, ?, ?, ?, true)`,
                [id, userId, product_id, order_id || null, rating, (comment || '').trim() || null]
            );
        } catch (e: any) {
            // Unique violation
            if (e?.code === '23505' || e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062) {
                res.status(409).json({ error: 'Ya dejaste una reseña para este producto.' });
                return;
            }
            throw e;
        }

        res.status(201).json({ message: 'Reseña creada', id });
    } catch (error: any) {
        console.error('Error creating review:', error);
        res.status(500).json({ error: 'Error al crear reseña' });
    }
};

export const getMyReviews = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!(await requireReviewsSchema(res))) return;

        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Acceso Denegado. Token no proporcionado.' });
            return;
        }

        const [rows] = await pool.query<any[]>(
            `SELECT producto_id, rating, comentario, creado_en
             FROM Resenas
             WHERE usuario_id = ?
             ORDER BY creado_en DESC`,
            [userId]
        );

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching my reviews:', error);
        res.status(500).json({ error: 'Error al obtener reseñas' });
    }
};

export const getProductReviews = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!(await requireReviewsSchema(res))) return;

        const id = String((req.params as any)?.id || '');
        if (!isUuid(id)) {
            res.status(400).json({ error: 'ID de producto inválido' });
            return;
        }

        const [rows] = await pool.query<any[]>(
            `SELECT
                r.id,
                r.rating,
                r.comentario,
                r.creado_en,
                u.nombre,
                u.apellido
             FROM Resenas r
             JOIN Usuarios u ON u.id = r.usuario_id
             WHERE r.producto_id = ?
             ORDER BY r.creado_en DESC
             LIMIT 50`,
            [id]
        );

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching product reviews:', error);
        res.status(500).json({ error: 'Error al obtener reseñas' });
    }
};

export const getProductReviewSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!(await requireReviewsSchema(res))) return;

        const id = String((req.params as any)?.id || '');
        if (!isUuid(id)) {
            res.status(400).json({ error: 'ID de producto inválido' });
            return;
        }

        const [rows] = await pool.query<any[]>(
            `SELECT
                AVG(rating) AS average,
                CAST(COUNT(*) AS SIGNED) AS count
             FROM Resenas
             WHERE producto_id = ?`,
            [id]
        );

        res.status(200).json(rows?.[0] || { average: 0, count: 0 });
    } catch (error) {
        console.error('Error fetching review summary:', error);
        res.status(500).json({ error: 'Error al obtener resumen de reseñas' });
    }
};
