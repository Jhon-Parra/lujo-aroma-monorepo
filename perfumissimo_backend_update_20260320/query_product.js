const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:diqvaw-geqdY4-parra@db.xzbvgzvgpfsbybsqtbuu.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false }});
pool.query("SELECT * FROM Productos WHERE id = '28523278-9aae-40d6-a009-a0992ff13a6e'")
  .then(res => { console.log(res.rows); pool.end(); })
  .catch(err => { console.error(err); pool.end(); });
