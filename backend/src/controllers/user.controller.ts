import { Request, Response } from 'express';
import { pool } from '../config/database';

// 1. Obtener todos los usuarios
export const getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const [rows] = await pool.query<any[]>(`
            SELECT id, nombre, apellido, email, telefono, rol, segmento, creado_en 
            FROM Usuarios
            ORDER BY creado_en DESC
        `);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error al obtener los usuarios' });
    }
};

// 2. Actualizar el rol de un usuario
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rol } = req.body;

        const validRoles = ['SUPERADMIN', 'ADMIN', 'VENTAS', 'PRODUCTOS', 'CUSTOMER'];
        if (!validRoles.includes(rol)) {
            res.status(400).json({ error: 'Rol inválido' });
            return;
        }

        const [result] = await pool.query<any>(`
            UPDATE Usuarios SET rol = ? WHERE id = ?
        `, [rol, id]);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }

        res.status(200).json({ message: 'Rol actualizado exitosamente' });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Error del servidor al actualizar rol' });
    }
};

// 3. Actualizar el segmento de un usuario
export const updateUserSegment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { segmento } = req.body as any;

        const value = typeof segmento === 'string' ? segmento.trim() : '';

        const [result] = await pool.query<any>(`
            UPDATE Usuarios SET segmento = ? WHERE id = ?
        `, [value.length > 0 ? value : null, id]);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }

        res.status(200).json({ message: 'Segmento actualizado exitosamente' });
    } catch (error) {
        console.error('Error updating user segment:', error);
        res.status(500).json({ error: 'Error del servidor al actualizar segmento' });
    }
};
