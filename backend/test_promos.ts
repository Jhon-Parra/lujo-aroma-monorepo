import { pool } from './src/config/database';

async function test() {
    try {
        const [rows] = await pool.query('SELECT id, nombre, activo, fecha_inicio, fecha_fin FROM Promociones ORDER BY creado_en DESC LIMIT 10');
        console.log('--- PROMOTIONS DATA ---');
        console.table(rows);
        console.log('Current Date (Server):', new Date().toLocaleString());
        process.exit(0);
    } catch (err) {
        console.error('Error querying promotions:', err);
        process.exit(1);
    }
}

test();
