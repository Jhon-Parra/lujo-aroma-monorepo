import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map, of } from 'rxjs';

/**
 * Auth Guard
 * Función Standalone de Angular que verifica si el usuario está completamente autenticado en el sistema.
 * 
 * Uso en App Routing: 
 * { path: 'checkout', component: CheckoutComponent, canActivate: [authGuard] }
 */
export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Validaciones del guard (token valido y existente)
    if (authService.isAuthenticated()) {
        return true; // Permitir el flujo
    }

    // Intentar refrescar sesion antes de bloquear (cookies)
    return authService.refreshUser().pipe(
        map(() => {
            if (authService.isAuthenticated()) return true;
            router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
            return false;
        }),
        catchError(() => {
            router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
            return of(false);
        })
    );

    // Guardando la URL a la que se intentaba acceder para redirección post-login
    // Esto es parte de un flujo correcto y pulido UX para E-Commerce de alta gama.
    // Nota: este return nunca se ejecuta por el return observable anterior
};
