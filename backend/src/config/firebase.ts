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

/**
 * Inicialización Robusta de Firebase Admin
 * Prioriza variables individuales para mayor compatibilidad con Hostinger y otros hostings.
 */
function initializeFirebase() {
    try {
        const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

        // Evitar re-inicialización
        if (admin.apps.length > 0) {
            return storageBucket ? admin.storage().bucket(storageBucket) : admin.storage().bucket();
        }

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;

        const unquote = (v: string) => {
            const s = String(v ?? '').trim();
            if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
                return s.slice(1, -1);
            }
            return s;
        };

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
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (serviceAccountJson) {
            try {
                const serviceAccount = JSON.parse(serviceAccountJson);
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
                console.error('❌ Error parseando FIREBASE_SERVICE_ACCOUNT_JSON:', jsonErr);
            }
        }

        console.warn('⚠️ No se pudo inicializar Firebase Storage: Faltan credenciales válidas en el entorno.');
        return null;
    } catch (error: any) {
        console.error('❌ Error crítico al inicializar Firebase Admin:', error.message);
        return null; // Retornamos null para que la app no crashee al arrancar
    }
}

// Exportamos el bucket. Si es null, los controllers deben manejar la situación con gracia.
export const bucket = initializeFirebase();
export const firebaseAdmin = admin;
// Mantenemos admin como exportación predeterminada para compatibilidad con auth.controller.ts
export default admin;
