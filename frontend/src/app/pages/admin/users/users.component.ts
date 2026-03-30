import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService, User } from '../../../core/services/user/user.service';
import { LowStockBellComponent } from '../../../shared/components/low-stock-bell/low-stock-bell.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LowStockBellComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  // Representación visual de los roles en UI
  availableRoles = [
    { value: 'SUPERADMIN', label: 'Super Administrador' },
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'VENTAS', label: 'Ventas' },
    { value: 'PRODUCTOS', label: 'Productos' },
    { value: 'CUSTOMER', label: 'Deshabilitar (Cliente Normal)' }
  ];

  constructor(private userService: UserService) { }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.userService.getUsers().subscribe({
      next: (data) => this.users = data,
      error: (err) => console.error('Error cargando usuarios', err)
    });
  }

  changeUserRole(user: User, newRole: string) {
    const originalRole = user.rol;
    user.rol = newRole; // Actualización optimista de la UI para evitar que salte de nuevo

    if (confirm(`¿Estás seguro de cambiar el rol a ${newRole}?`)) {
      this.userService.updateUserRole(user.id, newRole).subscribe({
        next: () => {
          // No necesitamos recargar toda la lista porque ya actualizamos 'user.rol'
        },
        error: (err) => {
          console.error(err);
          alert('Error al actualizar rol');
          user.rol = originalRole; // Revertir solo si falla el servidor
        }
      });
    } else {
      user.rol = originalRole; // Revertir si el usuario cancela la alerta
    }
  }

  changeUserSegment(user: User, newSegment: string) {
    const original = user.segmento || '';
    const next = (newSegment || '').trim();

    // Evitar llamadas si no hay cambios reales
    if (original.trim() === next) return;

    user.segmento = next;

    if (confirm(`Asignar segmento "${next || 'SIN SEGMENTO'}" a ${user.email}?`)) {
      this.userService.updateUserSegment(user.id, next.length > 0 ? next : null).subscribe({
        next: () => {},
        error: (err) => {
          console.error(err);
          alert('Error al actualizar segmento');
          user.segmento = original;
        }
      });
    } else {
      user.segmento = original;
    }
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
