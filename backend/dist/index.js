"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const recommendation_routes_1 = __importDefault(require("./routes/recommendation.routes"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const promotion_routes_1 = __importDefault(require("./routes/promotion.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const favorite_routes_1 = __importDefault(require("./routes/favorite.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const social_routes_1 = __importDefault(require("./routes/social.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const permissions_routes_1 = __importDefault(require("./routes/permissions.routes"));
const category_routes_1 = __importDefault(require("./routes/category.routes"));
const email_templates_routes_1 = __importDefault(require("./routes/email-templates.routes"));
const intelligence_routes_1 = __importDefault(require("./routes/intelligence.routes"));
const seo_routes_1 = __importDefault(require("./routes/seo.routes"));
const database_1 = require("./config/database");
const security_middleware_1 = require("./middleware/security.middleware");
const error_middleware_1 = require("./middleware/error.middleware");
const path_1 = __importDefault(require("path"));
const order_model_1 = require("./models/order.model");
// Cargar siempre el .env del backend, independiente del working directory.
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 UNHANDLED REJECTION:', reason);
});
const app = (0, express_1.default)();
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
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            "default-src": ["'none'"],
            "img-src": ["'self'", 'data:', 'https:'],
            "media-src": ["'self'", 'https:'],
            "connect-src": ["'self'"],
            "script-src": ["'self'"],
            "style-src": ["'self'"],
            "base-uri": ["'none'"],
            "form-action": ["'self'"],
            "frame-ancestors": ["'none'"]
        }
    },
    referrerPolicy: { policy: 'no-referrer' }
}));
app.use((0, morgan_1.default)('combined'));
app.use((0, cookie_parser_1.default)());
const defaultAllowedOrigins = [
    'http://localhost:4200',
    'http://127.0.0.1:4200'
];
const normalizeAllowedOrigin = (raw) => {
    const value = String(raw || '').trim();
    if (!value)
        return '';
    // Si viene como URL completa (con path), reducir a origin.
    if (/^https?:\/\//i.test(value)) {
        try {
            const u = new URL(value);
            return u.origin;
        }
        catch {
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
app.use((0, cors_1.default)({
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
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Servir uploads desde backend/uploads tanto en dev (ts-node) como en prod (dist)
app.use('/uploads', express_1.default.static(path_1.default.resolve(__dirname, '..', 'uploads')));
app.use('/api', security_middleware_1.generalLimiter);
if (!disableAuthLimiter) {
    app.use('/api/auth/login', security_middleware_1.authLimiter);
}
app.use('/api/auth/register', security_middleware_1.authLimiter);
app.use('/api/auth/google', security_middleware_1.authLimiter);
app.use('/api/auth/refresh', security_middleware_1.refreshLimiter);
app.use('/api/auth/logout', security_middleware_1.logoutLimiter);
app.use('/api/orders/checkout', security_middleware_1.createOrderLimiter);
app.use('/api/ai/generate-description', security_middleware_1.aiLimiter);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/products', product_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
app.use('/api/recommendations', recommendation_routes_1.default);
app.use('/api/promotions', promotion_routes_1.default);
app.use('/api/orders', order_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
app.use('/api/favorites', favorite_routes_1.default);
app.use('/api/reviews', review_routes_1.default);
app.use('/api/social', social_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/payments', payment_routes_1.default);
app.use('/api/permissions', permissions_routes_1.default);
app.use('/api/categories', category_routes_1.default);
app.use('/api/email-templates', email_templates_routes_1.default);
app.use('/api/intelligence', intelligence_routes_1.default);
app.use('/api/seo', seo_routes_1.default);
app.get('/health', async (req, res) => {
    const base = { status: 'OK', message: 'Perfumes Bogotá API is running' };
    // En produccion no exponemos detalles internos.
    if (process.env.NODE_ENV === 'production') {
        res.status(200).json(base);
        return;
    }
    try {
        const [rows] = await database_1.pool.query('SELECT DATABASE() AS db, CURRENT_USER() AS currentUser, @@hostname AS db_host, @@port AS db_port, @@socket AS db_socket, VERSION() AS db_version');
        const info = rows?.[0] || null;
        res.status(200).json({
            ...base,
            db: info?.db || null,
            db_user: info?.currentUser || null,
            db_host: info?.db_host || null,
            db_port: info?.db_port ?? null,
            db_socket: info?.db_socket || null,
            db_version: info?.db_version || null
        });
    }
    catch (e) {
        res.status(200).json({
            ...base,
            db: null,
            db_error: e?.code || e?.message || 'DB_ERROR'
        });
    }
});
app.get('/health/db', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        res.status(404).json({ ok: false, error: 'Not Found' });
        return;
    }
    try {
        const [rows] = await database_1.pool.query('SELECT DATABASE() AS db, CURRENT_USER() AS currentUser, @@hostname AS db_host, @@port AS db_port, @@socket AS db_socket, VERSION() AS db_version');
        const info = rows?.[0] || null;
        res.status(200).json({
            ok: true,
            db: info?.db || null,
            db_user: info?.currentUser || null,
            db_host: info?.db_host || null,
            db_port: info?.db_port ?? null,
            db_socket: info?.db_socket || null,
            db_version: info?.db_version || null
        });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.code || e?.message || 'DB_ERROR' });
    }
});
app.use(error_middleware_1.notFoundHandler);
app.use(error_middleware_1.errorHandler);
app.listen(Number(PORT), HOST, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
    // Tarea de mantenimiento: cancelar pedidos expirados (24h) cada hora
    const ONE_HOUR = 60 * 60 * 1000;
    setInterval(async () => {
        try {
            console.log('🕒 Iniciando limpieza de pedidos expirados...');
            const count = await order_model_1.OrderModel.cancelExpiredOrders();
            if (count > 0) {
                console.log(`✅ Se cancelaron ${count} pedidos expirados.`);
            }
        }
        catch (err) {
            console.error('❌ Error en el job de limpieza de pedidos:', err);
        }
    }, ONE_HOUR);
    // Primera ejecución al arrancar (opcional, para limpiar remanentes)
    setTimeout(() => {
        order_model_1.OrderModel.cancelExpiredOrders().catch(e => console.error('Error inicial en limpieza:', e));
    }, 5000);
});
