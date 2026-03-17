import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import Swal from 'sweetalert2';

import { Category, CategoryService } from '../../../core/services/category/category.service';
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
        this.categories = (rows || []).slice().sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || 'No se pudieron cargar las categorias. Ejecuta la migracion de categorias en Supabase.';
      }
    });
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
}
