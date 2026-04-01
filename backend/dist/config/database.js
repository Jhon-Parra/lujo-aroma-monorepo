"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = exports.mysqlPool = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
// El .env se carga una sola vez en src/index.ts para todo el proceso.
const rawHost = process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost';
// En muchos server Node (como Hostinger), 'localhost' intenta Socket Unix. 
// '127.0.0.1' fuerza TCP. Por defecto probamos TCP pero permitimos el original si se desea.
const host = (rawHost === 'localhost' && !process.env.DB_FORCE_LOCAL_IP) ? '127.0.0.1' : rawHost;
const dbConfig = {
    user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'lujo_aroma',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Aumentar el timeout para conexiones lentas en hosting compartido
    connectTimeout: 10000
};
if (process.env.DB_SOCKET_PATH) {
    dbConfig.socketPath = process.env.DB_SOCKET_PATH;
}
else {
    dbConfig.host = host;
    dbConfig.port = Number(process.env.DB_PORT) || Number(process.env.MYSQL_PORT) || 3306;
}
// Soporte para SSL opcional (Hostinger suele no requerirlo para localhost)
if (process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true') {
    dbConfig.ssl = {
        rejectUnauthorized: false
    };
}
// Si se prefiere usar una URL de conexión completa:
let connectionString = process.env.DATABASE_URL;
// IMPORTANTE: Si es una URL de PostgreSQL (común en Supabase), NO usarla para MySQL
if (connectionString && (connectionString.startsWith('postgresql') || connectionString.startsWith('postgres'))) {
    connectionString = undefined;
}
if (connectionString && connectionString.includes('localhost')) {
    connectionString = connectionString.replace(/localhost/g, '127.0.0.1');
}
exports.mysqlPool = connectionString
    ? promise_1.default.createPool(connectionString)
    : promise_1.default.createPool(dbConfig);
exports.pool = {
    query: async (sql, params) => {
        try {
            const [rows, fields] = await exports.mysqlPool.query(sql, params);
            return [rows, fields];
        }
        catch (error) {
            console.error(`[DB ERROR] Query execution failed:`, {
                message: error?.message,
                code: error?.code,
                errno: error?.errno,
                sqlState: error?.sqlState
            });
            throw error;
        }
    },
    execute: async (sql, params) => {
        return exports.pool.query(sql, params);
    },
    getConnection: async () => {
        return await exports.mysqlPool.getConnection();
    }
};
// Verificación de conexión con Diagnóstico Detallado
exports.mysqlPool.getConnection()
    .then((conn) => {
    console.log('✅ Base de Datos: Conexión establecida correctamente.');
    conn.release();
})
    .catch((err) => {
    console.error('❌ ERROR CRÍTICO DE CONEXIÓN DB:', {
        code: err.code,
        message: err.message,
        host: dbConfig.host,
        user: dbConfig.user,
        database: dbConfig.database,
        port: dbConfig.port
    });
    // Sugerencias basadas en el código de error
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('💡 TIP: Revisa que el DB_USER y DB_PASSWORD sean correctos en el .env. En Hostinger, el usuario suele tener un prefijo (ej: u12345_...).');
    }
    else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        console.error('💡 TIP: El HOST no es alcanzable. Si estás en Hostinger, intenta con "localhost" o "127.0.0.1".');
    }
    else if (err.code === 'ER_BAD_DB_ERROR') {
        console.error('💡 TIP: La base de datos especificada no existe. Verifica el nombre exacto en el hPanel.');
    }
});
