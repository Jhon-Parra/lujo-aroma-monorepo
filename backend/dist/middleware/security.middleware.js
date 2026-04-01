"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrderLimiter = exports.aiLimiter = exports.logoutLimiter = exports.refreshLimiter = exports.authLimiter = exports.generalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: process.env.DISABLE_RATE_LIMIT === 'true' ? 999999 : 1000,
    message: { error: 'Demasiadas solicitudes, intenta más tarde' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.DISABLE_RATE_LIMIT === 'true'
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: process.env.DISABLE_RATE_LIMIT === 'true' ? 999999 : 20,
    message: { error: 'Demasiados intentos de login, intenta en 15 minutos' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.DISABLE_RATE_LIMIT === 'true'
});
exports.refreshLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: process.env.DISABLE_RATE_LIMIT === 'true' ? 999999 : 200,
    message: { error: 'Demasiadas solicitudes de refresh, intenta más tarde' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.DISABLE_RATE_LIMIT === 'true'
});
exports.logoutLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: { error: 'Demasiadas solicitudes de logout, intenta más tarde' },
    standardHeaders: 'draft-7',
    legacyHeaders: false
});
exports.aiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    message: { error: 'Límite de uso de IA alcanzado' },
    standardHeaders: 'draft-7',
    legacyHeaders: false
});
exports.createOrderLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    limit: 10,
    message: { error: 'Demasiadas órdenes, intenta más tarde' },
    standardHeaders: 'draft-7',
    legacyHeaders: false
});
