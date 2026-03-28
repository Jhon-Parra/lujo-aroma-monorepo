import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config();

// En desarrollo y para este scaffold, si no hay credenciales completas de Firebase,
// la app de igual modo inicializará sin romperse, pero fallarán las subidas a menos que
// se configure correctamente las credenciales en .env
try {
    // Option 1: Using service account JSON string from env
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'lujo_aroma-app.appspot.com'
        });
        console.log('✅ Firebase Admin inicializado correctamente.');
    } else {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_JSON no encontrado en .env. Firebase se inicializa vacío.');
        admin.initializeApp({
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'lujo_aroma-app.appspot.com'
        });
    }
} catch (error) {
    console.error('❌ Error al inicializar Firebase Admin:', error);
}

export const bucket = admin.storage().bucket();
export default admin;
