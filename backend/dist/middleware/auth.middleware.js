"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.requireRole = exports.optionalVerifyToken = exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_1 = require("../config/supabase");
const database_1 = require("../config/database");
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_please_change';
const extractAccessToken = (req) => {
    let token = req?.cookies?.access_token;
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }
    return token || null;
};
const resolveLocalUser = async (supabaseUserId, email) => {
    try {
        const [rows] = await database_1.pool.query('SELECT id, rol, email, supabase_user_id FROM usuarios WHERE supabase_user_id = ?', [supabaseUserId]);
        const user = rows?.[0];
        if (user)
            return user;
        if (!email)
            return null;
        const [emailRows] = await database_1.pool.query('SELECT id, rol, email, supabase_user_id FROM usuarios WHERE email = ?', [email]);
        const byEmail = emailRows?.[0];
        if (!byEmail)
            return null;
        if (byEmail.supabase_user_id && byEmail.supabase_user_id !== supabaseUserId) {
            return null;
        }
        await database_1.pool.query('UPDATE usuarios SET supabase_user_id = ? WHERE id = ?', [supabaseUserId, byEmail.id]);
        return { ...byEmail, supabase_user_id: supabaseUserId };
    }
    catch {
        return null;
    }
};
const verifySupabaseToken = async (token) => {
    if (SUPABASE_JWT_SECRET) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, SUPABASE_JWT_SECRET);
            const id = decoded?.sub || decoded?.user_id || decoded?.id;
            if (!id)
                throw new Error('Token inválido');
            return { id: String(id), email: decoded?.email, raw: decoded };
        }
        catch {
            // Si el secret esta desactualizado/mal configurado, hacemos fallback al endpoint de Supabase.
            // Esto evita 403 falsos en entornos de desarrollo.
        }
    }
    const { data, error } = await supabase_1.supabasePublic.auth.getUser(token);
    if (error || !data?.user) {
        throw new Error('Token inválido o expirado');
    }
    return { id: data.user.id, email: data.user.email || undefined, raw: data.user };
};
const verifyToken = (req, res, next) => {
    const token = extractAccessToken(req);
    if (!token) {
        res.status(401).json({ error: 'Acceso Denegado. Token no proporcionado.' });
        return;
    }
    // 1. Intentar verificación Local (JWT Propio)
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (decoded && decoded.isLocal) {
            req.user = {
                id: decoded.id,
                email: decoded.email,
                rol: decoded.rol,
                supabase_user_id: decoded.sub
            };
            return next();
        }
    }
    catch (err) {
        // Ignorar y seguir a Supabase
    }
    // 2. Fallback a Supabase
    verifySupabaseToken(token)
        .then(async (verified) => {
        const local = await resolveLocalUser(verified.id, verified.email);
        if (!local) {
            res.status(403).json({ error: 'Usuario no sincronizado con Supabase' });
            return;
        }
        req.user = { id: local.id, email: local.email || verified.email, rol: local.rol, supabase_user_id: verified.id };
        next();
    })
        .catch(() => {
        // Token invalido: limpiar cookies para evitar loops de 403 en el cliente.
        try {
            res.clearCookie('access_token', { path: '/' });
            res.clearCookie('refresh_token', { path: '/' });
        }
        catch {
            // ignore
        }
        res.status(401).json({ error: 'Token inválido o expirado.' });
    });
};
exports.verifyToken = verifyToken;
// Igual que verifyToken, pero no bloquea rutas publicas.
// Si el token no existe o es invalido, continua sin req.user.
const optionalVerifyToken = (req, _res, next) => {
    const token = extractAccessToken(req);
    if (!token) {
        next();
        return;
    }
    // 1. Intentar verificación Local
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (decoded && decoded.isLocal) {
            req.user = {
                id: decoded.id,
                email: decoded.email,
                rol: decoded.rol,
                supabase_user_id: decoded.sub
            };
            return next();
        }
    }
    catch (err) {
        // Ignorar
    }
    // 2. Fallback a Supabase
    verifySupabaseToken(token)
        .then(async (verified) => {
        const local = await resolveLocalUser(verified.id, verified.email);
        if (!local) {
            next();
            return;
        }
        req.user = { id: local.id, email: local.email || verified.email, rol: local.rol, supabase_user_id: verified.id };
        next();
    })
        .catch(() => {
        next();
    });
};
exports.optionalVerifyToken = optionalVerifyToken;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.rol)) {
            res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
// Permisos dinamicos por rol (RBAC)
const requirePermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
            return;
        }
        const role = String(req.user.rol || '').toUpperCase();
        if (role === 'SUPERADMIN') {
            next();
            return;
        }
        try {
            const { PermissionsService } = await Promise.resolve().then(() => __importStar(require('../services/permissions.service')));
            const ok = await PermissionsService.roleHasPermission(role, permission);
            if (!ok) {
                res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
                return;
            }
            next();
        }
        catch {
            res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
        }
    };
};
exports.requirePermission = requirePermission;
