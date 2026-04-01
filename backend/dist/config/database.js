"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = exports.mysqlPool = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Cargar siempre el .env del backend, independiente del working directory.
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const rawHost = process.env.DB_HOST || '127.0.0.1';
const host = rawHost === 'localhost' ? '127.0.0.1' : rawHost;
const dbConfig = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lujo_aroma',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
if (process.env.DB_SOCKET_PATH) {
    dbConfig.socketPath = process.env.DB_SOCKET_PATH;
}
else {
    dbConfig.host = host;
    dbConfig.port = Number(process.env.DB_PORT) || 3306;
}
// Si se prefiere usar una URL de conexión completa:
let connectionString = process.env.DATABASE_URL;
// IMPORTANTE: Si es una URL de PostgreSQL (común en Supabase), NO usarla para MySQL
if (connectionString && connectionString.startsWith('postgresql')) {
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
            // mysql2 ya usa '?' de forma nativa
            const [rows, fields] = await exports.mysqlPool.query(sql, params);
            return [rows, fields];
        }
        catch (error) {
            console.error(`[DB ERROR] Query execution failed:`, {
                message: error?.message,
                code: error?.code,
                sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : '')
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
exports.mysqlPool.getConnection()
    .then((conn) => {
    console.log('✅ Conexión exitosa a la Base de Datos MySQL');
    conn.release();
})
    .catch((err) => {
    console.error('❌ Error conectando a la base de datos MySQL:', {
        message: err.message,
        code: err.code,
        host: dbConfig.host,
        user: dbConfig.user,
        database: dbConfig.database
    });
});
