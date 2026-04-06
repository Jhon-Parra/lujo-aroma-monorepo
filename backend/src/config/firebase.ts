import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno del archivo .env si existe.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Inicialización Robusta de Firebase Admin
 * Prioriza variables individuales para mayor compatibilidad con Hostinger y otros hostings.
 */
function initializeFirebase() {
    try {
        // Evitar re-inicialización
        if (admin.apps.length > 0) {
            return admin.storage().bucket();
        }

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;
        const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

        // Logging de diagnóstico seguro (no muestra secretos)
        console.log('--- [Firebase Admin Diagnostics] ---');
        console.log('Project ID:', projectId ? '✅ OK' : '❌ Miss');
        console.log('Client Email:', clientEmail ? '✅ OK' : '❌ Miss');
        console.log('Private Key:', privateKey ? '✅ OK' : '❌ Miss');
        console.log('Bucket Name:', storageBucket ? '✅ OK' : '❌ Miss');

        // 1. Intentar inicializar con variables granulares (RECOMENDADO)
        if (projectId && clientEmail && privateKey) {
            const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey: formattedPrivateKey,
                }),
                storageBucket: storageBucket || undefined
            });
            console.log('✅ Firebase Admin inicializado exitosamente con variables granulares.');
            return admin.storage().bucket();
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
                return admin.storage().bucket();
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
export default bucket;
