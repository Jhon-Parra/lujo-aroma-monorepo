import { Router } from 'express';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { PermissionsService, ALL_PERMISSIONS, ALL_ROLES } from '../services/permissions.service';
import { logAdminAction } from '../services/audit.service';

const router = Router();

router.get('/me', verifyToken, async (req: AuthRequest, res) => {
    const role = String(req.user?.rol || '').toUpperCase();
    if (role === 'SUPERADMIN') {
        res.status(200).json({ role, permissions: ALL_PERMISSIONS });
        return;
    }
    const mapping = await PermissionsService.getRolePermissions();
    res.status(200).json({ role, permissions: mapping[role] || [] });
});

router.get('/', verifyToken, requireRole(['SUPERADMIN']), async (_req, res) => {
    const mapping = await PermissionsService.getRolePermissions();
    res.status(200).json({
        roles: ALL_ROLES,
        permissions: ALL_PERMISSIONS,
        mapping
    });
});

router.put('/', verifyToken, requireRole(['SUPERADMIN']), async (req, res) => {
    try {
        const next = await PermissionsService.setRolePermissions(req.body?.mapping ?? req.body);
        const actorUserId = String((req as any)?.user?.id || '').trim();
        if (actorUserId) {
            const roles = Object.keys(req.body?.mapping ?? req.body ?? {});
            const totalPermissions = Array.isArray(next)
                ? next.length
                : Object.values(next || {}).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
            await logAdminAction({
                actorUserId,
                action: 'permissions.update',
                target: 'role_permissions',
                metadata: { roles, totalPermissions },
                req
            });
        }
        res.status(200).json({ ok: true, mapping: next });
    } catch (e: any) {
        res.status(500).json({ error: e?.message || 'No se pudieron guardar permisos' });
    }
});

export default router;
