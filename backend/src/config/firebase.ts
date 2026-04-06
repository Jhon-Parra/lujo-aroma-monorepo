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
        FIREBASE_SERVICE_ACCOUNT_JSON: boolean;
        FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: boolean;
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
        FIREBASE_SERVICE_ACCOUNT_JSON: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
        FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64,
    },
    lastInitError
};

/**
 * Inicialización Robusta de Firebase Admin
 * Prioriza variables individuales para mayor compatibilidad con Hostinger y otros hostings.
 */
function initializeFirebase() {
    try {
        const storageBucket = normalizeBucketName(process.env.FIREBASE_STORAGE_BUCKET);

        // Evitar re-inicialización
        if (admin.apps.length > 0) {
            return storageBucket ? admin.storage().bucket(storageBucket) : admin.storage().bucket();
        }

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;

        // Logging de diagnóstico seguro (no muestra secretos)
        console.log('--- [Firebase Admin Diagnostics] ---');
        console.log('Project ID:', projectId ? '✅ OK' : '❌ Miss');
        console.log('Client Email:', clientEmail ? '✅ OK' : '❌ Miss');
        console.log('Private Key:', privateKey ? '✅ OK' : '❌ Miss');
        console.log('Bucket Name:', storageBucket ? '✅ OK' : '❌ Miss');

        // 1. Intentar inicializar con variables granulares (RECOMENDADO)
        if (projectId && clientEmail && privateKey) {
            const formattedPrivateKey = unquote(privateKey).replace(/\\n/g, '\n');
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: String(projectId).trim(),
                    clientEmail: String(clientEmail).trim(),
                    privateKey: formattedPrivateKey,
                }),
                storageBucket: storageBucket || undefined
            });
            console.log('✅ Firebase Admin inicializado exitosamente con variables granulares.');
            return storageBucket ? admin.storage().bucket(storageBucket) : admin.storage().bucket();
        }

        // 2. Fallback: Intentar con JSON completo (Legacy)
        // Soporte adicional: JSON en base64 (algunos hostings/panels lo requieren)
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        const serviceAccountJsonB64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;

        const resolveServiceAccountJson = (): string | undefined => {
            const raw = String(serviceAccountJson ?? '').trim();
            if (raw) return raw;
            const b64 = String(serviceAccountJsonB64 ?? '').trim();
            if (!b64) return undefined;
            try {
                return Buffer.from(b64, 'base64').toString('utf8').trim();
            } catch (e: any) {
                lastInitError = `Error decodificando FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: ${String(e?.message || e)}`;
                firebaseDiagnostics.lastInitError = lastInitError;
                return undefined;
            }
        };

        const saJson = resolveServiceAccountJson();
        if (saJson) {
            try {
                const serviceAccount = JSON.parse(saJson);
                // Si la private_key viene con escapes literales, los corregimos
                if (serviceAccount.private_key) {
                    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
                }
                
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    storageBucket: storageBucket || undefined
                });
                console.log('✅ Firebase Admin inicializado exitosamente con JSON de cuenta de servicio.');
                return storageBucket ? admin.storage().bucket(storageBucket) : admin.storage().bucket();
            } catch (jsonErr) {
                lastInitError = `Error parseando FIREBASE_SERVICE_ACCOUNT_JSON: ${String((jsonErr as any)?.message || jsonErr)}`;
                firebaseDiagnostics.lastInitError = lastInitError;
                console.error('❌ Error parseando FIREBASE_SERVICE_ACCOUNT_JSON:', jsonErr);
            }
        }

        console.warn('⚠️ No se pudo inicializar Firebase Storage: Faltan credenciales válidas en el entorno.');
        return null;
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
