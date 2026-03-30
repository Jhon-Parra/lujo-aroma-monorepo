import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabasePublic } from '../config/supabase';
import { pool } from '../config/database';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_please_change';

export interface AuthRequest extends Request {
    user?: any;
}

const extractAccessToken = (req: Request): string | null => {
    let token = (req as any)?.cookies?.access_token;

    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }

    return token || null;
};

const resolveLocalUser = async (supabaseUserId: string, email?: string) => {
    try {
        const [rows] = await pool.query<any[]>(
            'SELECT id, rol, email, supabase_user_id FROM usuarios WHERE supabase_user_id = ?',
            [supabaseUserId]
        );
        const user = (rows as any[])?.[0];
        if (user) return user;

        if (!email) return null;

        const [emailRows] = await pool.query<any[]>(
            'SELECT id, rol, email, supabase_user_id FROM usuarios WHERE email = ?',
            [email]
        );
        const byEmail = (emailRows as any[])?.[0];
        if (!byEmail) return null;

        if (byEmail.supabase_user_id && byEmail.supabase_user_id !== supabaseUserId) {
            return null;
        }

        await pool.query(
            'UPDATE usuarios SET supabase_user_id = ? WHERE id = ?',
            [supabaseUserId, byEmail.id]
        );

        return { ...byEmail, supabase_user_id: supabaseUserId };
    } catch {
        return null;
    }
};

const verifySupabaseToken = async (token: string): Promise<{ id: string; email?: string; raw?: any }> => {
    if (SUPABASE_JWT_SECRET) {
        try {
            const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as any;
            const id = decoded?.sub || decoded?.user_id || decoded?.id;
            if (!id) throw new Error('Token inválido');
            return { id: String(id), email: decoded?.email, raw: decoded };
        } catch {
            // Si el secret esta desactualizado/mal configurado, hacemos fallback al endpoint de Supabase.
            // Esto evita 403 falsos en entornos de desarrollo.
        }
    }

    const { data, error } = await supabasePublic.auth.getUser(token);
    if (error || !data?.user) {
        throw new Error('Token inválido o expirado');
    }

    return { id: data.user.id, email: data.user.email || undefined, raw: data.user };
};

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const token = extractAccessToken(req);

    if (!token) {
        res.status(401).json({ error: 'Acceso Denegado. Token no proporcionado.' });
        return;
    }

    // 1. Intentar verificación Local (JWT Propio)
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded && decoded.isLocal) {
            req.user = { 
                id: decoded.id, 
                email: decoded.email, 
                rol: decoded.rol, 
                supabase_user_id: decoded.sub 
            };
            return next();
        }
    } catch (err) {
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
            } catch {
                // ignore
            }
            res.status(401).json({ error: 'Token inválido o expirado.' });
        });
};

// Igual que verifyToken, pero no bloquea rutas publicas.
// Si el token no existe o es invalido, continua sin req.user.
export const optionalVerifyToken = (req: AuthRequest, _res: Response, next: NextFunction): void => {
    const token = extractAccessToken(req);

    if (!token) {
        next();
        return;
    }

    // 1. Intentar verificación Local
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded && decoded.isLocal) {
            req.user = { 
                id: decoded.id, 
                email: decoded.email, 
                rol: decoded.rol, 
                supabase_user_id: decoded.sub 
            };
            return next();
        }
    } catch (err) {
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

export const requireRole = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.rol)) {
            res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
            return;
        }
        next();
    };
};

// Permisos dinamicos por rol (RBAC)
export const requirePermission = (permission: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
            const { PermissionsService } = await import('../services/permissions.service');
            const ok = await PermissionsService.roleHasPermission(role, permission as any);
            if (!ok) {
                res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
                return;
            }
            next();
        } catch {
            res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
        }
    };
};
