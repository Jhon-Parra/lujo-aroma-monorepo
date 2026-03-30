import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PromotionService, Promotion } from '../../../core/services/promotion/promotion.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProductService, Product as ApiProduct } from '../../../core/services/product/product.service';
import { CategoryService, Category } from '../../../core/services/category/category.service';
import { LowStockBellComponent } from '../../../shared/components/low-stock-bell/low-stock-bell.component';
import { ToastService } from '../../../shared/components/toast/toast.service';

type PromotionForm = {
  nombre: string;
  descripcion: string;
  discount_type?: 'PERCENT' | 'AMOUNT';
  porcentaje_descuento: number;
  amount_discount?: number | null;
  priority?: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;

  product_scope: 'GLOBAL' | 'SPECIFIC' | 'GENDER';
  // Cuando product_scope = 'GENDER', guarda el slug de categoria
  product_gender: string;
  product_ids: string[];

  audience_scope: 'ALL' | 'SEGMENT' | 'CUSTOMERS';
  audience_segment: string;
  audience_user_ids: string[];
};

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LowStockBellComponent],
  templateUrl: './promotions.component.html',
  styleUrls: ['./promotions.component.css']
})
export class PromotionsComponent implements OnInit {
  promotions: Promotion[] = [];
  loading = true;
  error = '';

  allProducts: ApiProduct[] = [];
  productSearch = '';
  userIdsText = '';

  categories: Category[] = [];
  categoriesSupported = false;

  imageFile: File | null = null;
  imagePreviewUrl: string | null = null;

  showForm = false;
  editingId: string | null = null;
  saving = false;

  form: PromotionForm = {
    nombre: '',
    descripcion: '',
    discount_type: 'PERCENT',
    porcentaje_descuento: 0,
    amount_discount: null,
    priority: 0,
    fecha_inicio: '',
    fecha_fin: '',
    activo: true,

    product_scope: 'GLOBAL',
    product_gender: '',
    product_ids: [],

    audience_scope: 'ALL',
    audience_segment: '',
    audience_user_ids: []
  };

  constructor(
    private promotionService: PromotionService,
    private authService: AuthService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.promotionService.getAdminPromotions().subscribe({
      next: (data) => {
        this.promotions = (data || []).slice().sort((a, b) => {
          const prio = Number((b as any).priority || 0) - Number((a as any).priority || 0);
          if (prio !== 0) return prio;
          const aTime = new Date(a.fecha_inicio).getTime();
          const bTime = new Date(b.fecha_inicio).getTime();
          return bTime - aTime;
        });
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando promociones:', err);
        this.error = 'No se pudieron cargar las promociones.';
        this.loading = false;
      }
    });

    // Productos para selector (cuando alcance es especifico)
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.allProducts = products || [];
      },
      error: (err) => {
        console.error('Error cargando productos:', err);
      }
    });

    // Categorias para selector (cuando alcance es por categoria)
    this.categoryService.getAdminCategories().subscribe({
      next: (rows) => {
        this.categories = (rows || []).slice().sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
        this.categoriesSupported = this.categories.length > 0;
      },
      error: () => {
        this.categories = [];
        this.categoriesSupported = false;
      }
    });
  }

  openNew(): void {
    this.editingId = null;
    this.userIdsText = '';
    this.imageFile = null;
    this.imagePreviewUrl = null;
    this.form = {
      nombre: '',
      descripcion: '',
      discount_type: 'PERCENT',
      porcentaje_descuento: 0,
      amount_discount: null,
      priority: 0,
      fecha_inicio: '',
      fecha_fin: '',
      activo: true,

      product_scope: 'GLOBAL',
      product_gender: '',
      product_ids: [],

      audience_scope: 'ALL',
      audience_segment: '',
      audience_user_ids: []
    };
    this.showForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openEdit(promo: Promotion): void {
    this.editingId = promo.id;
    const productIds = Array.isArray(promo.product_ids) ? promo.product_ids : [];
    const audienceUserIds = Array.isArray(promo.audience_user_ids) ? promo.audience_user_ids : [];
    this.userIdsText = audienceUserIds.join('\n');
    this.imageFile = null;
    this.imagePreviewUrl = promo.imagen_url || null;
    this.form = {
      nombre: promo.nombre,
      descripcion: promo.descripcion || '',
      discount_type: ((promo as any).discount_type || 'PERCENT') as any,
      porcentaje_descuento: Number(promo.porcentaje_descuento || 0),
      amount_discount: (promo as any).amount_discount !== undefined && (promo as any).amount_discount !== null ? Number((promo as any).amount_discount) : null,
      priority: (promo as any).priority !== undefined && (promo as any).priority !== null ? Number((promo as any).priority) : 0,
      // Para datetime-local, lo mas estable es cortar a minutos
      fecha_inicio: this.toDateTimeLocal(promo.fecha_inicio),
      fecha_fin: this.toDateTimeLocal(promo.fecha_fin),
      activo: !!promo.activo,

      product_scope: (promo.product_scope || 'GLOBAL') as any,
      product_gender: String((promo as any).product_gender || ''),
      product_ids: productIds,

      audience_scope: (promo.audience_scope || 'ALL') as any,
      audience_segment: promo.audience_segment || '',
      audience_user_ids: audienceUserIds
    };
    this.showForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancel(): void {
    this.showForm = false;
    this.editingId = null;
    this.imageFile = null;
    this.imagePreviewUrl = null;
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    this.imageFile = file;
    this.imagePreviewUrl = URL.createObjectURL(file);
  }

  save(): void {
    // Normalizar ids de usuarios desde textarea
    if (this.form.audience_scope === 'CUSTOMERS') {
      const ids = this.userIdsText
        .split(/\s|,|;/)
        .map(s => s.trim())
        .filter(Boolean);
      this.form.audience_user_ids = Array.from(new Set(ids));
    } else {
      this.form.audience_user_ids = [];
    }

    if (!this.form.nombre.trim()) {
      this.error = 'El nombre es requerido.';
      return;
    }

    const dtype = String(this.form.discount_type || 'PERCENT').toUpperCase();
    if (dtype === 'AMOUNT') {
      const amount = Number(this.form.amount_discount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        this.error = 'El monto de descuento debe ser mayor a 0.';
        return;
      }
      this.form.porcentaje_descuento = 0;
    } else {
      if (this.form.porcentaje_descuento < 0 || this.form.porcentaje_descuento > 100) {
        this.error = 'El porcentaje debe estar entre 0 y 100.';
        return;
      }
      if (Number(this.form.porcentaje_descuento || 0) <= 0) {
        this.error = 'El porcentaje de descuento debe ser mayor a 0.';
        return;
      }
      this.form.amount_discount = null;
    }

    if (!this.form.fecha_inicio || !this.form.fecha_fin) {
      this.error = 'Debes definir fecha de inicio y fin.';
      return;
    }

    if (this.form.product_scope === 'SPECIFIC' && this.form.product_ids.length === 0) {
      this.error = 'Debes seleccionar al menos un producto.';
      return;
    }

    if (this.form.product_scope === 'GENDER' && !this.form.product_gender) {
      this.error = 'Debes seleccionar una categoria.';
      return;
    }

    if (this.form.audience_scope === 'SEGMENT' && !this.form.audience_segment.trim()) {
      this.error = 'Debes definir el segmento.';
      return;
    }

    if (this.form.audience_scope === 'CUSTOMERS' && this.form.audience_user_ids.length === 0) {
      this.error = 'Debes ingresar al menos un ID de cliente.';
      return;
    }

    this.saving = true;
    this.error = '';

    const formData = new FormData();
    formData.append('nombre', this.form.nombre.trim());
    formData.append('descripcion', this.form.descripcion?.trim() || '');
    formData.append('porcentaje_descuento', String(Number(this.form.porcentaje_descuento)));

    const prio = Math.max(0, Math.trunc(Number(this.form.priority || 0)));
    const sendAdvanced = dtype === 'AMOUNT' || prio > 0;
    if (sendAdvanced) {
      formData.append('discount_type', dtype);
      formData.append('priority', String(prio));
      if (dtype === 'AMOUNT') {
        formData.append('amount_discount', String(Number(this.form.amount_discount || 0)));
      }
    }

    formData.append('fecha_inicio', this.form.fecha_inicio);
    formData.append('fecha_fin', this.form.fecha_fin);
    formData.append('activo', String(!!this.form.activo));

    formData.append('product_scope', this.form.product_scope);
    if (this.form.product_scope === 'GENDER') {
      formData.append('product_gender', this.form.product_gender);
    }
    formData.append('product_ids', JSON.stringify(this.form.product_scope === 'SPECIFIC' ? this.form.product_ids : []));

    formData.append('audience_scope', this.form.audience_scope);
    if (this.form.audience_scope === 'SEGMENT') {
      formData.append('audience_segment', this.form.audience_segment.trim());
    }
    formData.append('audience_user_ids', JSON.stringify(this.form.audience_scope === 'CUSTOMERS' ? this.form.audience_user_ids : []));

    if (this.imageFile) {
      formData.append('imagen', this.imageFile);
    }

    if (this.editingId) {
      this.promotionService.updatePromotion(this.editingId, formData).subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.editingId = null;
          this.load();
        },
        error: (err) => {
          console.error('Error actualizando promocion:', err);
          this.error = err?.error?.error || 'No se pudo actualizar la promocion.';
          this.saving = false;
        }
      });
      return;
    }

    this.promotionService.createPromotion(formData).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.load();
      },
      error: (err) => {
        console.error('Error creando promocion:', err);
        this.error = err?.error?.error || 'No se pudo crear la promocion.';
        this.saving = false;
      }
    });
  }

  toggleActive(promo: Promotion): void {
    const nextActive = !promo.activo;

    // Si se intenta activar una ya vencida, consultamos si quiere reactivarla (añadir 7 días)
    if (nextActive) {
      const status = this.getPromotionStatus(promo);
      if (status === 'EXPIRADA') {
        const ok = confirm('Esta promoción ya expiró. ¿Deseas reactivarla extendiendo su fecha de fin por 7 días?');
        if (ok) {
          this.reactivatePromotion(promo);
          return;
        } else {
          this.toastService.warning('No se puede activar una promoción vencida sin actualizar sus fechas.');
          return;
        }
      }
    }

    this.promotionService.setActive(promo.id, nextActive).subscribe({
      next: () => {
        promo.activo = nextActive;
        this.load();
        this.toastService.success(`Promoción ${nextActive ? 'activada' : 'desactivada'} correctamente.`);
      },
      error: (err) => {
        console.error('Error cambiando estado promo:', err);
        this.toastService.error(err?.error?.error || 'No se pudo cambiar el estado.');
      }
    });
  }

  reactivatePromotion(promo: Promotion): void {
    const now = new Date();
    const newEnd = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    const isoEnd = newEnd.toISOString();

    const formData = new FormData();
    formData.append('fecha_fin', isoEnd);
    formData.append('activo', 'true');

    this.saving = true;
    this.promotionService.updatePromotion(promo.id, formData).subscribe({
      next: () => {
        this.saving = false;
        this.toastService.success('Promoción reactivada por 7 días más.');
        this.load();
      },
      error: (err) => {
        this.saving = false;
        console.error('Error reactivando promo:', err);
        this.toastService.error('No se pudo reactivar la promoción.');
      }
    });
  }

  delete(promo: Promotion): void {
    const ok = confirm(`Eliminar la promocion "${promo.nombre}"?`);
    if (!ok) return;

    this.promotionService.deletePromotion(promo.id).subscribe({
      next: () => this.load(),
      error: (err) => {
        console.error('Error eliminando promo:', err);
        this.error = 'No se pudo eliminar la promocion.';
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }

  isActiveNow(p: Promotion): boolean {
    if (!p.activo) return false;
    const now = Date.now();
    const start = new Date(p.fecha_inicio).getTime();
    const end = new Date(p.fecha_fin).getTime();
    return now >= start && now <= end;
  }

  getPromotionStatus(p: Promotion): 'ACTIVA' | 'EXPIRADA' | 'PROGRAMADA' | 'DESACTIVADA' {
    if (!p.activo) return 'DESACTIVADA';
    const now = Date.now();
    const start = new Date(p.fecha_inicio).getTime();
    const end = new Date(p.fecha_fin).getTime();

    if (now < start) return 'PROGRAMADA';
    if (now > end) return 'EXPIRADA';
    return 'ACTIVA';
  }

  getStatusLabel(p: Promotion): string {
    const status = this.getPromotionStatus(p);
    switch (status) {
      case 'ACTIVA': return 'Activa';
      case 'EXPIRADA': return 'Expirada';
      case 'PROGRAMADA': return 'Programada';
      case 'DESACTIVADA': return 'Desactivada';
      default: return 'Desconocido';
    }
  }

  getStatusClass(p: Promotion): string {
    const status = this.getPromotionStatus(p);
    switch (status) {
      case 'ACTIVA': return 'bg-green-100 text-green-800 border-green-200';
      case 'EXPIRADA': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'PROGRAMADA': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DESACTIVADA': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  toggleProduct(productId: string): void {
    if (!productId) return;
    if (this.form.product_ids.includes(productId)) {
      this.form.product_ids = this.form.product_ids.filter((id) => id !== productId);
      return;
    }
    this.form.product_ids = [...this.form.product_ids, productId];
  }

  get filteredProducts(): ApiProduct[] {
    const term = this.productSearch.trim().toLowerCase();
    if (!term) return this.allProducts;
    return this.allProducts.filter(p => (p.nombre || '').toLowerCase().includes(term));
  }

  private toDateTimeLocal(value: string): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
