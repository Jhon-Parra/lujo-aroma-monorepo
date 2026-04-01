"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategoriesAdmin = exports.getCategories = void 0;
const database_1 = require("../config/database");
const uuid_1 = require("uuid");
const slugify = (name) => {
    return String(name || '')
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120);
};
const ensureCategoriesSchema = async () => {
    try {
        const [rows] = await database_1.pool.query(`SELECT COUNT(*) AS ok 
             FROM information_schema.tables 
             WHERE table_schema = DATABASE() 
               AND lower(table_name) = 'categorias'`);
        return Number(rows?.[0]?.ok || 0) > 0;
    }
    catch {
        return false;
    }
};
const ensureProductsCasaSchema = async () => {
    try {
        const [rows] = await database_1.pool.query(`SELECT COUNT(*) AS ok
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'productos'
               AND column_name = 'casa'
             LIMIT 1`);
        return Number(rows?.[0]?.ok || 0) > 0;
    }
    catch {
        return false;
    }
};
const getCategories = async (_req, res) => {
    try {
        const ok = await ensureCategoriesSchema();
        if (!ok) {
            res.status(200).json([]);
            return;
        }
        const [rows] = await database_1.pool.query(`SELECT id, nombre, slug
             FROM categorias
             WHERE activo = true
             ORDER BY nombre ASC`);
        res.status(200).json(rows);
    }
    catch (e) {
        console.error('Error fetching categories:', e);
        res.status(500).json({ error: 'Error al obtener categorias' });
    }
};
exports.getCategories = getCategories;
const getCategoriesAdmin = async (_req, res) => {
    try {
        const ok = await ensureCategoriesSchema();
        if (!ok) {
            res.status(400).json({ error: 'Tu base de datos no soporta categorias. Ejecuta database/migrations/20260312_categories.sql en Supabase.' });
            return;
        }
        const casaOk = await ensureProductsCasaSchema();
        const productCol = casaOk ? 'p.casa' : 'p.genero';
        const [rows] = await database_1.pool.query(`SELECT
                c.id,
                c.nombre,
                c.slug,
                c.activo,
                c.creado_en,
                (SELECT COUNT(*) FROM productos p WHERE ${productCol} = c.slug) AS total_productos
             FROM categorias c
             ORDER BY c.nombre ASC`);
        res.status(200).json(rows);
    }
    catch (e) {
        console.error('Error fetching categories admin:', e);
        res.status(500).json({ error: 'Error al obtener categorias' });
    }
};
exports.getCategoriesAdmin = getCategoriesAdmin;
const createCategory = async (req, res) => {
    try {
        const ok = await ensureCategoriesSchema();
        if (!ok) {
            res.status(400).json({ error: 'Tu base de datos no soporta categorias. Ejecuta database/migrations/20260312_categories.sql en Supabase.' });
            return;
        }
        const nombre = String(req.body?.nombre || '').trim();
        if (!nombre) {
            res.status(400).json({ error: 'El nombre es requerido' });
            return;
        }
        const slug = slugify(nombre);
        if (!slug) {
            res.status(400).json({ error: 'Nombre inválido' });
            return;
        }
        const id = (0, uuid_1.v4)();
        await database_1.pool.query('INSERT INTO categorias (id, nombre, slug, activo) VALUES (?, ?, ?, true)', [id, nombre, slug]);
        res.status(201).json({ message: 'Categoria creada', id });
    }
    catch (e) {
        const msg = String(e?.message || '');
        if (/categorias_nombre_unique_ci|categorias_slug_unique_ci|duplicate key/i.test(msg)) {
            res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
            return;
        }
        console.error('Error creating category:', e);
        res.status(500).json({ error: 'Error al crear categoria' });
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res) => {
    try {
        const ok = await ensureCategoriesSchema();
        if (!ok) {
            res.status(400).json({ error: 'Tu base de datos no soporta categorias. Ejecuta database/migrations/20260312_categories.sql en Supabase.' });
            return;
        }
        const { id } = req.params;
        const nombre = String(req.body?.nombre || '').trim();
        const activoRaw = req.body?.activo;
        const activo = activoRaw === undefined ? undefined : !!activoRaw;
        if (!nombre && activo === undefined) {
            res.status(400).json({ error: 'No hay cambios' });
            return;
        }
        const updates = [];
        const params = [];
        if (nombre) {
            const slug = slugify(nombre);
            updates.push('nombre = ?');
            params.push(nombre);
            updates.push('slug = ?');
            params.push(slug);
        }
        if (activo !== undefined) {
            updates.push('activo = ?');
            params.push(activo);
        }
        params.push(id);
        const sql = `UPDATE categorias SET ${updates.join(', ')} WHERE id = ?`;
        const [result] = await database_1.pool.query(sql, params);
        if (result?.affectedRows === 0) {
            res.status(404).json({ error: 'Categoria no encontrada' });
            return;
        }
        res.status(200).json({ message: 'Categoria actualizada' });
    }
    catch (e) {
        const msg = String(e?.message || '');
        if (/categorias_nombre_unique_ci|categorias_slug_unique_ci|duplicate key/i.test(msg)) {
            res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
            return;
        }
        console.error('Error updating category:', e);
        res.status(500).json({ error: 'Error al actualizar categoria' });
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res) => {
    try {
        const ok = await ensureCategoriesSchema();
        if (!ok) {
            res.status(400).json({ error: 'Tu base de datos no tiene la tabla de categorias. Ejecuta las migraciones de base de datos.' });
            return;
        }
        const casaOk = await ensureProductsCasaSchema();
        const productCol = casaOk ? 'casa' : 'genero';
        const { id } = req.params;
        const [rows] = await database_1.pool.query('SELECT slug FROM categorias WHERE id = ?', [id]);
        const slug = rows?.[0]?.slug;
        if (!slug) {
            res.status(404).json({ error: 'Categoria no encontrada' });
            return;
        }
        const [countRows] = await database_1.pool.query(`SELECT COUNT(*) AS n FROM productos WHERE ${productCol} = ?`, [slug]);
        const n = Number(countRows?.[0]?.n || 0);
        if (n > 0) {
            res.status(409).json({ error: 'No puedes eliminar una categoria con productos asociados.' });
            return;
        }
        const [result] = await database_1.pool.query('DELETE FROM categorias WHERE id = ?', [id]);
        if (result?.affectedRows === 0) {
            res.status(404).json({ error: 'Categoria no encontrada' });
            return;
        }
        res.status(200).json({ message: 'Categoria eliminada' });
    }
    catch (e) {
        console.error('Error deleting category:', e);
        res.status(500).json({ error: 'Error al eliminar categoria' });
    }
};
exports.deleteCategory = deleteCategory;
