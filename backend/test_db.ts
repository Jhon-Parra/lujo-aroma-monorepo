import { pool } from './src/config/database';
async function test() {
  const [rows] = await pool.query('SHOW COLUMNS FROM productos');
  console.log(rows);
  const [catRows] = await pool.query('SHOW TABLES LIKE "categorias"');
  if (catRows.length > 0) {
     const [cRows] = await pool.query('SHOW COLUMNS FROM categorias');
     console.log("Categorias:", cRows);
  }
  process.exit(0);
}
test();
