/**
 * Hostinger Startup Script with Integrated DB Diagnostics
 */
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables directamente desde el .env
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('---------------------------------------------------------');
console.log('🛡️  HOSTINGER ENTRY POINT: Verificando Entorno...');
console.log('---------------------------------------------------------');

const dbConfig = {
    host: (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST,
    user: process.env.DB_USER || process.env.MYSQL_USER,
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
    port: Number(process.env.DB_PORT) || 3306
};

async function checkConnection() {
    console.log(`🔌 Probando conexión a: ${dbConfig.host} usuario: ${dbConfig.user}`);
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ CONEXIÓN EXITOSA: La base de datos está alcanzable.');
        await connection.end();
    } catch (err) {
        console.error('❌ ERROR CRÍTICO DE CONEXIÓN DB:');
        console.error(`   - Código: ${err.code}`);
        console.error(`   - Mensaje: ${err.message}`);
        console.log('---------------------------------------------------------');
    }
}

// Ejecutar diagnóstico
checkConnection().then(() => {
    console.log('🚀 Iniciando aplicación principal desde dist/index.js...');
    try {
        require('./dist/index.js');
    } catch (e) {
        console.error('⚠️  Error al cargar dist/index.js. ¿Has ejecutado npm run build?');
        console.error(e.message);
    }
});
