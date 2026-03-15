import dotenv from 'dotenv';
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { pool } from '../config/database';

dotenv.config();

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const PAGE_SIZE = 1000;

type LocalUser = {
    id: string;
    email: string;
    nombre: string | null;
    apellido: string | null;
    telefono: string | null;
    foto_perfil: string | null;
    supabase_user_id: string | null;
};

const normalizeEmail = (email?: string | null) => String(email || '').trim().toLowerCase();

const randomPassword = () => crypto.randomBytes(24).toString('base64url');

const listSupabaseUsersByEmail = async (): Promise<Map<string, string>> => {
    const map = new Map<string, string>();
    let page = 1;

    while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: PAGE_SIZE
        });

        if (error) {
            throw new Error(`Error listando usuarios de Supabase: ${error.message}`);
        }

        const users = data?.users || [];
        for (const user of users) {
            const email = normalizeEmail(user.email);
            if (!email) continue;
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

const fetchLocalUsers = async (): Promise<LocalUser[]> => {
    const [rows] = await pool.query<any[]>(
        `SELECT id, email, nombre, apellido, telefono, foto_perfil, supabase_user_id
         FROM Usuarios
         ORDER BY creado_en ASC`
    );
    return (rows as any[]) as LocalUser[];
};

const updateLocalSupabaseId = async (localId: string, supabaseUserId: string) => {
    await pool.query(
        'UPDATE Usuarios SET supabase_user_id = $1 WHERE id = $2',
        [supabaseUserId, localId]
    );
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
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
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
        console.log('ℹ️ Usuarios creados tienen password aleatorio. Deben restablecer contraseña.');
    }

    process.exit(0);
};

run().catch((err) => {
    console.error('💥 Error en migración:', err.message || err);
    process.exit(1);
});
