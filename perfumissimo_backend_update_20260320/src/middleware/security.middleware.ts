import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.DISABLE_RATE_LIMIT === 'true' ? 999999 : 1000,
    message: { error: 'Demasiadas solicitudes, intenta más tarde' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.DISABLE_RATE_LIMIT === 'true'
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.DISABLE_RATE_LIMIT === 'true' ? 999999 : 20,
    message: { error: 'Demasiados intentos de login, intenta en 15 minutos' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.DISABLE_RATE_LIMIT === 'true'
});

export const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.DISABLE_RATE_LIMIT === 'true' ? 999999 : 200,
    message: { error: 'Demasiadas solicitudes de refresh, intenta más tarde' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.DISABLE_RATE_LIMIT === 'true'
});

export const logoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: { error: 'Demasiadas solicitudes de logout, intenta más tarde' },
    standardHeaders: 'draft-7',
    legacyHeaders: false
});

export const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    message: { error: 'Límite de uso de IA alcanzado' },
    standardHeaders: 'draft-7',
    legacyHeaders: false
});

export const createOrderLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    message: { error: 'Demasiadas órdenes, intenta más tarde' },
    standardHeaders: 'draft-7',
    legacyHeaders: false
});
