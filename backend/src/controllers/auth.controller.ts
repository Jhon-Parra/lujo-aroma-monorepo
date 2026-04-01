import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { pool } from '../config/database';
import { supabaseAdmin, supabasePublic } from '../config/supabase';

const isProduction = process.env.NODE_ENV === 'production';
const allowCrossSiteCookies = process.env.COOKIE_CROSS_SITE === 'true';
const cookieSameSite: 'lax' | 'none' = isProduction && allowCrossSiteCookies ? 'none' : 'lax';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_please_change';

const cookieBaseOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: cookieSameSite,
    path: '/',
    domain: isProduction ? '.lujo_aromacol.com' : undefined // Permite compartir cookies entre subdominios
};

const ACCESS_TOKEN_FALLBACK_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;

const setSessionCookies = (res: Response, session: any) => {
    const accessMaxAge = typeof session?.expires_in === 'number'
        ? Math.max(session.expires_in, 60) * 1000
        : ACCESS_TOKEN_FALLBACK_MS;

    res.cookie('access_token', session?.access_token || '', {
        ...cookieBaseOptions,
        maxAge: accessMaxAge
    });

    res.cookie('refresh_token', session?.refresh_token || '', {
        ...cookieBaseOptions,
        maxAge: REFRESH_TOKEN_FALLBACK_MS
    });
};

const clearTokenCookies = (res: Response) => {
    res.clearCookie('access_token', cookieBaseOptions);
    res.clearCookie('refresh_token', cookieBaseOptions);
};

const logSecurityEvent = async (req: Request, email: string | null, eventType: string) => {
    try {
        const ip = req.ip ? String(req.ip) : null;
        const userAgent = req.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 300) : null;
        await pool.query(
            `INSERT INTO authsecurityevents (email, ip, user_agent, event_type)
             VALUES (?, ?, ?, ?)`,
            [email, ip, userAgent, eventType]
        );
    } catch {
        // ignore
    }
};

const getUserById = async (id: string) => {
    const [rows] = await pool.query<any[]>(
        'SELECT id, supabase_user_id, email, nombre, apellido, foto_perfil, rol FROM usuarios WHERE id = ?',
        [id]
    );
    return (rows as any[])?.[0] || null;
};

const getUserBySupabaseId = async (supabaseUserId: string) => {
    const [rows] = await pool.query<any[]>(
        'SELECT id, supabase_user_id, email, nombre, apellido, foto_perfil, rol FROM usuarios WHERE supabase_user_id = ?',
        [supabaseUserId]
    );
    return (rows as any[])?.[0] || null;
};

const getUserByEmail = async (email: string) => {
    const [rows] = await pool.query<any[]>(
        'SELECT id, supabase_user_id, email, nombre, apellido, foto_perfil, rol, password_hash FROM usuarios WHERE email = ?',
        [email]
    );
    return (rows as any[])?.[0] || null;
};

const linkSupabaseUser = async (localUserId: string, supabaseUserId: string) => {
    await pool.query(
        'UPDATE usuarios SET supabase_user_id = ? WHERE id = ?',
        [supabaseUserId, localUserId]
    );
};

const ensureLocalUser = async (input: {
    supabaseUserId: string;
    email: string;
    nombre?: string | null;
    apellido?: string | null;
    telefono?: string | null;
    foto_perfil?: string | null;
    passwordHash?: string | null;
}): Promise<{ ok: boolean; conflict?: boolean; user?: any }> => {
    const existingBySupabase = await getUserBySupabaseId(input.supabaseUserId);
    if (existingBySupabase) return { ok: true, user: existingBySupabase };

    const existingByEmail = await getUserByEmail(input.email);
    if (existingByEmail) {
        if (existingByEmail.supabase_user_id && existingByEmail.supabase_user_id !== input.supabaseUserId) {
            return { ok: false, conflict: true };
        }

        await linkSupabaseUser(existingByEmail.id, input.supabaseUserId);
        return {
            ok: true,
            user: { ...existingByEmail, supabase_user_id: input.supabaseUserId }
        };
    }

    const passwordHash = input.passwordHash || await bcrypt.hash(Math.random().toString(36), 10);
    const newId = randomUUID();

    await pool.query(
        `INSERT INTO usuarios (id, supabase_user_id, nombre, apellido, telefono, email, password_hash, rol, foto_perfil)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'CUSTOMER', ?)`,
        [
            newId,
            input.supabaseUserId,
            input.nombre || 'Usuario',
            input.apellido || 'Supabase',
            input.telefono || null,
            input.email,
            passwordHash,
            input.foto_perfil || null
        ]
    );

    const created = await getUserBySupabaseId(input.supabaseUserId);
    return { ok: true, user: created };
};

const buildUserResponse = async (user: any) => {
    if (!user?.id) return null;
    const local = await getUserBySupabaseId(user.id);
    if (local) return local;

    return {
        id: user.id,
        email: user.email,
        nombre: user.user_metadata?.nombre || user.user_metadata?.given_name || 'Usuario',
        apellido: user.user_metadata?.apellido || user.user_metadata?.family_name || '',
        foto_perfil: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        rol: user.user_metadata?.rol || 'CUSTOMER'
    };
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email y contraseña son requeridos' });
            return;
        }

        const { data, error } = await supabasePublic.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data?.session || !data?.user) {
            // FALLBACK: Intentar autenticación local (MySQL)
            const localUser = await getUserByEmail(email);
            if (localUser && localUser.password_hash) {
                const isMatch = await bcrypt.compare(password, localUser.password_hash);
                if (isMatch) {
                    // Generar token local compatible
                    const localAccessToken = jwt.sign(
                        { 
                            sub: localUser.supabase_user_id || localUser.id, 
                            email: localUser.email,
                            id: localUser.id,
                            rol: localUser.rol,
                            isLocal: true 
                        },
                        JWT_SECRET,
                        { expiresIn: '1h' }
                    );

                    const localRefreshToken = jwt.sign(
                        { id: localUser.id, type: 'refresh' },
                        JWT_SECRET,
                        { expiresIn: '7d' }
                    );

                    setSessionCookies(res, {
                        access_token: localAccessToken,
                        refresh_token: localRefreshToken,
                        expires_in: 3600
                    });

                    // Limpiar password_hash del payload
                    const { password_hash, ...userPayload } = localUser;

                    res.status(200).json({
                        message: 'Autenticación local exitosa',
                        user: userPayload,
                        isLocal: true
                    });
                    return;
                }
            }

            await logSecurityEvent(req, email, 'login_failed');
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }

        const ensure = await ensureLocalUser({
            supabaseUserId: data.user.id,
            email: data.user.email || email,
            nombre: data.user.user_metadata?.nombre || data.user.user_metadata?.given_name || null,
            apellido: data.user.user_metadata?.apellido || data.user.user_metadata?.family_name || null,
            telefono: data.user.user_metadata?.telefono || null,
            foto_perfil: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null
        });

        if (!ensure.ok && ensure.conflict) {
            res.status(409).json({ error: 'Usuario existente requiere migración a Supabase' });
            return;
        }

        setSessionCookies(res, data.session);

        const userPayload = ensure.user || await buildUserResponse(data.user);

        res.status(200).json({
            message: 'Autenticación exitosa',
            user: userPayload
        });
    } catch (error) {
        console.error('Error en Login Auth (Supabase):', error);
        res.status(500).json({ error: 'Error interno del servidor. Contacte al soporte.' });
    }
};

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, apellido, telefono, email, password } = req.body;

        if (!nombre || !apellido || !telefono || !email || !password) {
            res.status(400).json({ error: 'Todos los campos son requeridos.' });
            return;
        }

        const { data, error } = await supabasePublic.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nombre,
                    apellido,
                    telefono
                }
            }
        });

        if (error || !data?.user) {
            const msg = String(error?.message || 'No se pudo registrar el usuario');
            if (/already registered|user exists|duplicate/i.test(msg)) {
                res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
                return;
            }
            res.status(400).json({ error: msg });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const ensure = await ensureLocalUser({
            supabaseUserId: data.user.id,
            email: data.user.email || email,
            nombre,
            apellido,
            telefono,
            foto_perfil: data.user.user_metadata?.avatar_url || null,
            passwordHash
        });

        if (!ensure.ok && ensure.conflict) {
            res.status(409).json({ error: 'Usuario existente requiere migración a Supabase' });
            return;
        }

        if (data.session) {
            setSessionCookies(res, data.session);
        }

        const userPayload = ensure.user || await buildUserResponse(data.user);

        res.status(201).json({
            message: data.session
                ? 'Usuario registrado exitosamente'
                : 'Registro exitoso. Revisa tu email para confirmar la cuenta.',
            user: userPayload
        });
    } catch (error) {
        console.error('Error en Registro Auth (Supabase):', error);
        res.status(500).json({ error: 'Error interno al registrar usuario.' });
    }
};

const guessNamesFromMetadata = (metadata: any) => {
    const given = metadata?.given_name || metadata?.first_name || metadata?.nombre || '';
    const family = metadata?.family_name || metadata?.last_name || metadata?.apellido || '';
    if (given || family) return { nombre: given || 'Usuario', apellido: family || '' };

    const full = metadata?.full_name || metadata?.name || '';
    const parts = String(full).trim().split(' ').filter(Boolean);
    if (parts.length === 0) return { nombre: 'Usuario', apellido: 'Google' };
    if (parts.length === 1) return { nombre: parts[0], apellido: 'Google' };
    return { nombre: parts[0], apellido: parts.slice(1).join(' ') };
};

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { credential } = req.body;

        if (!credential) {
            res.status(400).json({ error: 'Token de Google es requerido' });
            return;
        }

        const { data, error } = await supabasePublic.auth.signInWithIdToken({
            provider: 'google',
            token: credential
        });

        if (error || !data?.session || !data?.user) {
            console.error('Supabase Google Auth Error:', error);
            await logSecurityEvent(req, null, 'login_failed');

            // Devolvemos detalles para diagnostico temporalmente en produccion para resolver el 401
            res.status(401).json({ 
                error: 'Token de Google inválido o rechazado por Supabase',
                details: error?.message || error || 'No se pudo obtener sesión de Supabase',
                code: (error as any)?.code || (error as any)?.status || 'AUTH_ERROR'
            });
            return;
        }

        const { nombre, apellido } = guessNamesFromMetadata(data.user.user_metadata || {});

        const ensure = await ensureLocalUser({
            supabaseUserId: data.user.id,
            email: data.user.email || '',
            nombre,
            apellido,
            telefono: data.user.user_metadata?.telefono || null,
            foto_perfil: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null
        });

        if (!ensure.ok && ensure.conflict) {
            res.status(409).json({ error: 'Usuario existente requiere migración a Supabase' });
            return;
        }

        setSessionCookies(res, data.session);

        const userPayload = ensure.user || await buildUserResponse(data.user);

        res.status(200).json({
            message: 'Autenticación con Google exitosa',
            user: userPayload
        });
    } catch (error) {
        console.error('Error en Google Login Auth (Supabase):', error);
        res.status(500).json({ error: 'Error al iniciar sesión con Google' });
    }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const refreshToken = req.cookies?.refresh_token;

        if (!refreshToken) {
            res.status(200).json({ user: null });
            return;
        }

        // Intentar refresh local (JWT propio)
        try {
            const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
            if (decoded?.type === 'refresh' && decoded?.id) {
                const localUser = await getUserById(String(decoded.id));
                if (!localUser) {
                    clearTokenCookies(res);
                    res.status(401).json({ error: 'Refresh token inválido o expirado' });
                    return;
                }

                const localAccessToken = jwt.sign(
                    {
                        sub: localUser.supabase_user_id || localUser.id,
                        email: localUser.email,
                        id: localUser.id,
                        rol: localUser.rol,
                        isLocal: true
                    },
                    JWT_SECRET,
                    { expiresIn: '1h' }
                );

                const localRefreshToken = jwt.sign(
                    { id: localUser.id, type: 'refresh' },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );

                setSessionCookies(res, {
                    access_token: localAccessToken,
                    refresh_token: localRefreshToken,
                    expires_in: 3600
                });

                res.status(200).json({
                    message: 'Token refrescado exitosamente',
                    user: localUser,
                    isLocal: true
                });
                return;
            }
        } catch {
            // No es token local, continuar con Supabase
        }

        const { data, error } = await supabasePublic.auth.refreshSession({
            refresh_token: refreshToken
        });

        if (error || !data?.session || !data?.user) {
            clearTokenCookies(res);
            res.status(401).json({ error: 'Refresh token inválido o expirado' });
            return;
        }

        setSessionCookies(res, data.session);

        // Importante: sincronizar usuario en MySQL para que verifyToken pueda resolverlo.
        const { nombre, apellido } = guessNamesFromMetadata(data.user.user_metadata || {});
        const ensure = await ensureLocalUser({
            supabaseUserId: data.user.id,
            email: data.user.email || '',
            nombre,
            apellido,
            telefono: (data.user.user_metadata as any)?.telefono || null,
            foto_perfil: (data.user.user_metadata as any)?.avatar_url || (data.user.user_metadata as any)?.picture || null
        });

        if (!ensure.ok && ensure.conflict) {
            clearTokenCookies(res);
            res.status(409).json({ error: 'Usuario existente requiere migración a Supabase' });
            return;
        }

        const userPayload = ensure.user || await buildUserResponse(data.user);

        res.status(200).json({
            message: 'Token refrescado exitosamente',
            user: userPayload
        });
    } catch (error) {
        console.error('Error en refresh token (Supabase):', error);
        res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const accessToken = req.cookies?.access_token || req.headers.authorization?.split(' ')[1];
        if (accessToken) {
            const { data } = await supabasePublic.auth.getUser(accessToken);
            const userId = data?.user?.id;
            if (userId) {
                await supabaseAdmin.auth.admin.signOut(userId);
            }
        }
    } catch (e: any) {
        console.warn('Error revoking Supabase session:', e?.message || e);
    }

    clearTokenCookies(res);
    res.status(200).json({ message: 'Logout exitoso' });
};
