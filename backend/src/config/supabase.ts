import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Cargar siempre el .env del backend, independiente del working directory.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Advertencia: Supabase URL o ANON KEY no configuradas');
}

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ Advertencia: Supabase SERVICE ROLE KEY no configurada');
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
