import { pool } from './src/config/database';

async function checkConfigData() {
    try {
        console.log('Fetching configuracionglobal data...');
        const [rows]: any = await pool.query('SELECT * FROM configuracionglobal WHERE id = 1');
        if (rows.length > 0) {
            console.log('Config data:', JSON.stringify(rows[0], null, 2));
        } else {
            console.log('No config data found (id=1).');
        }
    } catch (error: any) {
        console.error('Check failed:', error.message);
    } finally {
        process.exit();
    }
}

checkConfigData();
