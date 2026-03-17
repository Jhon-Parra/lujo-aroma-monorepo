import { sendEmail } from '../services/email.service';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno antes de importar la base de datos o el email service
dotenv.config({ path: path.join(__dirname, '../../.env') });

const testEmailTarget = 'jhon.parra@usantoto.edu.co';

async function runTest() {
    console.log(`🚀 Iniciando prueba de envío de correo a: ${testEmailTarget}...`);

    try {
        const result = await sendEmail({
            to: testEmailTarget,
            subject: 'Prueba de integracion de correo - Perfumissimo',
            text: `Prueba de integracion de correo exitosa.
El sistema SMTP esta configurado correctamente.

Saludos,
El equipo de desarrollo.`
        });

        if (result.skipped) {
            console.error('❌ No se pudo enviar el correo de prueba. SMTP no configurado en el panel o .env');
            process.exit(1);
        }

        if (!result.success) {
            console.error('❌ No se pudo enviar el correo de prueba.', result.error || 'Sin detalle');
            process.exit(1);
        }

        console.log(`✅ Prueba enviada exitosamente. Por favor, revisa la bandeja de entrada de ${testEmailTarget} (y la carpeta de SPAM por si acaso).`);
        process.exit(0);
    } catch (error) {
        console.error('💥 Error inesperado en el script de prueba:', error);
        process.exit(1);
    }
}

runTest();
