"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFavorites = exports.removeFavorite = exports.addFavorite = void 0;
const database_1 = require("../config/database");
const uuid_1 = require("uuid");
const detectFavoritesSchema = async () => {
    try {
        const [tRows] = await database_1.pool.query(`SELECT COUNT(*) AS ok
             FROM information_schema.tables
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'favoritos'`);
        const ok = Number(tRows?.[0]?.ok || 0) > 0;
        if (!ok)
            return { ok: false, createdCol: null };
        const [cRows] = await database_1.pool.query(`SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'favoritos'
               AND column_name IN ('creado_en', 'created_at')`);
        const cols = new Set((cRows || []).map((r) => String(r.column_name)));
        const createdCol = cols.has('creado_en') ? 'creado_en' : (cols.has('created_at') ? 'created_at' : null);
        return { ok: true, createdCol };
    }
    catch {
        return { ok: false, createdCol: null };
    }
};
const detectProductNewUntilSchema = async () => {
    try {
        const [rows] = await database_1.pool.query(`SELECT COUNT(*) AS ok
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'productos'
               AND column_name = 'nuevo_hasta'`);
        return Number(rows?.[0]?.ok || 0) > 0;
    }
    catch {
        return false;
    }
};
const addFavorite = async (req, res) => {
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
                error: 'La tabla de favoritos no existe en la base de datos. Ejecuta las migraciones de base de datos y vuelve a intentar.'
            });
            return;
        }
        const id = (0, uuid_1.v4)();
        await database_1.pool.query(`INSERT IGNORE INTO favoritos (id, usuario_id, producto_id) VALUES (?, ?, ?)`, [id, userId, producto_id]);
        res.status(201).json({ message: 'Producto agregado a favoritos' });
    }
    catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({ error: 'Error al agregar a favoritos' });
    }
};
exports.addFavorite = addFavorite;
const removeFavorite = async (req, res) => {
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
        await database_1.pool.query(`DELETE FROM favoritos WHERE usuario_id = ? AND producto_id = ?`, [userId, productId]);
        res.status(200).json({ message: 'Producto eliminado de favoritos' });
    }
    catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ error: 'Error al eliminar de favoritos' });
    }
};
exports.removeFavorite = removeFavorite;
const getFavorites = async (req, res) => {
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
        const [rows] = await database_1.pool.query(`SELECT
                p.id,
                p.nombre AS name,
                p.nombre,
                p.genero,
                p.descripcion AS description,
                p.descripcion,
                p.notas_olfativas AS notes,
                p.notas_olfativas,
                p.precio AS price,
                p.precio,
                p.stock,
                p.imagen_url AS imageUrl,
                p.imagen_url,
                p.unidades_vendidas AS soldCount,
                p.unidades_vendidas,
                p.creado_en,
                ${esNuevoExpr}
            FROM favoritos f
            JOIN productos p ON f.producto_id = p.id
            WHERE f.usuario_id = ?
            ORDER BY ${orderCol} DESC`, [userId]);
        res.status(200).json(rows);
    }
    catch (error) {
        console.error('Error getting favorites:', error);
        res.status(500).json({ error: 'Error al obtener favoritos' });
    }
};
exports.getFavorites = getFavorites;
