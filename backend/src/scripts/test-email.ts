import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// ── Importar sendEmail DESPUÉS de cargar dotenv ─────────────────────────────
import { sendEmail } from '../services/email.service';

const TEST_RECIPIENT = 'jhonjairoparraparra39@gmail.com';

async function verifySmtp(): Promise<boolean> {
    const host  = String(process.env.SMTP_HOST || '').trim();
    const port  = Number(process.env.SMTP_PORT  || 587);
    const secure = process.env.SMTP_SECURE === 'true';
    const user  = String(process.env.SMTP_USER  || '').trim();
    const pass  = String(process.env.SMTP_PASS  || '').trim();

    console.log('\n📋 Configuración SMTP detectada:');
    console.log(`   Host   : ${host || '⚠️ VACÍO'}`);
    console.log(`   Puerto : ${port}`);
    console.log(`   Seguro : ${secure}`);
    console.log(`   Usuario: ${user || '⚠️ VACÍO'}`);
    console.log(`   Pass   : ${pass && pass !== 'TU_CONTRASEÑA_HOSTINGER_AQUI' ? `✅ configurado (${pass.length} chars)` : '❌ PLACEHOLDER / VACÍO'}`);

    if (!host || !user || !pass || pass === 'TU_CONTRASEÑA_HOSTINGER_AQUI') {
        console.error('\n❌ SMTP_PASS no está configurado. Por favor actualiza backend/.env con la contraseña real del correo tienda@perfumissimocol.com');
        return false;
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    try {
        await transporter.verify();
        console.log('\n✅ Conexión SMTP verificada correctamente.\n');
        return true;
    } catch (err: any) {
        console.error('\n❌ Fallo al conectar con el servidor SMTP:', err.message);
        return false;
    }
}

async function runTest() {
    console.log(`\n🚀 Prueba del sistema de correos automáticos Perfumissimo`);
    console.log(`   Destino: ${TEST_RECIPIENT}`);

    const smtpOk = await verifySmtp();
    if (!smtpOk) { process.exit(1); }

    try {
        const result = await sendEmail({
            to: TEST_RECIPIENT,
            subject: '✅ Prueba de correo automático — Perfumissimo',
            html: `
                <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
                    <h2 style="color:#c9a84c">Perfumissimo — Prueba de correo</h2>
                    <p>Este correo confirma que el sistema de <strong>notificaciones automáticas</strong> está funcionando correctamente.</p>
                    <p style="color:#666;font-size:13px">Si recibiste este mensaje, el SMTP de <code>tienda@perfumissimocol.com</code> está configurado y operativo.</p>
                    <hr style="border:none;border-top:1px solid #eee">
                    <p style="font-size:11px;color:#999">Perfumissimo · perfumissimocol.com</p>
                </div>
            `
        });

        if (result.skipped) {
            console.error('❌ Correo omitido. SMTP no configurado en BD ni en .env');
            process.exit(1);
        }
        if (!result.success) {
            console.error('❌ Error al enviar:', result.error || 'Sin detalle');
            process.exit(1);
        }
        console.log(`✅ Correo enviado exitosamente a ${TEST_RECIPIENT}`);
        console.log(`   MessageId: ${result.messageId}`);
        console.log(`   From: ${result.from}`);
        console.log('\n📬 Revisa la bandeja de entrada (y carpeta de SPAM).');
        process.exit(0);
    } catch (error) {
        console.error('💥 Error inesperado:', error);
        process.exit(1);
    }
}

runTest();
