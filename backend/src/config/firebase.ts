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

const normalizeBucketName = (projectId: string, rawBucket: string | undefined): string | undefined => {
    const v = String(rawBucket ?? '').trim();
    if (!v) {
        // Fallback estándar si falta el bucket: <project-id>.appspot.com o <project-id>.firebasestorage.app
        return projectId ? `${projectId}.firebasestorage.app` : undefined;
    }
    // gs://bucket-name
    if (v.startsWith('gs://')) return v.slice('gs://'.length);
    // If someone pastes the Firebase REST endpoint, try to extract bucket name.
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
    storageStatus: 'CONFIGURED' | 'NOT_CONFIGURED';
} = {
    loadedEnvFrom,
    // keep this safe: booleans and sanitized values only
    env: {
        FIREBASE_PROJECT_ID: !!String(process.env.FIREBASE_PROJECT_ID ?? '').trim(),
        FIREBASE_CLIENT_EMAIL: !!String(process.env.FIREBASE_CLIENT_EMAIL ?? '').trim(),
        FIREBASE_PRIVATE_KEY: !!String(process.env.FIREBASE_PRIVATE_KEY ?? '').trim(),
        FIREBASE_STORAGE_BUCKET: !!String(process.env.FIREBASE_STORAGE_BUCKET ?? '').trim(),
    },
    lastInitError,
    storageStatus: 'NOT_CONFIGURED'
};

/**
 * Inicialización Robusta de Firebase Admin
 * Prioriza variables individuales para mayor compatibilidad con Hostinger y otros hostings.
 */
function initializeFirebase() {
    try {
        if (admin.apps.length > 0) {
            const storageBucket = normalizeBucketName(process.env.FIREBASE_PROJECT_ID || '', process.env.FIREBASE_STORAGE_BUCKET);
            return storageBucket ? admin.storage().bucket(storageBucket) : admin.storage().bucket();
        }

        // VÍA 1: JSON completo (La más segura)
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (serviceAccountJson) {
            try {
                const serviceAccount = JSON.parse(serviceAccountJson);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    storageBucket: normalizeBucketName(serviceAccount.project_id, process.env.FIREBASE_STORAGE_BUCKET)
                });
                firebaseDiagnostics.storageStatus = 'CONFIGURED';
                console.log('Firebase initialized via SERVICE_ACCOUNT_JSON');
                return admin.storage().bucket();
            } catch (jsonErr: any) {
                console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:', jsonErr.message);
                // Si falla el JSON, intentamos las variables granulares
            }
        }

        // VÍA 2: Variables granulares
        const projectIdRaw = process.env.FIREBASE_PROJECT_ID;
        const clientEmailRaw = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
        const storageBucketRaw = process.env.FIREBASE_STORAGE_BUCKET;
        const storageBucket = normalizeBucketName(projectIdRaw || '', storageBucketRaw);

        const projectId = String(projectIdRaw ?? '').trim();
        const clientEmail = String(clientEmailRaw ?? '').trim();
        
        // Súper Formateador PEM Anti-Balas
        const pkRaw = String(privateKeyRaw ?? '').replace(/\\n/g, '\n').replace(/\r/g, '');
        const pkBase64 = pkRaw
            .replace(/-----BEGIN[^-]*-----/, '')
            .replace(/-----END[^-]*-----/, '')
            .replace(/[^A-Za-z0-9+/=]/g, '')
            .trim();
        
        if (!pkBase64) throw new Error('Private key base64 content is empty');

        const privateKey = `-----BEGIN PRIVATE KEY-----\n${pkBase64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----\n`;

        const debugRaw = String(process.env.FIREBASE_DEBUG || '').trim().toLowerCase();
        const debug = debugRaw === 'true' || debugRaw === '1';

        console.log('--- [Firebase Admin Env Check] ---');
        console.log('Method: Granular Variables');
        console.log('FIREBASE_PROJECT_ID:', projectId ? `✅ (${projectId})` : '❌ MISSING');
        console.log('FIREBASE_CLIENT_EMAIL:', clientEmail ? `✅` : '❌ MISSING');
        console.log('PRIVATE_KEY_B64_INTEGRITY:', pkBase64.length % 4 === 0 ? '✅ OK' : '⚠️ WARNING (Not multiple of 4)');
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
