"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsService = exports.ALL_PERMISSIONS = exports.ALL_ROLES = void 0;
const database_1 = require("../config/database");
exports.ALL_ROLES = ['SUPERADMIN', 'ADMIN', 'VENTAS', 'PRODUCTOS', 'CUSTOMER'];
exports.ALL_PERMISSIONS = [
    'admin.dashboard',
    'admin.products',
    'admin.orders',
    'admin.promotions',
    'admin.settings',
    'admin.users'
];
const DEFAULT_ROLE_PERMISSIONS = {
    SUPERADMIN: exports.ALL_PERMISSIONS,
    ADMIN: ['admin.dashboard', 'admin.products', 'admin.orders', 'admin.promotions', 'admin.settings'],
    VENTAS: ['admin.dashboard', 'admin.orders'],
    PRODUCTOS: ['admin.dashboard', 'admin.products'],
    CUSTOMER: []
};
let cache = null;
const CACHE_MS = 30_000;
const sanitize = (raw) => {
    const out = { ...DEFAULT_ROLE_PERMISSIONS };
    if (!raw || typeof raw !== 'object')
        return out;
    for (const role of exports.ALL_ROLES) {
        const arr = raw[role];
        if (!Array.isArray(arr))
            continue;
        const perms = Array.from(new Set(arr.map((x) => String(x).trim())))
            .filter((p) => exports.ALL_PERMISSIONS.includes(p));
        // SUPERADMIN siempre tiene todo
        if (role === 'SUPERADMIN') {
            out[role] = exports.ALL_PERMISSIONS;
        }
        else {
            out[role] = perms;
        }
    }
    return out;
};
exports.PermissionsService = {
    defaults() {
        return { ...DEFAULT_ROLE_PERMISSIONS };
    },
    async getRolePermissions() {
        const now = Date.now();
        if (cache && now - cache.at < CACHE_MS)
            return cache.value;
        try {
            const [rows] = await database_1.pool.query('SELECT role_permissions FROM configuracionglobal WHERE id = 1');
            const raw = rows?.[0]?.role_permissions;
            const value = sanitize(raw);
            cache = { value, at: now };
            return value;
        }
        catch {
            const value = { ...DEFAULT_ROLE_PERMISSIONS };
            cache = { value, at: now };
            return value;
        }
    },
    async setRolePermissions(input) {
        const value = sanitize(input);
        try {
            await database_1.pool.query('UPDATE configuracionglobal SET role_permissions = ? WHERE id = 1', [JSON.stringify(value)]);
        }
        catch (e) {
            const msg = String(e?.message || '');
            if (/role_permissions/i.test(msg) && (/column/i.test(msg) || /no existe/i.test(msg))) {
                throw new Error('Tu base de datos no soporta permisos por rol o falta la columna. Ejecuta las migraciones de base de datos y vuelve a intentar.');
            }
            throw e;
        }
        cache = { value, at: Date.now() };
        return value;
    },
    async roleHasPermission(role, perm) {
        const r = String(role || '').toUpperCase();
        if (r === 'SUPERADMIN')
            return true;
        const mapping = await this.getRolePermissions();
        const perms = mapping[r] || [];
        return perms.includes(perm);
    }
};
