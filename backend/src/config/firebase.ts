import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Cargar siempre el .env del backend, independiente del working directory.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// En desarrollo y para este scaffold, si no hay credenciales completas de Firebase,
// la app de igual modo inicializará sin romperse, pero fallarán las subidas a menos que
// se configure correctamente las credenciales en .env
let isInitialized = false;

try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'lujoyaroma-c1d28.firebasestorage.app';

    if (serviceAccountJson) {
        let serviceAccount;
        try {
            // Limpiar posibles problemas de escape si viene de variables de entorno de shell/hosting
            const cleanJson = serviceAccountJson.trim().replace(/^'|'$/g, '');
            serviceAccount = JSON.parse(cleanJson);
        } catch (e) {
            // Segundo intento: Reemplazar \n literales si vienen de una cadena mal escapada
            serviceAccount = JSON.parse(serviceAccountJson.replace(/\\n/g, '\n').replace(/^'|'$/g, ''));
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: storageBucket
        });
        isInitialized = true;
        console.log('✅ Firebase Admin inicializado correctamente con Service Account.');
    } else {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_JSON no encontrado en .env. Intentando inicialización por defecto.');
        admin.initializeApp({
            storageBucket: storageBucket
        });
        isInitialized = true;
    }
} catch (error) {
    console.error('❌ Error crítico al inicializar Firebase Admin:', error);
}

// Exportar el bucket de forma segura. Si no se inicializó, las llamadas a bucket fallarán 
// pero no detendrán el arranque del servidor.
export const bucket = isInitialized ? admin.storage().bucket() : null as any;
export const firebaseAdmin = admin;
export default admin;
