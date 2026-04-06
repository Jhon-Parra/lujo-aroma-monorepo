import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde ubicaciones comunes.
// En producción `process.cwd()` puede ser distinto a `backend/`.
const envCandidates = [
    // backend/.env (funciona tanto desde src/ como dist/)
    path.resolve(__dirname, '../../.env'),
    // fallback por si el proceso arranca dentro de backend/
    path.resolve(process.cwd(), '.env'),
    // fallback cuando el proceso arranca en el root del repo
    path.resolve(process.cwd(), 'backend/.env')
];

let loadedEnvFrom: string | null = null;
for (const p of envCandidates) {
    const r = dotenv.config({ path: p });
    if (!r.error) {
        loadedEnvFrom = p;
        break;
    }
}

if (loadedEnvFrom) {
    console.log(`ℹ️ .env cargado desde: ${loadedEnvFrom}`);
} else {
    console.log('ℹ️ No se encontró .env (se usarán variables de entorno del hosting si existen).');
}

const unquote = (v: string) => {
    const s = String(v ?? '').trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
    }
    return s;
};

const normalizeBucketName = (raw: string | undefined): string | undefined => {
    const v = String(raw ?? '').trim();
    if (!v) return undefined;
    // gs://bucket-name
    if (v.startsWith('gs://')) return v.slice('gs://'.length);
    // If someone pastes the Firebase REST endpoint, try to extract bucket name.
    // Example: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/...
    const m = v.match(/\/v0\/b\/([^/]+)\//i);
    if (m?.[1]) return m[1];
    return v;
};

let lastInitError: string | null = null;

export const firebaseDiagnostics: {
    loadedEnvFrom: string | null;
    env: {
        FIREBASE_PROJECT_ID: boolean;
        FIREBASE_CLIENT_EMAIL: boolean;
        FIREBASE_PRIVATE_KEY: boolean;
        FIREBASE_STORAGE_BUCKET: boolean;
    };
    lastInitError: string | null;
} = {
    loadedEnvFrom,
    // keep this safe: booleans and sanitized values only
    env: {
        FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
        FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
        FIREBASE_STORAGE_BUCKET: !!process.env.FIREBASE_STORAGE_BUCKET,
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
        // Transformación exacta solicitada por el usuario
        const privateKey = String(privateKeyRaw ?? '')
            .trim()
            .replace(/^"|"$/g, '')
            .replace(/\\n/g, '\n');

        const debug = process.env.FIREBASE_DEBUG === 'true';

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
            firebaseDiagnostics.lastInitError = lastInitError;
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
    } catch (error: any) {
        lastInitError = String(error?.message || error);
        firebaseDiagnostics.lastInitError = lastInitError;
        console.error('❌ Error crítico al inicializar Firebase Admin:', lastInitError);
        return null; // Retornamos null para que la app no crashee al arrancar
    }
}

// Exportamos el bucket. Si es null, los controllers deben manejar la situación con gracia.
export const bucket = initializeFirebase();
export const firebaseAdmin = admin;
// Mantenemos admin como exportación predeterminada para compatibilidad con auth.controller.ts
export default admin;
