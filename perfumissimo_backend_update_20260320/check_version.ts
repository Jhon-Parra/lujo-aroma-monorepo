import { pool } from './src/config/database';

async function check() {
    try {
        const [rows] = await pool.query('SELECT VERSION() as version');
        console.log('MySQL Version:', (rows as any)[0].version);
        
        // Check LATERAL support
        try {
            await pool.query('SELECT * FROM (SELECT 1) AS t1, LATERAL (SELECT 1 AS x) AS t2 ON true');
            console.log('LATERAL support: YES');
        } catch (e) {
            console.log('LATERAL support: NO');
        }
        
        // Check JSON_TABLE support
        try {
            await pool.query("SELECT * FROM JSON_TABLE('[1]', '$[*]' COLUMNS (val INT PATH '$')) AS jt");
            console.log('JSON_TABLE support: YES');
        } catch (e) {
            console.log('JSON_TABLE support: NO');
        }
        
        process.exit(0);
    } catch (e) {
        console.error('Connection failed:', e);
        process.exit(1);
    }
}
check();
