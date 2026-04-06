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
exports.firebaseAdmin = exports.bucket = exports.firebaseDiagnostics = void 0;
const admin = __importStar(require("firebase-admin"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Cargar variables de entorno desde ubicaciones comunes.
// En producción `process.cwd()` puede ser distinto a `backend/`.
const envCandidates = [
    // backend/.env (funciona tanto desde src/ como dist/)
    path_1.default.resolve(__dirname, '../../.env'),
    // fallback por si el proceso arranca dentro de backend/
    path_1.default.resolve(process.cwd(), '.env'),
    // fallback cuando el proceso arranca en el root del repo
    path_1.default.resolve(process.cwd(), 'backend/.env')
];
let loadedEnvFrom = null;
for (const p of envCandidates) {
    const r = dotenv_1.default.config({ path: p });
    if (!r.error) {
        loadedEnvFrom = p;
        break;
    }
}
if (loadedEnvFrom) {
    console.log(`ℹ️ .env cargado desde: ${loadedEnvFrom}`);
}
else {
    console.log('ℹ️ No se encontró .env (se usarán variables de entorno del hosting si existen).');
}
const unquote = (v) => {
    const s = String(v ?? '').trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
    }
    return s;
};
const normalizeBucketName = (raw) => {
    const v = String(raw ?? '').trim();
    if (!v)
        return undefined;
    // gs://bucket-name
    if (v.startsWith('gs://'))
        return v.slice('gs://'.length);
    // If someone pastes the Firebase REST endpoint, try to extract bucket name.
    // Example: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/...
    const m = v.match(/\/v0\/b\/([^/]+)\//i);
    if (m?.[1])
        return m[1];
    return v;
};
let lastInitError = null;
exports.firebaseDiagnostics = {
    loadedEnvFrom,
    // keep this safe: booleans and sanitized values only
    env: {
        FIREBASE_PROJECT_ID: !!String(process.env.FIREBASE_PROJECT_ID ?? '').trim(),
        FIREBASE_CLIENT_EMAIL: !!String(process.env.FIREBASE_CLIENT_EMAIL ?? '').trim(),
        FIREBASE_PRIVATE_KEY: !!String(process.env.FIREBASE_PRIVATE_KEY ?? '').trim(),
        FIREBASE_STORAGE_BUCKET: !!String(process.env.FIREBASE_STORAGE_BUCKET ?? '').trim(),
    },
    lastInitError
};
/**
 * Inicialización Robusta de Firebase Admin
 * Prioriza variables individuales para mayor compatibilidad con Hostinger y otros hostings.
 */
function initializeFirebase() {
    try {
        const storageBucketRaw = process.env.FIREBASE_STORAGE_BUCKET;
        const storageBucket = normalizeBucketName(storageBucketRaw)?.trim();
        // Evitar re-inicialización
        if (admin.apps.length > 0) {
            return storageBucket ? admin.storage().bucket(storageBucket) : admin.storage().bucket();
        }
        const projectIdRaw = process.env.FIREBASE_PROJECT_ID;
        const clientEmailRaw = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
        const projectId = String(projectIdRaw ?? '').trim();
        const clientEmail = String(clientEmailRaw ?? '').trim();
        // Súper Formateador de PEM: Extrae la base64 y la re-envuelve correctamente
        const pkRaw = String(privateKeyRaw ?? '').replace(/\\n/g, '\n');
        const pkBase64 = pkRaw
            .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, '')
            .replace(/\s+/g, '')
            .trim();
        const privateKey = `-----BEGIN PRIVATE KEY-----\n${pkBase64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----\n`;
        const debugRaw = String(process.env.FIREBASE_DEBUG || '').trim().toLowerCase();
        const debug = debugRaw === 'true' || debugRaw === '1';
        // Logs temporales (seguros) para validar que las variables llegan.
        // No imprimimos secretos; solo presencia/forma.
        console.log('--- [Firebase Admin Env Check] ---');
        console.log('FIREBASE_PROJECT_ID:', projectId ? `✅ (${projectId})` : '❌ MISSING');
        console.log('FIREBASE_CLIENT_EMAIL:', clientEmail ? `✅ (${clientEmail.slice(0, 3)}...${clientEmail.slice(-12)})` : '❌ MISSING');
        console.log('FIREBASE_PRIVATE_KEY:', privateKey ? `✅ (len=${privateKey.length}, hasBegin=${privateKey.includes('BEGIN PRIVATE KEY')}, hasNewlines=${privateKey.includes('\n')})` : '❌ MISSING');
        console.log('FIREBASE_STORAGE_BUCKET:', storageBucket ? `✅ (${storageBucket})` : '❌ MISSING');
        if (!projectId || !clientEmail || !privateKey || !storageBucket) {
            const missing = [
                !projectId ? 'FIREBASE_PROJECT_ID' : '',
                !clientEmail ? 'FIREBASE_CLIENT_EMAIL' : '',
                !privateKey ? 'FIREBASE_PRIVATE_KEY' : '',
                !storageBucket ? 'FIREBASE_STORAGE_BUCKET' : ''
            ].filter(Boolean);
            lastInitError = `Missing required env vars: ${missing.join(', ')}`;
            exports.firebaseDiagnostics.lastInitError = lastInitError;
            console.warn('⚠️ No se pudo inicializar Firebase Admin:', lastInitError);
            return null;
        }
        // Inicializar SOLO con las 4 variables (sin JSON de service account)
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey
            }),
            storageBucket
        });
        if (debug) {
            console.log('✅ Firebase Admin inicializado con variables de entorno (4 vars).');
        }
        return admin.storage().bucket(storageBucket);
    }
    catch (error) {
        lastInitError = String(error?.message || error);
        exports.firebaseDiagnostics.lastInitError = lastInitError;
        console.error('❌ Error crítico al inicializar Firebase Admin:', lastInitError);
        return null; // Retornamos null para que la app no crashee al arrancar
    }
}
// Exportamos el bucket. Si es null, los controllers deben manejar la situación con gracia.
exports.bucket = initializeFirebase();
exports.firebaseAdmin = admin;
// Mantenemos admin como exportación predeterminada para compatibilidad con auth.controller.ts
exports.default = admin;
