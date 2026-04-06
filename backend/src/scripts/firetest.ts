import { bucket, firebaseDiagnostics } from '../config/firebase';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testFirebaseConnection() {
    console.log('🚀 Iniciando prueba de fuego de Firebase Storage...');
    
    try {
        const myBucket = bucket;
        
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
    } catch (error: any) {
        console.error('\n❌ ERROR CRÍTICO EN LA PRUEBA:');
        console.error(error.message);
        if (error.code) console.error(`Código de error: ${error.code}`);
        process.exit(1);
    }
}

testFirebaseConnection();
