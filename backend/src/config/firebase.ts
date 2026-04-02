import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Cargar siempre el .env del backend, independiente del working directory.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// En desarrollo y para este scaffold, si no hay credenciales completas de Firebase,
// la app de igual modo inicializará sin romperse, pero fallarán las subidas a menos que
// se configure correctamente las credenciales en .env
try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'lujoyaroma-c1d28.firebasestorage.app';

    if (serviceAccountJson) {
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(serviceAccountJson);
        } catch (e) {
            // Reintentar limpiando posibles saltos de línea mal escapados si viene de shell
            serviceAccount = JSON.parse(serviceAccountJson.replace(/\n/g, '\\n'));
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: storageBucket
        });
        console.log('✅ Firebase Admin inicializado correctamente con Service Account.');
    } else {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_JSON no encontrado en .env. Usando credenciales por defecto (si existen).');
        admin.initializeApp({
            storageBucket: storageBucket
        });
    }
} catch (error) {
    console.error('❌ Error al inicializar Firebase Admin:', error);
}

export const bucket = admin.storage().bucket();
export default admin;
