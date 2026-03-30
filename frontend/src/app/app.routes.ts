import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
    },
    {
        path: 'product/:id',
        loadComponent: () => import('./pages/store/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
    },
    {
        path: 'order-success/:id',
        loadComponent: () => import('./pages/store/order-success/order-success.component').then(m => m.OrderSuccessComponent),
        canActivate: [authGuard]
    },
    {
        path: 'checkout',
        loadComponent: () => import('./pages/store/checkout/checkout.component').then(m => m.CheckoutComponent),
        canActivate: [authGuard]
    },
    { path: 'login', loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent) },
    { path: 'catalog', loadComponent: () => import('./pages/store/catalog/catalog.component').then(m => m.CatalogComponent) },
    { path: 'promotions', loadComponent: () => import('./pages/store/promotions/promotions.component').then(m => m.PromotionsStoreComponent) },
    { path: 'recommender', loadComponent: () => import('./pages/store/recommender/recommender.component').then(m => m.RecommenderComponent) },
    { path: 'manual', loadComponent: () => import('./pages/store/manual/manual.component').then(m => m.ManualComponent) },
    { path: 'contact', loadComponent: () => import('./pages/store/contact/contact.component').then(m => m.ContactComponent) },
    {
        path: 'profile',
        loadComponent: () => import('./pages/store/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [authGuard]
    },
    {
        path: 'favorites',
        loadComponent: () => import('./pages/store/favorites/favorites.component').then(m => m.FavoritesComponent),
        canActivate: [authGuard]
    },
    {
        path: 'my-orders',
        loadComponent: () => import('./pages/store/my-orders/my-orders.component').then(m => m.MyOrdersComponent),
        canActivate: [authGuard]
    },
    {
        path: 'admin',
        loadComponent: () => import('./pages/admin/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [authGuard, roleGuard],
        data: { permission: 'admin.dashboard' }
    },
    {
        path: 'admin/products',
        loadComponent: () => import('./pages/admin/products/products.component').then(m => m.ProductsComponent),
        canActivate: [authGuard, roleGuard],
        data: { permission: 'admin.products' }
    },
    {
        path: 'admin/categories',
        loadComponent: () => import('./pages/admin/categories/categories.component').then(m => m.CategoriesComponent),
        canActivate: [authGuard, roleGuard],
        data: { permission: 'admin.products' }
    },
    {
        path: 'admin/orders',
        loadComponent: () => import('./pages/admin/orders/orders.component').then(m => m.OrdersComponent),
        canActivate: [authGuard, roleGuard],
        data: { permission: 'admin.orders' }
    },
    {
        path: 'admin/settings',
        loadComponent: () => import('./pages/admin/settings/settings.component').then(m => m.SettingsComponent),
        canActivate: [authGuard, roleGuard],
        data: { permission: 'admin.settings' }
    },
    {
        path: 'admin/promotions',
        loadComponent: () => import('./pages/admin/promotions/promotions.component').then(m => m.PromotionsComponent),
        canActivate: [authGuard, roleGuard],
        data: { permission: 'admin.promotions' }
    },
    {
        path: 'admin/users',
        loadComponent: () => import('./pages/admin/users/users.component').then(m => m.UsersComponent),
        canActivate: [authGuard, roleGuard],
        data: { permission: 'admin.users' }
    },
    {
        path: 'admin/permissions',
        loadComponent: () => import('./pages/admin/permissions/permissions.component').then(m => m.PermissionsComponent),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['SUPERADMIN'] }
    },
    {
        path: 'admin/intelligence',
        loadComponent: () => import('./pages/admin/intelligence-alerts/intelligence-alerts.component').then(m => m.IntelligenceAlertsComponent),
        canActivate: [authGuard, roleGuard],
        data: { permission: 'admin.dashboard' }
    },
    {
        path: 'admin/cart-recovery',
        loadComponent: () => import('./pages/admin/cart-recovery/cart-recovery.component').then(m => m.CartRecoveryComponent),
        canActivate: [authGuard, roleGuard],
        data: { permission: 'admin.settings' }
    },
    {
        path: 'access-denied',
        loadComponent: () => import('./pages/access-denied/access-denied.component').then(m => m.AccessDeniedComponent)
    },
    { path: '**', redirectTo: '' }
];
