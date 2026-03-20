
import { resolveSmtpConfig } from './src/services/email.service';
import 'dotenv/config';

async function test() {
  console.log('--- DIAGNÓSTICO DE CONFIGURACIÓN SMTP ---');
  console.log('ENV SMTP_HOST:', process.env.SMTP_HOST);
  console.log('ENV SMTP_USER:', process.env.SMTP_USER);

  try {
    const config = await resolveSmtpConfig();
    if (!config) {
      console.log('❌ RESULTADO: No se pudo resolver ninguna configuración SMTP.');
    } else {
      console.log('✅ RESULTADO: Configuración resuelta');
      console.log('   Origen:', config.source === 'db' ? 'BASE DE DATOS (Panel Admin)' : 'ARCHIVO .ENV');
      console.log('   Host:', config.host);
      console.log('   User:', config.user);
      console.log('   Secure:', config.secure);
      console.log('   Port:', config.port);
      
      if (config.source === 'db' && config.host.includes('gmail')) {
        console.log('\n⚠️ ALERTA: El sistema está usando GMAIL desde la base de datos, lo cual es INCORRECTO en producción.');
        console.log('   Debes aplicar el UPDATE SQL que te envié para cambiar a Hostinger.');
      }
    }
  } catch (err: any) {
    console.error('❌ ERROR CRÍTICO:', err?.message || err);
  }
}

test().then(() => process.exit(0)).catch(() => process.exit(1));
