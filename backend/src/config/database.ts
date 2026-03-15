import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/postgres';

const useSsl =
    process.env.DATABASE_SSL === 'true' ||
    /supabase\.co/.test(connectionString);

const pgPool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    // Supabase pooler (session) tiene limites estrictos. Usamos 3 como punto medio para evitar el error 'MaxClientsInSessionMode'.
    max: 3,
    idleTimeoutMillis: 10000, // Cerrar conexiones inactivas rapido tras 10s
    connectionTimeoutMillis: 15000,
});

const replaceParams = (sql: string, params: any[]): string => {
    if (!params || params.length === 0) return sql;

    let paramIndex = 0;
    let inString = false;
    let result = '';

    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];

        if (char === "'" && sql[i - 1] !== '\\') {
            inString = !inString;
            result += char;
        } else if (char === '?' && !inString && paramIndex < params.length) {
            result += `$${paramIndex + 1}`;
            paramIndex++;
        } else {
            result += char;
        }
    }

    return result;
};

export const pool = {
    query: async <T = any>(sql: string, params?: any[]): Promise<[T, any]> => {
        const pgSql = replaceParams(sql, params || []);

        try {
            const result = await pgPool.query(pgSql, params);
            if (['INSERT', 'UPDATE', 'DELETE'].includes(result.command)) {
                return [{ affectedRows: result.rowCount, insertId: result.rows[0]?.id } as any, result.fields];
            }
            return [result.rows as any, result.fields];
        } catch (error) {
            console.error('Error in DB Query:', error, '\nSQL:', pgSql);
            throw error;
        }
    },
    execute: async <T = any>(sql: string, params?: any[]): Promise<[T, any]> => {
        return pool.query(sql, params);
    },
    getConnection: async (): Promise<PoolClient> => {
        return await pgPool.connect();
    }
};

pgPool.connect()
    .then((conn) => {
        console.log('✅ Conexión exitosa a la Base de Datos PostgreSQL (Supabase)');
        conn.release();
    })
    .catch((err) => {
        console.error('❌ Error conectando a la base de datos:', err.message);
    });
