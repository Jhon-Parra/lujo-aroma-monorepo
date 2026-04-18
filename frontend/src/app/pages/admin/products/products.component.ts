import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService, Product } from '../../../core/services/product/product.service';
import { AiService } from '../../../core/services/ai/ai.service';
import { AuthService } from '../../../core/services/auth.service';
import { CategoryService, Category } from '../../../core/services/category/category.service';
import Swal from 'sweetalert2';
import { LowStockBellComponent } from '../../../shared/components/low-stock-bell/low-stock-bell.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LowStockBellComponent],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {
  showForm = false;
  products: Product[] = [];
  filteredProducts: Product[] = [];

  productFilterText = '';
  productFilterGender: 'all' | string = 'all';
  productFilterHouse: 'all' | string = 'all';
  productFilterStock: 'all' | 'low' | 'out' = 'all';
  productSort: 'name_asc' | 'price_desc' | 'price_asc' | 'stock_asc' | 'stock_desc' = 'name_asc';
  private readonly lowStockThreshold = 5;

  houseCategories: Category[] = [];
  houseCatalog: Array<{ slug: string; nombre: string }> = [];
  houseCategoriesSupported = false;
  houseOptions: Array<{ value: string; label: string }> = [];

  newProduct = {
    nombre: '',
    genero: 'unisex',
    casa: '',
    notas: '',
    precio: 0,
    stock: 0,
    descripcion: '',
    esNuevo: false,
    nuevoHasta: ''
  };
  editingProductId: string | null = null;
  selectedFile: File | null = null;
  selectedFile2: File | null = null;
  selectedFile3: File | null = null;
  isGeneratingAI = false;
  editingStockId: string | null = null;
  isSaving = false;

  importFile: File | null = null;
  importDryRun = false;
  isImporting = false;

  showDeleteModal = false;
  productToDelete: string | null = null;

  constructor(
    private productService: ProductService,
    private aiService: AiService,
    private authService: AuthService, // Injected AuthService
    private categoryService: CategoryService
  ) { }

  ngOnInit(): void {
    this.loadHouseCategories();
    this.loadHouseCatalog();
    this.loadProducts();
  }

  loadHouseCatalog(): void {
    this.productService.getPublicHouses().subscribe({
      next: (rows) => {
        this.houseCatalog = (rows || [])
          .map((r: any) => ({
            slug: this.normalizeHouseKey((r as any)?.slug || (r as any)?.casa || ''),
            nombre: String((r as any)?.nombre || (r as any)?.casa || '').trim()
          }))
          .filter((r) => !!r.slug && !!r.nombre)
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        this.rebuildHouseOptions();
      },
      error: () => {
        this.houseCatalog = [];
        this.rebuildHouseOptions();
      }
    });
  }

  loadHouseCategories(): void {
    this.categoryService.getAdminCategories().subscribe({
      next: (rows) => {
        this.houseCategories = (rows || []).slice().sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
        this.rebuildHouseOptions();
      },
      error: () => {
        this.houseCategories = [];
        this.rebuildHouseOptions();
      }
    });
  }

  getActiveHouseCategories(): Category[] {
    const blocked = new Set(['mujer', 'hombre', 'unisex']);
    return (this.houseCategories || []).filter((c) => {
      if (c.activo === false) return false;
      const slug = String(c.slug || '').toLowerCase();
      if (blocked.has(slug)) return false;
      return true;
    });
  }

  loadProducts() {
    this.productService.getProducts().subscribe(res => {
      this.products = res;
      this.rebuildHouseOptions();
      this.applyProductFilters();
    });
  }

  private normalizeHouseKey(raw: any): string {
    return String(raw ?? '').trim().toLowerCase();
  }

  private rebuildHouseOptions(): void {
    const map = new Map<string, string>();

    for (const c of this.getActiveHouseCategories()) {
      const key = this.normalizeHouseKey(c?.slug || c?.nombre || '');
      const label = String(c?.nombre || c?.slug || '').trim();
      if (!key || !label) continue;
      if (!map.has(key)) map.set(key, label);
    }

    for (const h of this.houseCatalog || []) {
      const key = this.normalizeHouseKey(h?.slug || h?.nombre || '');
      const label = String(h?.nombre || h?.slug || '').trim();
      if (!key || !label) continue;
      if (!map.has(key)) map.set(key, label);
    }

    for (const p of this.products || []) {
      const raw = (p as any)?.categoria_slug || (p as any)?.casa || (p as any)?.house || '';
      const key = this.normalizeHouseKey(raw);
      const label = String((p as any)?.categoria_nombre || (p as any)?.casa || (p as any)?.house || '').trim();
      if (!key || !label) continue;
      if (!map.has(key)) map.set(key, label);
    }

    this.houseOptions = Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));

    this.houseCategoriesSupported = this.houseOptions.length > 0;
  }

  getHouseOptions(): Array<{ value: string; label: string }> {
    return this.houseOptions;
  }

  hasHouseOption(value: string | null | undefined): boolean {
    const key = this.normalizeHouseKey(value);
    if (!key) return false;
    return this.houseOptions.some((o) => o.value === key);
  }

  applyProductFilters(): void {
    const q = (this.productFilterText || '').trim().toLowerCase();
    const gender = this.productFilterGender;
    const house = this.productFilterHouse;
    const stockFilter = this.productFilterStock;

    let items = (this.products || []).slice();

    if (q) {
      items = items.filter((p) => {
        const text = `${p?.nombre || ''} ${(p as any)?.notas_olfativas || ''} ${p?.descripcion || ''}`.toLowerCase();
        return text.includes(q);
      });
    }

    if (gender !== 'all') {
      items = items.filter((p) => (p.genero || 'unisex') === gender);
    }

    if (house !== 'all') {
      items = items.filter((p) => {
        const houseKey = this.normalizeHouseKey((p as any)?.categoria_slug || (p as any)?.casa || (p as any)?.house || '');
        return houseKey === house;
      });
    }

    if (stockFilter === 'out') {
      items = items.filter((p) => Number(p.stock || 0) === 0);
    } else if (stockFilter === 'low') {
      items = items.filter((p) => {
        const s = Number(p.stock || 0);
        return s > 0 && s <= this.lowStockThreshold;
      });
    }

    const priceNum = (p: Product) => {
      const raw: any = (p as any)?.precio;
      const n = typeof raw === 'string' ? Number(raw) : Number(raw ?? 0);
      return Number.isFinite(n) ? n : 0;
    };
    const stockNum = (p: Product) => {
      const n = Number((p as any)?.stock ?? 0);
      return Number.isFinite(n) ? n : 0;
    };

    switch (this.productSort) {
      case 'price_desc':
        items.sort((a, b) => priceNum(b) - priceNum(a));
        break;
      case 'price_asc':
        items.sort((a, b) => priceNum(a) - priceNum(b));
        break;
      case 'stock_asc':
        items.sort((a, b) => stockNum(a) - stockNum(b));
        break;
      case 'stock_desc':
        items.sort((a, b) => stockNum(b) - stockNum(a));
        break;
      default:
        items.sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
        break;
    }

    this.filteredProducts = items;
  }

  clearProductFilters(): void {
    this.productFilterText = '';
    this.productFilterGender = 'all';
    this.productFilterHouse = 'all';
    this.productFilterStock = 'all';
    this.productSort = 'name_asc';
    this.applyProductFilters();
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (!this.showForm) this.resetForm();
  }

  onFileSelected(event: any, index: number = 1) {
    const file = event.target.files[0];
    if (file) {
      if (index === 1) this.selectedFile = file;
      else if (index === 2) this.selectedFile2 = file;
      else if (index === 3) this.selectedFile3 = file;
    }
  }

  onImportFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.importFile = file;
    }
  }

  downloadImportTemplate() {
    this.productService.downloadImportTemplate().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_productos.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error descargando plantilla:', err);
        Swal.fire('Error', 'No se pudo descargar la plantilla.', 'error');
      }
    });
  }

  importProducts() {
    if (!this.importFile) {
      Swal.fire('Atención', 'Selecciona un archivo .xlsx o .csv primero.', 'warning');
      return;
    }

    this.isImporting = true;
    this.productService.importFromSpreadsheet(this.importFile, this.importDryRun).subscribe({
      next: (res: any) => {
        this.isImporting = false;

        const created = Number(res?.created || 0);
        const toCreate = Number(res?.to_create || 0);
        const skipped = Number(res?.skipped || 0);
        const failed = Number(res?.failed || 0);
        const errors = Array.isArray(res?.errors) ? res.errors : [];

        const isDryRun = !!res?.dry_run;
        const title = isDryRun ? 'Validación (sin guardar)' : 'Importación completada';

        let html = `<div style="text-align:left">`;
        html += `<div><b>${isDryRun ? 'Listos para crear' : 'Creados'}:</b> ${isDryRun ? toCreate : created}</div>`;
        html += `<div><b>Saltados:</b> ${skipped}</div>`;
        html += `<div><b>Con error:</b> ${failed}</div>`;

        if (errors.length) {
          const preview = errors.slice(0, 10)
            .map((e: any) => `Fila ${e.row}${e.field ? ' (' + e.field + ')' : ''}: ${e.message}`)
            .join('<br>');
          html += `<hr style="margin:12px 0"/>`;
          html += `<div style="font-size:12px"><b>Errores (primeros ${Math.min(10, errors.length)}):</b><br>${preview}</div>`;
          if (errors.length > 10) {
            html += `<div style="font-size:12px;margin-top:6px">... y ${errors.length - 10} más</div>`;
          }
        }
        html += `</div>`;

        Swal.fire({
          title,
          html,
          icon: failed ? 'warning' : 'success',
          confirmButtonColor: '#d4af37'
        });

        if (!isDryRun && created > 0) {
          this.loadProducts();
        }
      },
      error: (err) => {
        console.error('Error importando productos:', err);
        const msg = err?.error?.error || err?.error?.message || 'No se pudo importar el archivo.';
        Swal.fire('Error', msg, 'error');
        this.isImporting = false;
      }
    });
  }

  generateAI() {
    if (!this.newProduct.nombre) {
      Swal.fire('Atención', 'Para usar la IA, ingresa primero el Nombre del Producto.', 'warning');
      return;
    }
    if (!this.newProduct.notas) {
      Swal.fire('Atención', 'Por favor ingresa unas notas olfativas primero.', 'warning');
      return;
    }

    this.isGeneratingAI = true;
    this.aiService.generateDescription(this.newProduct.nombre, this.newProduct.notas).subscribe({
      next: (res) => {
        this.newProduct.descripcion = res.data;
        this.isGeneratingAI = false;

        // Mostrar alerta bonita y esperar a que el usuario lea
        Swal.fire({
          title: '¡Magia de IA!',
          text: 'La descripción ha sido generada exitosamente. Revísala en el cuadro de texto.',
          icon: 'success',
          confirmButtonText: 'Genial',
          confirmButtonColor: '#d4af37' // gold
        });
      },
      error: (err) => {
        console.error(err);
        Swal.fire('Error', 'Ocurrió un error generando la descripción con IA.', 'error');
        this.isGeneratingAI = false;
      }
    });
  }

  saveProduct() {
    if (!this.newProduct.nombre || !this.newProduct.precio) {
      Swal.fire('Oops...', 'El nombre y el precio son requeridos.', 'warning');
      return;
    }

    this.isSaving = true;
    const formData = new FormData();
    formData.append('nombre', this.newProduct.nombre);
    formData.append('genero', this.newProduct.genero);
    formData.append('casa', String((this.newProduct as any).casa ?? '').trim());
    formData.append('notas', this.newProduct.notas); // Optional frontend detail conceptually mapped to descripcion if needed
    formData.append('descripcion', this.newProduct.descripcion);
    formData.append('precio', this.newProduct.precio.toString());
    formData.append('stock', this.newProduct.stock.toString());
    formData.append('es_nuevo', this.newProduct.esNuevo ? 'true' : 'false');
    // Si viene vacio, el backend lo interpreta como NULL (limpiar)
    formData.append('nuevo_hasta', (this.newProduct.nuevoHasta || '').trim());
    if (this.selectedFile) {
      formData.append('imagen', this.selectedFile);
    }
    if (this.selectedFile2) {
      formData.append('imagen2', this.selectedFile2);
    }
    if (this.selectedFile3) {
      formData.append('imagen3', this.selectedFile3);
    }

    if (this.editingProductId) {
      this.productService.updateProduct(this.editingProductId, formData).subscribe({
        next: () => {
          this.isSaving = false;
          Swal.fire('Actualizado', 'Producto actualizado correctamente', 'success');
          this.loadProducts();
          this.toggleForm();
        },
        error: (err) => {
          console.error(err);
          const errorMsg = err.error?.details ? err.error.details.map((d: any) => `${d.field}: ${d.message}`).join('\n') : err.error?.error || 'Error al actualizar el producto';
          Swal.fire('Error', errorMsg, 'error');
          this.isSaving = false;
        }
      });
    } else {
      this.productService.createProduct(formData).subscribe({
        next: () => {
          this.isSaving = false;
          Swal.fire('Creado', 'Producto creado exitosamente', 'success');
          this.loadProducts();
          this.toggleForm();
        },
        error: (err) => {
          console.error(err);
          const errorMsg = err.error?.details ? err.error.details.map((d: any) => `${d.field}: ${d.message}`).join('\n') : err.error?.error || 'Error al crear el producto';
          Swal.fire('Error', errorMsg, 'error');
          this.isSaving = false;
        }
      });
    }
  }

  editProduct(product: Product) {
    const casaRaw = (product as any).categoria_slug || (product as any).casa || (product as any).house || '';
    this.editingProductId = product.id || null;
    this.newProduct = {
      nombre: product.nombre,
      genero: product.genero || 'unisex',
      casa: this.normalizeHouseKey(casaRaw),
      notas: (product as any).notas_olfativas || '',
      precio: typeof product.precio === 'string' ? parseFloat(product.precio) : (product.precio || 0),
      stock: product.stock,
      descripcion: product.descripcion || '',
      esNuevo: !!product.es_nuevo,
      nuevoHasta: product.nuevo_hasta ? this.toDateTimeLocal(product.nuevo_hasta) : ''
    };
    this.selectedFile = null;
    this.selectedFile2 = null;
    this.selectedFile3 = null;
    this.showForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Funcionalidad Edición Rápida de Stock ---
  startEditStock(product: Product) {
    this.editingStockId = product.id || null;
  }

  cancelEditStock() {
    this.editingStockId = null;
  }

  saveStock(product: Product, newStockStr: string) {
    const newStock = parseInt(newStockStr, 10);
    if (isNaN(newStock) || newStock < 0) {
      Swal.fire('Error', 'El stock debe ser un número válido mayor o igual a cero.', 'warning');
      return;
    }

    if (newStock === product.stock) {
      this.cancelEditStock();
      return; // Sin cambios
    }

    const formData = new FormData();
    formData.append('stock', newStock.toString());

    if (product.id) {
      this.productService.updateProduct(product.id, formData).subscribe({
        next: () => {
          Swal.fire({
            title: 'Stock Actualizado',
            text: `El inventario de "${product.nombre}" ha cambiado a ${newStock} unidades.`,
            icon: 'success',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
          });
          product.stock = newStock; // Actualizar localmente para inmediatez visual
          this.applyProductFilters();
          this.cancelEditStock();
        },
        error: (err) => {
          console.error('Error guardando stock:', err);
          Swal.fire('Error', 'No se pudo actualizar el stock.', 'error');
          this.cancelEditStock();
          this.loadProducts(); // Recargar para volver al valor original en caso de error
        }
      });
    }
  }

  confirmDelete(id: string) {
    this.productToDelete = id;
    this.showDeleteModal = true;
  }

  executeDelete() {
    if (this.productToDelete) {
      this.productService.deleteProduct(this.productToDelete).subscribe({
        next: () => {
          this.loadProducts();
          this.closeDeleteModal();
        },
        error: (err) => {
          console.error('Error deleting product', err);
          alert('No se pudo eliminar el producto');
          this.closeDeleteModal();
        }
      });
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.productToDelete = null;
  }

  resetForm() {
    this.newProduct = { nombre: '', genero: 'unisex', casa: '', notas: '', precio: 0, stock: 0, descripcion: '', esNuevo: false, nuevoHasta: '' };
    this.selectedFile = null;
    this.selectedFile2 = null;
    this.selectedFile3 = null;
    this.editingProductId = null;
  }

  onToggleNuevo(): void {
    if (!this.newProduct.esNuevo) {
      this.newProduct.nuevoHasta = '';
    }
  }

  private toDateTimeLocal(raw: string): string {
    // Soporta ISO o timestamp; devuelve yyyy-MM-ddTHH:mm
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  logout() {
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
