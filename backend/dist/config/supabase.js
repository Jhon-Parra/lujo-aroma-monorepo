"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = exports.supabasePublic = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Asegurar carga de .env independiente del contexto
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
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
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey || supabaseAnonKey, authOptions);
exports.supabasePublic = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, authOptions);
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey || supabaseAnonKey, authOptions);
