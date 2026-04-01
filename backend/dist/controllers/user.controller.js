"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSegment = exports.updateUserRole = exports.getUsers = void 0;
const database_1 = require("../config/database");
// 1. Obtener todos los usuarios
const getUsers = async (req, res) => {
    try {
        const [rows] = await database_1.pool.query(`
            SELECT id, nombre, apellido, email, telefono, rol, segmento, creado_en 
            FROM usuarios
            ORDER BY creado_en DESC
        `);
        res.status(200).json(rows);
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error al obtener los usuarios' });
    }
};
exports.getUsers = getUsers;
// 2. Actualizar el rol de un usuario
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { rol } = req.body;
        const validRoles = ['SUPERADMIN', 'ADMIN', 'VENTAS', 'PRODUCTOS', 'CUSTOMER'];
        if (!validRoles.includes(rol)) {
            res.status(400).json({ error: 'Rol inválido' });
            return;
        }
        const [result] = await database_1.pool.query(`
            UPDATE usuarios SET rol = ? WHERE id = ?
        `, [rol, id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }
        res.status(200).json({ message: 'Rol actualizado exitosamente' });
    }
    catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Error del servidor al actualizar rol' });
    }
};
exports.updateUserRole = updateUserRole;
// 3. Actualizar el segmento de un usuario
const updateUserSegment = async (req, res) => {
    try {
        const { id } = req.params;
        const { segmento } = req.body;
        const value = typeof segmento === 'string' ? segmento.trim() : '';
        const [result] = await database_1.pool.query(`
            UPDATE usuarios SET segmento = ? WHERE id = ?
        `, [value.length > 0 ? value : null, id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }
        res.status(200).json({ message: 'Segmento actualizado exitosamente' });
    }
    catch (error) {
        console.error('Error updating user segment:', error);
        res.status(500).json({ error: 'Error del servidor al actualizar segmento' });
    }
};
exports.updateUserSegment = updateUserSegment;
