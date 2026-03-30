import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Cargar siempre el .env del backend, independiente del working directory.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const rawHost = process.env.DB_HOST || '127.0.0.1';
const host = rawHost === 'localhost' ? '127.0.0.1' : rawHost;

const dbConfig: any = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lujo_aroma',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

if (process.env.DB_SOCKET_PATH) {
    dbConfig.socketPath = process.env.DB_SOCKET_PATH;
} else {
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

export const mysqlPool = connectionString 
    ? mysql.createPool(connectionString)
    : mysql.createPool(dbConfig);

export const pool = {
    query: async <T = any>(sql: string, params?: any[]): Promise<[T, any]> => {
        try {
            // mysql2 ya usa '?' de forma nativa
            const [rows, fields] = await mysqlPool.query(sql, params);
            return [rows as any, fields];
        } catch (error: any) {
            console.error(`[DB ERROR] Query execution failed:`, {
                message: error?.message,
                code: error?.code,
                sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : '')
            });
            throw error;
        }
    },
    execute: async <T = any>(sql: string, params?: any[]): Promise<[T, any]> => {
        return pool.query(sql, params);
    },
    getConnection: async (): Promise<any> => {
        return await mysqlPool.getConnection();
    }
};

mysqlPool.getConnection()
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
