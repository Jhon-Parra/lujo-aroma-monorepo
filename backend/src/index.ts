import dotenv from 'dotenv';
import path from 'path';

// Carga robusta de variables de entorno.
// En hosting es común que `process.cwd()` NO sea `backend/`.
// Usamos rutas relativas a este archivo (sirve en src/ y dist/), y dejamos `process.cwd()` como fallback.
const envCandidates = [
    path.resolve(__dirname, '../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend/.env')
];

for (const p of envCandidates) {
    const r = dotenv.config({ path: p });
    if (!r.error) break;
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';
import aiRoutes from './routes/ai.routes';
import recommendationRoutes from './routes/recommendation.routes';
import productRoutes from './routes/product.routes';
import promotionRoutes from './routes/promotion.routes';
import orderRoutes from './routes/order.routes';
import userRoutes from './routes/user.routes';
import settingsRoutes from './routes/settings.routes';
import favoriteRoutes from './routes/favorite.routes';
import reviewRoutes from './routes/review.routes';
import socialRoutes from './routes/social.routes';
import dashboardRoutes from './routes/dashboard.routes';
import paymentRoutes from './routes/payment.routes';
import permissionsRoutes from './routes/permissions.routes';
import categoryRoutes from './routes/category.routes';
import emailTemplatesRoutes from './routes/email-templates.routes';
import intelligenceRoutes from './routes/intelligence.routes';
import seoRoutes from './routes/seo.routes';
import { pool } from './config/database';
import { bucket as firebaseBucket, firebaseDiagnostics, firebaseAdmin } from './config/firebase';
import { 
    generalLimiter, 
    authLimiter, 
    refreshLimiter, 
    logoutLimiter, 
    aiLimiter, 
    createOrderLimiter 
} from './middleware/security.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { OrderModel } from './models/order.model';

process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 UNHANDLED REJECTION:', reason);
});

const app = express();

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}
const PORT = process.env.PORT || 3000;
// Nota: en macOS/Angular, el browser suele resolver localhost como ::1 (IPv6).
// Usar :: permite atender localhost en IPv6 y (cuando aplica) tambien IPv4.
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '::');
const disableAuthLimiter = process.env.DISABLE_AUTH_LIMIT === 'true';

// Permitir que el frontend (mismo site, distinto puerto en dev) pueda cargar recursos (imagenes/video)
// desde el backend sin bloqueo por Cross-Origin-Resource-Policy.
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            "default-src": ["'self'"],
            "img-src": ["'self'", 'data:', 'https:', 'https://*.googleusercontent.com'],
            "media-src": ["'self'", 'https:'],
            "connect-src": ["'self'", 'https://*.supabase.co', 'https://*.googleapis.com', 'https://accounts.google.com'],
            "script-src": ["'self'", "'unsafe-inline'", 'https://accounts.google.com', 'https://*.googleapis.com'],
            "style-src": ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            "font-src": ["'self'", 'https://fonts.gstatic.com'],
            "frame-src": ["'self'", 'https://accounts.google.com', 'https://*.supabase.co'],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
            "frame-ancestors": ["'self'"]
        }
    },
    referrerPolicy: { policy: 'no-referrer-when-downgrade' }
}));
app.use(compression());
app.use(morgan('combined'));
app.use(cookieParser());

const defaultAllowedOrigins = [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'https://perfumesbogota.com',
    'https://www.perfumesbogota.com'
];

const normalizeAllowedOrigin = (raw: string): string => {
    const value = String(raw || '').trim();
    if (!value) return '';

    // Si viene como URL completa (con path), reducir a origin.
    if (/^https?:\/\//i.test(value)) {
        try {
            const u = new URL(value);
            return u.origin;
        } catch {
            // fallback
        }
    }

    return value.replace(/\/+$/, '');
};

const allowedOrigins = (() => {
    const raw = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
    const fromEnv = raw
        .split(',')
        .map((s) => normalizeAllowedOrigin(s))
        .filter(Boolean);
    const merged = Array.from(new Set([...defaultAllowedOrigins.map(normalizeAllowedOrigin), ...fromEnv]));
    return merged;
})();

app.use(cors({
    origin: (origin, callback) => {
        // En desarrollo permitimos cualquier Origin para evitar bloqueos por IP/hostname.
        if (process.env.NODE_ENV !== 'production') {
            callback(null, true);
            return;
        }

        // Permitir requests sin Origin (curl/postman)
        if (!origin) {
            callback(null, true);
            return;
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS: Origin no permitido: ${origin}`));
    },
    credentials: true
}));

// Mitigacion CSRF para auth via cookies:
// En browser, requests cross-site llevan el header Origin.
// Si el Origin no esta en whitelist, bloqueamos metodos con efecto (POST/PUT/PATCH/DELETE).
app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        next();
        return;
    }

    // Webhooks de pasarelas de pago (server-to-server) normalmente NO envian Origin.
    // Estos endpoints no usan cookies/sesion, asi que no requieren mitigacion CSRF.
    const webhookPaths = new Set([
        '/api/payments/wompi/webhook'
    ]);
    if (webhookPaths.has(String(req.path || ''))) {
        next();
        return;
    }

    const method = String(req.method || '').toUpperCase();
    const isSafeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    if (isSafeMethod) {
        next();
        return;
    }

    const origin = String(req.headers.origin || '').trim();
    if (!origin) {
        // curl/postman/no-origin
        if (process.env.ALLOW_NO_ORIGIN === 'true') {
            next();
            return;
        }
        res.status(403).json({ error: 'Origin requerido' });
        return;
    }

    if (!allowedOrigins.includes(origin)) {
        res.status(403).json({ error: 'Origin no permitido' });
        return;
    }

    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir uploads desde backend/uploads tanto en dev (ts-node) como en prod (dist)
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

app.use('/api', generalLimiter);
if (!disableAuthLimiter) {
    app.use('/api/auth/login', authLimiter);
}
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/auth/refresh', refreshLimiter);
app.use('/api/auth/logout', logoutLimiter);
app.use('/api/orders/checkout', createOrderLimiter);
app.use('/api/ai/generate-description', aiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/email-templates', emailTemplatesRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/seo', seoRoutes);

app.get('/health', async (req, res) => {
    const base: any = { 
        status: 'OK', 
        message: 'Perfumes Bogotá API is running',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
    };

    try {
        // SELECT 1 para verificar conectividad
        const [rows] = await pool.query<any[]>('SELECT 1 as connected');
        
        // En produccion no exponemos detalles internos por defecto.
        if (process.env.NODE_ENV === 'production') {
            res.status(200).json({ ...base, db: 'CONNECTED' });
            return;
        }

        const [infoRows] = await pool.query<any[]>(
            'SELECT DATABASE() AS db, CURRENT_USER() AS currentUser, @@hostname AS db_host, @@port AS db_port, @@socket AS db_socket, VERSION() AS db_version'
        );
        const info = (infoRows as any[])?.[0] || null;
        res.status(200).json({
            ...base,
            db: 'CONNECTED',
            db_info: {
                db: info?.db || null,
                db_user: info?.currentUser || null,
                db_host: info?.db_host || null,
                db_port: info?.db_port ?? null,
                db_socket: info?.db_socket || null,
                db_version: info?.db_version || null
            }
        });
    } catch (e: any) {
        // IMPORTANTE: Incluso en produccion, exponemos el error de base de datos
        // para facilitar el diagnostico inicial (ER_ACCESS_DENIED_ERROR, etc.)
        res.status(200).json({
            ...base,
            db: 'DISCONNECTED',
            db_error_code: e?.code || 'UNKNOWN_CODE',
            db_error_message: e?.message || 'Database connection failed'
        });
    }
});

app.get('/health/db', async (req, res) => {
    // Redirigir a health general para evitar duplicidad, pero permitiendo ver el error tecnico siempre.
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ ok: true, connection: 'OK' });
    } catch (e: any) {
        res.status(500).json({ 
            ok: false, 
            error_code: e?.code, 
            error_message: e?.message 
        });
    }
});

app.get('/health/firebase', (req, res) => {
    // Flexibilidad con 'true' (espacios, mayúsculas, etc)
    const debugRaw = String(process.env.FIREBASE_DEBUG || '').trim().toLowerCase();
    const debug = debugRaw === 'true' || debugRaw === '1';

    // Diagnóstico de presencia (seguro para cualquier entorno)
    const envPresence = {
        FIREBASE_PROJECT_ID: !!String(process.env.FIREBASE_PROJECT_ID || '').trim(),
        FIREBASE_CLIENT_EMAIL: !!String(process.env.FIREBASE_CLIENT_EMAIL || '').trim(),
        FIREBASE_PRIVATE_KEY: !!String(process.env.FIREBASE_PRIVATE_KEY || '').trim(),
        FIREBASE_STORAGE_BUCKET: !!String(process.env.FIREBASE_STORAGE_BUCKET || '').trim(),
    };

    const base = {
        ok: !!firebaseBucket,
        storage: firebaseBucket ? 'CONFIGURED' : 'NOT_CONFIGURED',
        bucket: firebaseBucket?.name || null,
        apps: firebaseAdmin.apps.length,
        envPresence
    };

    if (!debug) {
        res.status(200).json(base);
        return;
    }

    const missing = Object.entries(firebaseDiagnostics.env)
        .filter(([, ok]) => !ok)
        .map(([k]) => k);

    const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
    const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
    const privateKeyRaw = String(process.env.FIREBASE_PRIVATE_KEY || '').trim();
    const storageBucketVar = String(process.env.FIREBASE_STORAGE_BUCKET || '').trim();
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    
    // Simular el mismo formateo que se usa en la inicialización
    const pkr = privateKeyRaw.replace(/\\n/g, '\n').replace(/\r/g, '');
    const pkb64 = pkr.replace(/-----BEGIN[^-]*-----/, '').replace(/-----END[^-]*-----/, '').replace(/[^A-Za-z0-9+/=]/g, '').trim();
    const pkFormatted = pkb64 ? `-----BEGIN PRIVATE KEY-----\n${pkb64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----\n` : '';

    res.status(200).json({
        ...base,
        envPresence: {
            ...base.envPresence,
            FIREBASE_SERVICE_ACCOUNT_JSON: !!serviceAccountJson,
            FIREBASE_STORAGE_BUCKET_VAR: !!storageBucketVar
        },
        diagnostics: {
            loadedEnvFrom: firebaseDiagnostics.loadedEnvFrom ? 'found' : 'not-found',
            missing,
            lastInitError: firebaseDiagnostics.lastInitError || null,
            envShape: {
                projectId: projectId ? `len=${projectId.length}` : 'MISSING',
                clientEmail: clientEmail ? `len=${clientEmail.length}` : 'MISSING',
                privateKey: privateKeyRaw 
                    ? `rawLen=${privateKeyRaw.length}, b64Len=${pkb64.length}, formattedLen=${pkFormatted.length}, integrity=${pkb64.length % 4 === 0}`
                    : 'MISSING',
                storageBucketVar: storageBucketVar || 'MISSING',
                actualBucketUsed: base.bucket || 'NOT_INITIALIZED'
            }
        }
    });
});

app.use(notFoundHandler);
// Verificación de esquema al arranque para detectar migraciones pendientes
const checkDatabaseSchema = async () => {
    try {
        await pool.query('SELECT firebase_user_id FROM usuarios LIMIT 1');
        console.log('✅ Esquema de base de datos validado (firebase_user_id presente).');
    } catch (error: any) {
        if (error.code === 'ER_BAD_FIELD_ERROR') {
            console.error('⚠️ ALERTA CRÍTICA DE MIGRACIÓN:');
            console.error('La columna "firebase_user_id" no existe en la tabla "usuarios".');
            console.error('Esto causará fallos en el sistema de autenticación (CORS/503).');
            console.error('Solución: Ejecutar script /backend/database/migrations/20260402_add_firebase_user_id.sql');
        } else {
            console.warn('⚠️ No se pudo verificar el esquema de la base de datos:', error.message);
        }
    }
};

app.listen(Number(PORT), HOST, async () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
    
    // Verificar base de datos al arrancar
    await checkDatabaseSchema();

    // Tarea de mantenimiento: cancelar pedidos expirados (24h) cada hora
    const ONE_HOUR = 60 * 60 * 1000;
    setInterval(async () => {
        try {
            console.log('🕒 Iniciando limpieza de pedidos expirados...');
            const count = await OrderModel.cancelExpiredOrders();
            if (count > 0) {
                console.log(`✅ Se cancelaron ${count} pedidos expirados.`);
            }
        } catch (err) {
            console.error('❌ Error en el job de limpieza de pedidos:', err);
        }
    }, ONE_HOUR);

    // Primera ejecución al arrancar (opcional, para limpiar remanentes)
    setTimeout(() => {
        OrderModel.cancelExpiredOrders().catch(e => console.error('Error inicial en limpieza:', e));
    }, 5000);
});
