import { Request, Response } from 'express';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const slugify = (name: string): string => {
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

const ensureCategoriesSchema = async (): Promise<boolean> => {
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) AS ok 
             FROM information_schema.tables 
             WHERE table_schema = DATABASE() 
               AND lower(table_name) = 'categorias'`
        );
        return Number(rows?.[0]?.ok || 0) > 0;
    } catch {
        return false;
    }
};

export const getCategories = async (_req: Request, res: Response): Promise<void> => {
    try {
        const ok = await ensureCategoriesSchema();
        if (!ok) {
            res.status(200).json([]);
            return;
        }

        const [rows] = await pool.query<any[]>(
            `SELECT id, nombre, slug
             FROM Categorias
             WHERE activo = true
             ORDER BY nombre ASC`
        );
        res.status(200).json(rows);
    } catch (e) {
        console.error('Error fetching categories:', e);
        res.status(500).json({ error: 'Error al obtener categorias' });
    }
};

export const getCategoriesAdmin = async (_req: Request, res: Response): Promise<void> => {
    try {
        const ok = await ensureCategoriesSchema();
        if (!ok) {
            res.status(400).json({ error: 'Tu base de datos no soporta categorias. Ejecuta database/migrations/20260312_categories.sql en Supabase.' });
            return;
        }

        const [rows] = await pool.query<any[]>(
            `SELECT
                c.id,
                c.nombre,
                c.slug,
                c.activo,
                c.creado_en,
                (SELECT COUNT(*) FROM Productos p WHERE p.genero = c.slug) AS total_productos
             FROM Categorias c
             ORDER BY c.nombre ASC`
        );
        res.status(200).json(rows);
    } catch (e) {
        console.error('Error fetching categories admin:', e);
        res.status(500).json({ error: 'Error al obtener categorias' });
    }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
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

        const id = uuidv4();
        await pool.query('INSERT INTO categorias (id, nombre, slug, activo) VALUES (?, ?, ?, true)', [id, nombre, slug]);
        res.status(201).json({ message: 'Categoria creada', id });
    } catch (e: any) {
        const msg = String(e?.message || '');
        if (/categorias_nombre_unique_ci|categorias_slug_unique_ci|duplicate key/i.test(msg)) {
            res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
            return;
        }
        console.error('Error creating category:', e);
        res.status(500).json({ error: 'Error al crear categoria' });
    }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
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

        const updates: string[] = [];
        const params: any[] = [];

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
        const [result] = await pool.query<any>(sql, params);
        if ((result as any)?.affectedRows === 0) {
            res.status(404).json({ error: 'Categoria no encontrada' });
            return;
        }
        res.status(200).json({ message: 'Categoria actualizada' });
    } catch (e: any) {
        const msg = String(e?.message || '');
        if (/categorias_nombre_unique_ci|categorias_slug_unique_ci|duplicate key/i.test(msg)) {
            res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
            return;
        }
        console.error('Error updating category:', e);
        res.status(500).json({ error: 'Error al actualizar categoria' });
    }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const ok = await ensureCategoriesSchema();
        if (!ok) {
            res.status(400).json({ error: 'Tu base de datos no tiene la tabla de categorias. Ejecuta las migraciones de base de datos.' });
            return;
        }

        const { id } = req.params;
        const [rows] = await pool.query<any[]>('SELECT slug FROM Categorias WHERE id = ?', [id]);
        const slug = rows?.[0]?.slug;
        if (!slug) {
            res.status(404).json({ error: 'Categoria no encontrada' });
            return;
        }

        const [countRows] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM Productos WHERE genero = ?', [slug]);
        const n = Number(countRows?.[0]?.n || 0);
        if (n > 0) {
            res.status(409).json({ error: 'No puedes eliminar una categoria con productos asociados.' });
            return;
        }

        const [result] = await pool.query<any>('DELETE FROM Categorias WHERE id = ?', [id]);
        if ((result as any)?.affectedRows === 0) {
            res.status(404).json({ error: 'Categoria no encontrada' });
            return;
        }
        res.status(200).json({ message: 'Categoria eliminada' });
    } catch (e) {
        console.error('Error deleting category:', e);
        res.status(500).json({ error: 'Error al eliminar categoria' });
    }
};
