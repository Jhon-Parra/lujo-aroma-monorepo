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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseAdmin = exports.bucket = void 0;
const admin = __importStar(require("firebase-admin"));
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Cargar .env desde el working directory (backend/) si existe.
// En producción (Hostinger) normalmente se setean variables en el panel y esto no es necesario,
// pero no estorba.
dotenv.config({ path: path_1.default.resolve(process.cwd(), '.env') });
// En desarrollo y para este scaffold, si no hay credenciales completas de Firebase,
// la app de igual modo inicializará sin romperse, pero fallarán las subidas a menos que
// se configure correctamente las credenciales en .env
let isInitialized = false;
const loadServiceAccountFromEnv = () => {
    const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    const rawB64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || '').trim();
    let raw = rawJson;
    if (!raw && rawB64) {
        try {
            raw = Buffer.from(rawB64, 'base64').toString('utf8').trim();
        }
        catch {
            raw = '';
        }
    }
    if (!raw)
        return null;
    // Algunos hostings guardan el JSON entre comillas simples o dobles.
    const unwrapped = raw.replace(/^['"]|['"]$/g, '').trim();
    let parsed;
    try {
        parsed = JSON.parse(unwrapped);
    }
    catch (e) {
        // Último intento: si viene doble-escapado, a veces lo guardan como JSON-string ("{...}")
        // o con caracteres de escape raros.
        parsed = JSON.parse(unwrapped.replace(/\\"/g, '"'));
    }
    // Normalizar private_key para soportar cuando viene como "\n" literal (backslash-n)
    // en vez de saltos de línea reales.
    if (typeof parsed?.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
};
try {
    const serviceAccount = loadServiceAccountFromEnv();
    // Por defecto, Firebase Storage usa <project_id>.appspot.com
    const projectId = String(serviceAccount?.project_id || process.env.FIREBASE_PROJECT_ID || '').trim();
    const storageBucket = String(process.env.FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.appspot.com` : '')).trim();
    if (!admin.apps.length) {
        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: storageBucket || undefined
            });
            console.log('✅ Firebase Admin inicializado con Service Account.');
        }
        else {
            // Sin service account, en servidores fuera de GCP normalmente no funcionará.
            // Igual inicializamos para no romper el arranque, y las subidas darán un error más claro.
            admin.initializeApp({
                storageBucket: storageBucket || undefined
            });
            console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_JSON no configurado. Firebase Storage puede fallar en este entorno.');
        }
    }
    isInitialized = true;
    if (storageBucket) {
        console.log('✅ Firebase Storage bucket:', storageBucket);
    }
    else {
        console.warn('⚠️ FIREBASE_STORAGE_BUCKET no configurado. Se usará el bucket por defecto del proyecto si existe.');
    }
}
catch (error) {
    console.error('❌ Error crítico al inicializar Firebase Admin:', error);
}
// Exportar el bucket de forma segura. Si no se inicializó, las llamadas a bucket fallarán 
// pero no detendrán el arranque del servidor.
exports.bucket = isInitialized ? admin.storage().bucket() : null;
exports.firebaseAdmin = admin;
exports.default = admin;
