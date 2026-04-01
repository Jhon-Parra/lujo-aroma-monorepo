"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const supabase_1 = require("../config/supabase");
const database_1 = require("../config/database");
dotenv_1.default.config();
const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const PAGE_SIZE = 1000;
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const randomPassword = () => crypto_1.default.randomBytes(24).toString('base64url');
const listSupabaseUsersByEmail = async () => {
    const map = new Map();
    let page = 1;
    while (true) {
        const { data, error } = await supabase_1.supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: PAGE_SIZE
        });
        if (error) {
            throw new Error(`Error listando usuarios de Supabase: ${error.message}`);
        }
        const users = data?.users || [];
        for (const user of users) {
            const email = normalizeEmail(user.email);
            if (!email)
                continue;
            if (!map.has(email)) {
                map.set(email, user.id);
            }
        }
        if (users.length < PAGE_SIZE) {
            break;
        }
        page += 1;
    }
    return map;
};
const fetchLocalUsers = async () => {
    const [rows] = await database_1.pool.query(`SELECT id, email, nombre, apellido, telefono, foto_perfil, supabase_user_id
         FROM usuarios
         ORDER BY creado_en ASC`);
    return rows;
};
const updateLocalSupabaseId = async (localId, supabaseUserId) => {
    await database_1.pool.query('UPDATE usuarios SET supabase_user_id = ? WHERE id = ?', [supabaseUserId, localId]);
};
const run = async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada. Se requiere para migrar usuarios.');
    }
    console.log(`🚀 Migración de usuarios hacia Supabase Auth${DRY_RUN ? ' (DRY RUN)' : ''}`);
    const supaMap = await listSupabaseUsersByEmail();
    const localUsers = await fetchLocalUsers();
    let linked = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;
    for (const user of localUsers) {
        const email = normalizeEmail(user.email);
        if (!email) {
            skipped += 1;
            continue;
        }
        if (user.supabase_user_id) {
            skipped += 1;
            continue;
        }
        const existingId = supaMap.get(email);
        if (existingId) {
            if (!DRY_RUN) {
                await updateLocalSupabaseId(user.id, existingId);
            }
            linked += 1;
            continue;
        }
        const password = randomPassword();
        const { data, error } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                nombre: user.nombre,
                apellido: user.apellido,
                telefono: user.telefono,
                foto_perfil: user.foto_perfil,
                local_user_id: user.id
            }
        });
        if (error || !data?.user) {
            console.error(`❌ Error creando usuario ${email}:`, error?.message || 'Unknown error');
            errors += 1;
            continue;
        }
        if (!DRY_RUN) {
            await updateLocalSupabaseId(user.id, data.user.id);
        }
        supaMap.set(email, data.user.id);
        created += 1;
    }
    console.log('✅ Migración finalizada.');
    console.log(`- Vinculados: ${linked}`);
    console.log(`- Creados: ${created}`);
    console.log(`- Omitidos: ${skipped}`);
    console.log(`- Errores: ${errors}`);
    if (created > 0) {
        console.log('ℹ️ usuarios creados tienen password aleatorio. Deben restablecer contraseña.');
    }
    process.exit(0);
};
run().catch((err) => {
    console.error('💥 Error en migración:', err.message || err);
    process.exit(1);
});
