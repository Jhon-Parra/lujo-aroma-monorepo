import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Asegurar carga de .env independiente del contexto
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// Diagnóstico de carga (solo los primeros caracteres por seguridad)
console.log('--- SUPABASE CONFIG DIAGNOSTIC ---');
console.log('URL:', supabaseUrl || 'MISSING');
console.log('ANON_KEY (last 4):', supabaseAnonKey ? `...${supabaseAnonKey.slice(-4)}` : 'MISSING');
console.log('SERVICE_KEY (last 4):', supabaseServiceKey ? `...${supabaseServiceKey.slice(-4)}` : 'MISSING');
console.log('---------------------------------');

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ FATAL: Supabase URL o ANON KEY no están configuradas en el .env');
    process.exit(1);
}

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ Warning: Supabase SERVICE ROLE KEY no configurada. Algunas funciones admin fallarán.');
}

const authOptions = {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
};

export const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, authOptions);
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, authOptions);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, authOptions);
