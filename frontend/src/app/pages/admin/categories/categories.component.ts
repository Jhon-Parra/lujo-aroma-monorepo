import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import Swal from 'sweetalert2';

import { Category, CategoryService } from '../../../core/services/category/category.service';
import { ProductHouse, ProductService } from '../../../core/services/product/product.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.css']
})
export class CategoriesComponent implements OnInit {
  loading = true;
  error = '';
  categories: Category[] = [];
  userRole = '';

  newName = '';
  isSaving = false;

  editingId: string | null = null;
  editingName = '';

  constructor(
    private categoryService: CategoryService,
    private productService: ProductService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.categoryService.getAdminCategories().subscribe({
      next: (rows) => {
        this.loadHousesAndMerge(rows || []);
      },
      error: (err) => {
        const adminError = err?.error?.error || 'No se pudieron cargar las categorias.';
        this.loadHousesAndMerge([], adminError);
      }
    });
  }

  private normalizeSlug(raw: any): string {
    return String(raw ?? '').trim().toLowerCase();
  }

  private loadHousesAndMerge(adminRows: Category[], adminError: string = ''): void {
    this.productService.getPublicHouses().subscribe({
      next: (houses) => {
        this.categories = this.mergeAdminAndHouses(adminRows || [], houses || []);
        this.loading = false;
        this.error = this.categories.length > 0
          ? ''
          : (adminError || 'No se pudieron cargar las casas/categorias.');
      },
      error: () => {
        this.categories = this.mergeAdminAndHouses(adminRows || [], []);
        this.loading = false;
        this.error = this.categories.length > 0
          ? ''
          : (adminError || 'No se pudieron cargar las casas/categorias.');
      }
    });
  }

  private mergeAdminAndHouses(adminRows: Category[], houses: ProductHouse[]): Category[] {
    const map = new Map<string, Category>();

    for (const c of adminRows || []) {
      const slug = this.normalizeSlug(c?.slug);
      if (!slug) continue;
      map.set(slug, {
        ...c,
        slug,
        nombre: String(c?.nombre || slug).trim(),
        total_productos: Number((c as any)?.total_productos || 0)
      });
    }

    for (const h of houses || []) {
      const slug = this.normalizeSlug((h as any)?.slug);
      if (!slug) continue;

      const total = Number((h as any)?.total_productos || 0);
      const existing = map.get(slug);

      if (existing) {
        map.set(slug, {
          ...existing,
          total_productos: Number.isFinite(total) ? total : Number(existing.total_productos || 0)
        });
        continue;
      }

      map.set(slug, {
        id: undefined,
        slug,
        nombre: String((h as any)?.nombre || slug).trim(),
        activo: true,
        total_productos: Number.isFinite(total) ? total : 0
      });
    }

    return Array.from(map.values())
      .sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
  }

  create(): void {
    const nombre = String(this.newName || '').trim();
    if (!nombre) {
      Swal.fire('Atención', 'Ingresa un nombre de categoria.', 'warning');
      return;
    }

    this.isSaving = true;
    this.categoryService.createCategory(nombre).subscribe({
      next: () => {
        this.newName = '';
        this.isSaving = false;
        this.load();
      },
      error: (err) => {
        this.isSaving = false;
        const msg = err?.error?.error || 'No se pudo crear la categoria.';
        Swal.fire('Error', msg, 'error');
      }
    });
  }

  startEdit(c: Category): void {
    this.editingId = c.id || null;
    this.editingName = String(c.nombre || '');
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editingName = '';
  }

  saveEdit(c: Category): void {
    if (!c.id) return;
    const nombre = String(this.editingName || '').trim();
    if (!nombre) {
      Swal.fire('Atención', 'El nombre no puede estar vacio.', 'warning');
      return;
    }

    this.isSaving = true;
    this.categoryService.updateCategory(c.id, { nombre }).subscribe({
      next: () => {
        this.isSaving = false;
        this.cancelEdit();
        this.load();
      },
      error: (err) => {
        this.isSaving = false;
        const msg = err?.error?.error || 'No se pudo actualizar la categoria.';
        Swal.fire('Error', msg, 'error');
      }
    });
  }

  toggleActive(c: Category): void {
    if (!c.id) return;
    const next = !(c.activo !== false);
    this.categoryService.updateCategory(c.id, { activo: next }).subscribe({
      next: () => {
        c.activo = next;
      },
      error: (err) => {
        const msg = err?.error?.error || 'No se pudo actualizar el estado.';
        Swal.fire('Error', msg, 'error');
        this.load();
      }
    });
  }

  async confirmDelete(c: Category): Promise<void> {
    if (!c.id) return;
    const result = await Swal.fire({
      title: 'Eliminar categoria',
      text: `Esta accion no se puede deshacer. Categoria: ${c.nombre}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b91c1c'
    });
    if (!result.isConfirmed) return;

    this.categoryService.deleteCategory(c.id).subscribe({
      next: () => {
        this.load();
      },
      error: (err) => {
        const msg = err?.error?.error || 'No se pudo eliminar la categoria.';
        Swal.fire('Error', msg, 'error');
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
    return '/assets/images/logo.png';
  }
}
