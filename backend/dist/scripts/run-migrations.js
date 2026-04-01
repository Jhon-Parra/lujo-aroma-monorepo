"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * IMPORTANT
 * This backend runs on MySQL/MariaDB.
 * The repo also contains PostgreSQL/Supabase migrations, but they must NOT be executed
 * through this script (wrong dialect, different syntax and table naming).
 */
const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_DIRS = [
    // Canonical MySQL migrations live here.
    path.join(BACKEND_ROOT, 'database', 'migrations', 'mysql'),
    // Backward-compatible fallbacks (older layouts)
    path.join(BACKEND_ROOT, 'database', 'migrations')
];
// Curated list of MySQL migrations currently used by the codebase.
// If a file is missing in one folder, we try the other.
const MYSQL_MIGRATIONS = [
    // Settings
    '20260319_settings_smtp_config_mysql.sql',
    '20260328_settings_home_premium_mysql.sql',
    '20260330_promotions_fab_clicks_mysql.sql',
    // Orders schema fixes
    '20260329_fix_orders_schema.sql',
    // Email templates/logs (MySQL)
    '05_create_email_tables.sql',
    // Indexes
    'add_product_indexes.sql'
];
const resolveMigrationPath = (filename) => {
    for (const dir of MIGRATION_DIRS) {
        const p = path.join(dir, filename);
        if (fs.existsSync(p))
            return p;
    }
    return null;
};
const stripComments = (sql) => {
    // Remove /* ... */ comments
    let s = sql.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove full-line -- comments and # comments
    s = s
        .split(/\r?\n/)
        .filter((line) => {
        const t = line.trim();
        if (!t)
            return true;
        if (t.startsWith('--'))
            return false;
        if (t.startsWith('#'))
            return false;
        return true;
    })
        .join('\n');
    return s;
};
const splitStatements = (sql) => {
    const cleaned = stripComments(sql);
    return cleaned
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
};
const isIgnorableMysqlError = (error) => {
    const code = String(error?.code || '');
    // Common idempotency errors
    return [
        'ER_DUP_FIELDNAME',
        'ER_DUP_KEYNAME',
        'ER_TABLE_EXISTS_ERROR',
        'ER_DUP_ENTRY',
        'ER_CANT_DROP_FIELD_OR_KEY'
    ].includes(code);
};
async function runMigrations() {
    console.log('🚀 Iniciando aplicación de migraciones MySQL...');
    // Track applied migrations to avoid re-running full files.
    await database_1.pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            filename VARCHAR(255) NOT NULL,
            applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_schema_migrations_filename (filename)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    const [appliedRows] = await database_1.pool.query('SELECT filename FROM schema_migrations');
    const applied = new Set((appliedRows || []).map((r) => String(r?.filename || '').trim()).filter(Boolean));
    for (const file of MYSQL_MIGRATIONS) {
        const filePath = resolveMigrationPath(file);
        if (!filePath) {
            console.warn(`⚠️ Archivo no encontrado: ${file} (buscado en: ${MIGRATION_DIRS.join(', ')}), saltando...`);
            continue;
        }
        if (applied.has(file)) {
            console.log(`↩️  Ya aplicado: ${file}`);
            continue;
        }
        console.log(`📄 Ejecutando: ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf8');
        const statements = splitStatements(sql);
        if (!statements.length) {
            console.log(`ℹ️ ${file}: sin sentencias (vacio), marcando como aplicado.`);
            await database_1.pool.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [file]);
            continue;
        }
        for (const stmt of statements) {
            try {
                await database_1.pool.query(stmt);
            }
            catch (error) {
                if (isIgnorableMysqlError(error)) {
                    console.log(`ℹ️  Ignorado (${error.code}) en ${file}`);
                    continue;
                }
                console.error(`❌ Error en ${file}:`, error?.message || error);
                throw error;
            }
        }
        await database_1.pool.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [file]);
        console.log(`✅ ${file} aplicado con éxito.`);
    }
    console.log('🏁 Proceso de migración finalizado.');
    process.exit(0);
}
runMigrations().catch(err => {
    console.error('💥 Error fatal en migraciones:', err);
    process.exit(1);
});
