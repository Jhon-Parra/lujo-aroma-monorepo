import dotenv from 'dotenv';
import path from 'path';

console.log('--- ENTORNO: DIAGNÓSTICO DE CARGA DE VARIABLES ---');
console.log('Directorio actual (CWD):', process.cwd());
console.log('__dirname:', __dirname);

const envPath = path.resolve(process.cwd(), '.env');
console.log('Buscando .env en:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('❌ Error al cargar .env:', result.error.message);
} else {
    console.log('✅ Archivo .env cargado correctamente.');
}

const varsToCheck = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'DB_HOST',
    'DB_USER',
    'FRONTEND_URL',
    'GOOGLE_CLIENT_ID',
    // Firebase (Storage)
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_STORAGE_BUCKET',
    // NOTE: backend no usa FIREBASE_SERVICE_ACCOUNT_JSON (solo 4 vars granulares)
];

console.log('\n--- ESTADO DE VARIABLES CLAVE ---');
varsToCheck.forEach(v => {
    const val = process.env[v];
    if (!val) {
        console.log(`${v}: 🔴 MISSING`);
    } else {
        const masked = val.length > 8 
            ? `${val.substring(0, 4)}...${val.substring(val.length - 4)}`
            : '****';
        console.log(`${v}: 🟢 LOADED (${masked})`);
    }
});

console.log('\n--- FIN DEL DIAGNÓSTICO ---');
