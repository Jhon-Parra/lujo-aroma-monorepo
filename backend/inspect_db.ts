import { pool } from './src/config/database';
async function run() {
    try {
        const [rows] = await pool.query('SHOW COLUMNS FROM productos');
        console.log("Productos:", rows);
        const [cats] = await pool.query('SHOW TABLES LIKE "categorias"');
        if ((cats as any[]).length > 0) {
            const [catRows] = await pool.query('SHOW COLUMNS FROM categorias');
            console.log("Categorias:", catRows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
