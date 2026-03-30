import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../core/services/auth.service';
import { PermissionsService, PermissionId, RoleId, RolePermissionsMapping } from '../../../core/services/permissions/permissions.service';
import { LowStockBellComponent } from '../../../shared/components/low-stock-bell/low-stock-bell.component';

type PermissionMeta = { id: PermissionId; label: string; description: string };

@Component({
  selector: 'app-admin-permissions',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LowStockBellComponent],
  templateUrl: './permissions.component.html'
})
export class PermissionsComponent implements OnInit {
  loading = true;
  saving = false;
  error = '';

  roles: RoleId[] = ['SUPERADMIN', 'ADMIN', 'VENTAS', 'PRODUCTOS', 'CUSTOMER'];
  permissions: PermissionMeta[] = [
    { id: 'admin.dashboard', label: 'Dashboard', description: 'Ver metricas y resumen' },
    { id: 'admin.products', label: 'Productos', description: 'Gestion, stock, importacion e IA' },
    { id: 'admin.orders', label: 'Pedidos', description: 'Ver y actualizar estados de pedidos' },
    { id: 'admin.promotions', label: 'Promociones', description: 'Crear y administrar promociones' },
    { id: 'admin.settings', label: 'Settings', description: 'Personalizar pagina / ajustes globales' },
    { id: 'admin.users', label: 'Usuarios', description: 'Gestion de usuarios, roles y segmentos' }
  ];

  mapping: RolePermissionsMapping = {};

  constructor(
    private authService: AuthService,
    private permissionsService: PermissionsService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.permissionsService.getAll().subscribe({
      next: (res) => {
        this.roles = res.roles || this.roles;
        this.mapping = res.mapping || {};
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || err?.error?.message || 'No se pudieron cargar los permisos.';
        this.loading = false;
      }
    });
  }

  isChecked(role: RoleId, perm: PermissionId): boolean {
    if (role === 'SUPERADMIN') return true;
    const list = this.mapping?.[role] || [];
    return list.includes(perm);
  }

  toggle(role: RoleId, perm: PermissionId): void {
    if (role === 'SUPERADMIN' || role === 'CUSTOMER') return;
    const list = Array.isArray(this.mapping?.[role]) ? [...this.mapping[role]] : [];
    const idx = list.indexOf(perm);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(perm);
    this.mapping = { ...this.mapping, [role]: list };
  }

  save(): void {
    this.saving = true;
    this.error = '';
    this.permissionsService.saveAll(this.mapping).subscribe({
      next: () => {
        this.saving = false;
        this.permissionsService.clearMeCache();
        alert('Permisos actualizados');
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.error || err?.error?.message || 'No se pudieron guardar los permisos.';
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }

  getAdminLogoUrl(): string {
    const s = String(localStorage.getItem('lujo_aroma_settings_cache_v1') || '');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        const url = parsed.logo_url;
        if (url) {
          if (url.startsWith('http') || url.startsWith('data:')) return url;
          if (url.startsWith('assets/')) return '/' + url;
          return url;
        }
      } catch (e) {}
    }
    return '/assets/images/logo.svg';
  }
}
