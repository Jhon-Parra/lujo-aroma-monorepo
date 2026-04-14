"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../config/firebase");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Cargar variables de entorno
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
async function testFirebaseConnection() {
    console.log('🚀 Iniciando prueba de fuego de Firebase Storage...');
    try {
        const myBucket = firebase_1.bucket;
        if (!myBucket) {
            throw new Error('❌ El bucket no está inicializado. Revisa tus variables de entorno.');
        }
        console.log(`📡 Conectado al bucket: ${myBucket.name}`);
        // 1. Intentar listar archivos (Prueba de lectura)
        console.log('🔍 Intentando listar archivos...');
        const [files] = await myBucket.getFiles({ maxResults: 5 });
        console.log(`✅ Lectura exitosa. Se encontraron ${files.length} archivos.`);
        // 2. Intentar subir un archivo pequeño (Prueba de escritura)
        console.log('📤 Intentando subir archivo de prueba...');
        const fileName = `test/connection-test-${Date.now()}.txt`;
        const file = myBucket.file(fileName);
        const content = 'Prueba de conexión exitosa - Lujo y Aroma';
        await file.save(content, {
            contentType: 'text/plain',
            resumable: false,
            metadata: {
                cacheControl: 'public, max-age=31536000',
            }
        });
        console.log(`✅ Escritura exitosa: ${fileName}`);
        // 3. Intentar borrarlo (Prueba de limpieza)
        console.log('🗑️ Intentando borrar archivo de prueba...');
        await file.delete();
        console.log('✅ Borrado exitoso.');
        console.log('\n✨¡FELICIDADES! Firebase Storage está 100% operativo (Lectura/Escritura)✨');
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ ERROR CRÍTICO EN LA PRUEBA:');
        console.error(error.message);
        if (error.code)
            console.error(`Código de error: ${error.code}`);
        process.exit(1);
    }
}
testFirebaseConnection();
