import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Cargar .env desde el working directory (backend/) si existe.
// En producción (Hostinger) normalmente se setean variables en el panel y esto no es necesario,
// pero no estorba.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// En desarrollo y para este scaffold, si no hay credenciales completas de Firebase,
// la app de igual modo inicializará sin romperse, pero fallarán las subidas a menos que
// se configure correctamente las credenciales en .env
let isInitialized = false;

type ServiceAccount = {
    project_id?: string;
    private_key?: string;
    client_email?: string;
    [k: string]: any;
};

const loadServiceAccountFromEnv = (): ServiceAccount | null => {
    const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    const rawB64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || '').trim();

    let raw = rawJson;
    if (!raw && rawB64) {
        try {
            raw = Buffer.from(rawB64, 'base64').toString('utf8').trim();
        } catch {
            raw = '';
        }
    }

    if (!raw) return null;

    // Algunos hostings guardan el JSON entre comillas simples o dobles.
    const unwrapped = raw.replace(/^['"]|['"]$/g, '').trim();

    let parsed: ServiceAccount;
    try {
        parsed = JSON.parse(unwrapped);
    } catch (e) {
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
    const storageBucket = String(
        process.env.FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.appspot.com` : '')
    ).trim();

    if (!admin.apps.length) {
        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount as any),
                storageBucket: storageBucket || undefined
            });
            console.log('✅ Firebase Admin inicializado con Service Account.');
            isInitialized = true;
        } else {
            // Sin service account, en servidores fuera de GCP normalmente no funcionará.
            admin.initializeApp({
                storageBucket: storageBucket || undefined
            });
            console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_JSON no configurado o inválido. Firebase Storage fallará en este entorno si se requiere autenticación.');
            // No marcamos como fully initialized si no hay serviceAccount en un VPS externo
            isInitialized = !!process.env.GOOGLE_APPLICATION_CREDENTIALS; 
        }
    } else {
        isInitialized = true;
    }

    if (isInitialized && storageBucket) {
        console.log('✅ Firebase Storage bucket listo:', storageBucket);
    } else if (!storageBucket) {
        console.error('❌ Error: FIREBASE_STORAGE_BUCKET no configurado. Las subidas fallarán.');
        isInitialized = false;
    }
} catch (error: any) {
    console.error('❌ Error crítico al inicializar Firebase Admin:', error?.message || error);
    isInitialized = false;
}


// Exportar el bucket de forma segura. Si no se inicializó, las llamadas a bucket fallarán 
// pero no detendrán el arranque del servidor.
export const bucket = isInitialized ? admin.storage().bucket() : null as any;
export const firebaseAdmin = admin;
export default admin;
