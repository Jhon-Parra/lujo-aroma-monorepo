"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Cargar .env manualmente para asegurar visibilidad en el script
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
async function runDiagnostic() {
    console.log('---------------------------------------------------------');
    console.log('🔍 SISTEMA DE DIAGNÓSTICO DE BASE DE DATOS (NODE.JS)');
    console.log('---------------------------------------------------------');
    // 1. Mostrar Variables de Entorno Detectadas (Sin mostrar password completo)
    const dbUser = process.env.DB_USER || process.env.MYSQL_USER;
    const dbHost = process.env.DB_HOST || process.env.MYSQL_HOST;
    const dbName = process.env.DB_NAME || process.env.MYSQL_DATABASE;
    const dbPort = process.env.DB_PORT || process.env.MYSQL_PORT || '3306';
    const dbPass = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
    console.log('📡 Entorno Detectado:');
    console.log(`   - HOST: ${dbHost}`);
    console.log(`   - USER: ${dbUser}`);
    console.log(`   - DATABASE: ${dbName}`);
    console.log(`   - PORT: ${dbPort}`);
    console.log(`   - PASSWORD: ${dbPass ? '******** (Configurado)' : '❌ NO CONFIGURADO'}`);
    console.log('---------------------------------------------------------');
    // 2. Intentar Conexión
    console.log('🚀 Intentando establecer conexión con el Pool...');
    try {
        const start = Date.now();
        const connection = await database_1.mysqlPool.getConnection();
        const duration = Date.now() - start;
        console.log(`✅ ¡ÉXITO! Conexión establecida en ${duration}ms.`);
        // 3. Prueba de Query Básica
        console.log('📝 Ejecutando consulta de prueba (SELECT 1)...');
        await connection.query('SELECT 1');
        console.log('✅ Consulta ejecutada correctamente.');
        // 4. Obtener información del servidor
        const [serverInfo] = await connection.query('SELECT DATABASE() as db, VERSION() as version, USER() as user');
        console.log('📊 Información del Servidor:');
        console.log(`   - DB Actual: ${serverInfo[0].db}`);
        console.log(`   - Versión: ${serverInfo[0].version}`);
        console.log(`   - Usuario Detectado: ${serverInfo[0].user}`);
        console.log('---------------------------------------------------------');
        // 5. RESUMEN DE DATOS (CONSULTAS)
        console.log('📦 Obteniendo Resumen de Datos...');
        const tables = [
            { name: 'productos', alias: 'Productos' },
            { name: 'usuarios', alias: 'Usuarios' },
            { name: 'ordenes', alias: 'Pedidos' },
            { name: 'categorias', alias: 'Categorías' },
            { name: 'configuracionglobal', alias: 'Configuración' }
        ];
        for (const table of tables) {
            try {
                const [countResult] = await connection.query(`SELECT COUNT(*) as total FROM ${table.name}`);
                console.log(`   ✅ ${table.alias.padEnd(12)}: ${countResult[0].total} registros encontrados.`);
            }
            catch (err) {
                console.warn(`   ⚠️ ${table.alias.padEnd(12)}: Error al consultar (${err.code}).`);
            }
        }
        // 6. Muestra de Productos (Últimos 3)
        console.log('\n✨ Últimos 3 Productos añadidos:');
        try {
            const [products] = await connection.query('SELECT nombre, precio, stock FROM productos ORDER BY creado_en DESC LIMIT 3');
            if (products.length > 0) {
                products.forEach((p, i) => {
                    console.log(`   ${i + 1}. ${p.nombre} - $${p.precio} (Stock: ${p.stock})`);
                });
            }
            else {
                console.log('   (No hay productos en la tabla)');
            }
        }
        catch (err) {
            console.warn('   ⚠️ No se pudieron obtener los productos.');
        }
        connection.release();
    }
    catch (err) {
        console.error('❌ FALLO EN LA CONEXIÓN:');
        console.error(`   - Código: ${err.code}`);
        console.error(`   - Mensaje: ${err.message}`);
        console.error(`   - Número Error: ${err.errno}`);
        console.log('\n🛠️  POSIBLES SOLUCIONES:');
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('   👉 El usuario o la contraseña son incorrectos.');
            console.log('   👉 En Hostinger, asegúrate de que el usuario tenga el prefijo u123456789_.');
            console.log('   👉 Verifica que el usuario tenga permisos asignados a la base de datos en el hPanel.');
        }
        else if (err.code === 'ENOTFOUND') {
            console.log('   👉 El Host no se encuentra. Prueba usando "localhost" o "127.0.0.1".');
        }
        else if (err.code === 'ECONNREFUSED') {
            console.log(`   👉 Conexión rechazada en el puerto ${dbPort}. Verifica que MySQL esté corriendo.`);
        }
        else if (err.code === 'ETIMEDOUT') {
            console.log('   👉 La conexión tardó demasiado. Podría ser un firewall o un host incorrecto.');
        }
        else {
            console.log('   👉 Revisa la configuración de red y las credenciales en tu archivo .env.');
        }
    }
    finally {
        await database_1.mysqlPool.end();
        console.log('---------------------------------------------------------');
        console.log('🏁 Diagnóstico Finalizado.');
        process.exit();
    }
}
runDiagnostic();
