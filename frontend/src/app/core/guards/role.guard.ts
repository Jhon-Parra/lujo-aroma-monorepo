import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionsService } from '../services/permissions/permissions.service';
import { map } from 'rxjs/operators';

/**
 * Role Guard
 * Función Standalone de Angular que verifica si un usuario autenticado 
 * además posee el acceso necesario (Rol) para la ruta.
 * 
 * Uso en App Routing (CMS): 
 * { 
 *   path: 'admin', 
 *   component: AdminLayoutComponent, 
 *   canActivate: [authGuard, roleGuard], 
 *   data: { role: 'ADMIN' } 
 * }
 */
export const roleGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const permissionsService = inject(PermissionsService);

    // Roles o permiso requerido provistos desde data
    const expectedRoles = route.data['roles'] as string[];
    const requiredPermission = route.data['permission'] as string;
    const currentRole = authService.getUserRole();

    if (!authService.isAuthenticated()) {
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return false;
    }

    // Si la ruta define roles, se respeta primero
    if (expectedRoles && expectedRoles.length > 0) {
        if (!expectedRoles.includes(currentRole)) {
            router.navigate(['/access-denied']);
            return false;
        }
        return true;
    }

    // Si la ruta define permiso, consultamos permisos del usuario
    if (requiredPermission) {
        return permissionsService.getMePermissions().pipe(
            map((perms) => {
                if (perms.includes(requiredPermission as any)) return true;
                router.navigate(['/access-denied']);
                return false;
            })
        );
    }

    return true;
};
