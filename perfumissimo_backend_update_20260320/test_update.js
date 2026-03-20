const { pool } = require('./src/config/database');
const id = '13e174fb-f786-464a-a708-0f6f4421a85b';
const updates = ['nombre = ?', 'genero = ?', 'descripcion = ?', 'precio = ?', 'stock = ?'];
const params = ['Perfume Editado', 'unisex', '1234567890', 100, 10, id];
const query = `UPDATE Productos SET ${updates.join(', ')} WHERE id = ?`;

pool.query(query, params)
  .then(res => console.log('Exito:', res))
  .catch(err => console.error('Error pgPool:', err))
  .finally(() => process.exit(0));
