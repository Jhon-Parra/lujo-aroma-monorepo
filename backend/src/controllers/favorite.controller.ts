import { Request, Response } from 'express';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth.middleware';

const detectFavoritesSchema = async (): Promise<{ ok: boolean; createdCol: 'creado_en' | 'created_at' | null }> => {
    try {
        const [tRows] = await pool.query<any[]>(
            `SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND lower(table_name) = 'favoritos'
            ) AS ok`
        );

        const ok = !!tRows?.[0]?.ok;
        if (!ok) return { ok: false, createdCol: null };

        const [cRows] = await pool.query<any[]>(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND lower(table_name) = 'favoritos'
               AND column_name IN ('creado_en', 'created_at')`
        );

        const cols = new Set((cRows || []).map((r: any) => String(r.column_name)));
        const createdCol = cols.has('creado_en') ? 'creado_en' : (cols.has('created_at') ? 'created_at' : null);
        return { ok: true, createdCol };
    } catch {
        return { ok: false, createdCol: null };
    }
};

const detectProductNewUntilSchema = async (): Promise<boolean> => {
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND lower(table_name) = 'productos'
                  AND column_name = 'nuevo_hasta'
            ) AS ok`
        );
        return !!rows?.[0]?.ok;
    } catch {
        return false;
    }
};

export const addFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { producto_id } = req.body;

        if (!userId) {
            res.status(401).json({ error: 'Usuario no autenticado' });
            return;
        }

        if (!producto_id) {
            res.status(400).json({ error: 'Producto ID es requerido' });
            return;
        }

        const favSchema = await detectFavoritesSchema();
        if (!favSchema.ok) {
            res.status(400).json({
                error: 'La tabla de favoritos no existe en la base de datos. Crea la tabla Favoritos en Supabase (schema_postgres.sql) y vuelve a intentar.'
            });
            return;
        }

        const id = uuidv4();
        await pool.query(
            `INSERT INTO favoritos (id, usuario_id, producto_id) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, producto_id) DO NOTHING`,
            [id, userId, producto_id]
        );

        res.status(201).json({ message: 'Producto agregado a favoritos' });
    } catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({ error: 'Error al agregar a favoritos' });
    }
};

export const removeFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { productId } = req.params;

        if (!userId) {
            res.status(401).json({ error: 'Usuario no autenticado' });
            return;
        }

        const favSchema = await detectFavoritesSchema();
        if (!favSchema.ok) {
            res.status(400).json({
                error: 'La tabla de favoritos no existe en la base de datos.'
            });
            return;
        }

        await pool.query(
            `DELETE FROM favoritos WHERE usuario_id = $1 AND producto_id = $2`,
            [userId, productId]
        );

        res.status(200).json({ message: 'Producto eliminado de favoritos' });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ error: 'Error al eliminar de favoritos' });
    }
};

export const getFavorites = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Usuario no autenticado' });
            return;
        }

        const favSchema = await detectFavoritesSchema();
        if (!favSchema.ok) {
            // Para no romper el frontend si aun no se aplica la tabla
            res.status(200).json([]);
            return;
        }

        const newUntilOk = await detectProductNewUntilSchema();
        const esNuevoExpr = newUntilOk
            ? `CASE
                WHEN COALESCE(p.es_nuevo, false) = false THEN false
                WHEN p.nuevo_hasta IS NULL THEN true
                WHEN p.nuevo_hasta >= NOW() THEN true
                ELSE false
               END AS es_nuevo`
            : 'COALESCE(p.es_nuevo, false) AS es_nuevo';

        const orderCol = favSchema.createdCol ? `f.${favSchema.createdCol}` : 'f.id';

        const [rows] = await pool.query(
            `SELECT
                p.id,
                p.nombre,
                p.genero,
                p.descripcion,
                p.notas_olfativas,
                p.precio,
                p.stock,
                p.imagen_url,
                p.unidades_vendidas,
                p.creado_en,
                ${esNuevoExpr}
            FROM favoritos f
            JOIN productos p ON f.producto_id = p.id
            WHERE f.usuario_id = $1
            ORDER BY ${orderCol} DESC NULLS LAST`,
            [userId]
        );

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error getting favorites:', error);
        res.status(500).json({ error: 'Error al obtener favoritos' });
    }
};
