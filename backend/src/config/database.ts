import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const rawHost = process.env.DB_HOST || '127.0.0.1';
const host = rawHost === 'localhost' ? '127.0.0.1' : rawHost;

const dbConfig = {
    host: host,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'perfumissimo',
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Si se prefiere usar una URL de conexión completa:
let connectionString = process.env.DATABASE_URL;

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
        } catch (error) {
            console.error('Error in DB Query:', error, '\nSQL:', sql);
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
        console.error('❌ Error conectando a la base de datos MySQL:', err.message);
    });
