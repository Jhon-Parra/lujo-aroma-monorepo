"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = exports.supabasePublic = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Cargar siempre el .env del backend, independiente del working directory.
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
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
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey || supabaseAnonKey, authOptions);
exports.supabasePublic = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, authOptions);
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey || supabaseAnonKey, authOptions);
