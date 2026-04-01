import { createClient } from '@supabase/supabase-js';
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// Diagnóstico de carga (solo los últimos caracteres por seguridad)
console.log('--- SUPABASE CONFIG DIAGNOSTIC ---');
console.log('URL:', supabaseUrl || '⚠️ MISSING');
console.log('ANON_KEY (last 4):', supabaseAnonKey ? `...${supabaseAnonKey.slice(-4)}` : '⚠️ MISSING');
console.log('SERVICE_KEY (last 4):', supabaseServiceKey ? `...${supabaseServiceKey.slice(-4)}` : '⚠️ MISSING (optional)');
console.log('---------------------------------');

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ FATAL: Supabase URL o ANON KEY no están configuradas correctamente.');
    console.error('💡 Asegúrate de que el archivo .env esté en la raíz del proyecto o las variables estén seteadas en el panel de Hostinger.');
    process.exit(1);
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
