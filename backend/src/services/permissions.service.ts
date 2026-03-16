import { pool } from '../config/database';

export type AppRole = 'SUPERADMIN' | 'ADMIN' | 'VENTAS' | 'PRODUCTOS' | 'CUSTOMER';

export type PermissionId =
    | 'admin.dashboard'
    | 'admin.products'
    | 'admin.orders'
    | 'admin.promotions'
    | 'admin.settings'
    | 'admin.payments'
    | 'admin.users';

export type RolePermissions = Record<string, PermissionId[]>;

export const ALL_ROLES: AppRole[] = ['SUPERADMIN', 'ADMIN', 'VENTAS', 'PRODUCTOS', 'CUSTOMER'];
export const ALL_PERMISSIONS: PermissionId[] = [
    'admin.dashboard',
    'admin.products',
    'admin.orders',
    'admin.promotions',
    'admin.settings',
    'admin.payments',
    'admin.users'
];

const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
    SUPERADMIN: ALL_PERMISSIONS,
    ADMIN: ['admin.dashboard', 'admin.products', 'admin.orders', 'admin.promotions', 'admin.settings', 'admin.payments'],
    VENTAS: ['admin.dashboard', 'admin.orders'],
    PRODUCTOS: ['admin.dashboard', 'admin.products'],
    CUSTOMER: []
};

type Cache = { value: RolePermissions; at: number };
let cache: Cache | null = null;
const CACHE_MS = 30_000;

const sanitize = (raw: any): RolePermissions => {
    const out: RolePermissions = { ...DEFAULT_ROLE_PERMISSIONS };
    if (!raw || typeof raw !== 'object') return out;

    for (const role of ALL_ROLES) {
        const arr = (raw as any)[role];
        if (!Array.isArray(arr)) continue;
        const perms = Array.from(new Set(arr.map((x: any) => String(x).trim())))
            .filter((p) => (ALL_PERMISSIONS as string[]).includes(p)) as PermissionId[];

        // SUPERADMIN siempre tiene todo
        if (role === 'SUPERADMIN') {
            out[role] = ALL_PERMISSIONS;
        } else {
            out[role] = perms;
        }
    }

    return out;
};

export const PermissionsService = {
    defaults(): RolePermissions {
        return { ...DEFAULT_ROLE_PERMISSIONS };
    },

    async getRolePermissions(): Promise<RolePermissions> {
        const now = Date.now();
        if (cache && now - cache.at < CACHE_MS) return cache.value;

        try {
            const [rows] = await pool.query<any[]>(
                'SELECT role_permissions FROM ConfiguracionGlobal WHERE id = 1'
            );
            const raw = (rows as any[])?.[0]?.role_permissions;
            const value = sanitize(raw);
            cache = { value, at: now };
            return value;
        } catch {
            const value = { ...DEFAULT_ROLE_PERMISSIONS };
            cache = { value, at: now };
            return value;
        }
    },

    async setRolePermissions(input: any): Promise<RolePermissions> {
        const value = sanitize(input);
        try {
            await pool.query('UPDATE ConfiguracionGlobal SET role_permissions = ? WHERE id = 1', [JSON.stringify(value)]);
        } catch (e: any) {
            const msg = String(e?.message || '');
            if (/role_permissions/i.test(msg) && (/column/i.test(msg) || /no existe/i.test(msg))) {
                throw new Error('Tu base de datos no soporta permisos por rol o falta la columna. Ejecuta las migraciones de base de datos y vuelve a intentar.');
            }
            throw e;
        }
        cache = { value, at: Date.now() };
        return value;
    },

    async roleHasPermission(role: string, perm: PermissionId): Promise<boolean> {
        const r = String(role || '').toUpperCase();
        if (r === 'SUPERADMIN') return true;
        const mapping = await this.getRolePermissions();
        const perms = mapping[r] || [];
        return perms.includes(perm);
    }
};
