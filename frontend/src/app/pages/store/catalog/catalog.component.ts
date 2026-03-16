import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductCardComponent, Product } from '../../../shared/components/product-card/product-card.component';
import { ProductService } from '../../../core/services/product/product.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import { CategoryService, Category } from '../../../core/services/category/category.service';
import { AnalyticsService } from '../../../core/services/analytics/analytics.service';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './catalog.component.html'
})
export class CatalogComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  loading = true;
  error = '';
  selectedCategory = 'todos';
  searchTerm = '';
  selectedPromotionId = '';
  private lastTrackedSearch = '';


  categories: Category[] = [];

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private route: ActivatedRoute,
    private router: Router,
    private seo: SeoService,
    private analyticsService: AnalyticsService
  ) { }

  ngOnInit(): void {
    this.seo.set({
      title: 'Catalogo | Perfumissimo',
      description: 'Explora perfumes para mujer, hombre y unisex. Filtra por categoria y encuentra tu aroma ideal.'
    });

    this.categoryService.getPublicCategories().subscribe({
      next: (rows) => {
        this.categories = (rows || []).slice().sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
      },
      error: () => {
        this.categories = [];
      }
    });

    this.productService.getPublicCatalog().subscribe({
      next: (apiProducts) => {
        this.products = apiProducts.map(ap => ({
          // Precio final (con promo si aplica) en `price` para el carrito
          id: ap.id || '',
          promo_id: (ap as any).promo_id || null,
          name: ap.name || ap.nombre,
          notes: ap.notes || ap.notas_olfativas || ap.descripcion,
          price: ap.price ? Number(ap.price) : (ap.precio_con_descuento ? Number(ap.precio_con_descuento) : (typeof ap.precio === 'string' ? parseFloat(ap.precio) : ap.precio)),
          imageUrl: ap.imageUrl || ap.imagen_url || 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=800&auto=format&fit=crop',
          soldCount: (ap.soldCount || ap.unidades_vendidas || 0).toString(),
          isNew: !!(ap.isNew ?? ap.es_nuevo),
          genero: ap.genero,
          categoria_nombre: (ap as any).categoria_nombre ?? null,
          categoria_slug: (ap as any).categoria_slug ?? null,
          precio: (() => {
            const original = (ap as any).precio_original ?? ap.precio;
            return typeof original === 'string' ? parseFloat(original) : original;
          })(),
          precio_con_descuento: ap.precio_con_descuento !== null && ap.precio_con_descuento !== undefined ? Number(ap.precio_con_descuento) : null,
          tiene_promocion: ap.tiene_promocion || false
        }));

        this.route.queryParams.subscribe(params => {
          this.searchTerm = params['q'] || '';
          this.selectedCategory = params['category'] || 'todos';
          this.selectedPromotionId = params['promo'] || '';
          this.applyFilters();

          const searchKey = `${this.searchTerm}|${this.selectedCategory}|${this.selectedPromotionId}`;
          const trimmed = String(this.searchTerm || '').trim();
          if (trimmed && searchKey !== this.lastTrackedSearch) {
            const ids = (this.filteredProducts || []).slice(0, 10).map(p => p.id).filter(Boolean);
            this.analyticsService.trackSearch(trimmed, ids, this.filteredProducts.length);
            this.lastTrackedSearch = searchKey;
          }

          const parts: string[] = [];
          if (this.selectedCategory && this.selectedCategory !== 'todos') {
            parts.push(this.getCategoryLabel(this.selectedCategory));
          }
          if (this.searchTerm && String(this.searchTerm).trim()) {
            parts.push(`Busqueda: ${String(this.searchTerm).trim()}`);
          }
          if (this.selectedPromotionId) {
            parts.push('Promocion');
          }

          const suffix = parts.length ? ` (${parts.join(' · ')})` : '';
          this.seo.set({
            title: `Catalogo${suffix} | Perfumissimo`,
            description: 'Explora perfumes para mujer, hombre y unisex. Filtra por categoria y encuentra tu aroma ideal.'
          });
        });

        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Error cargando el catálogo.';
        this.loading = false;
      }
    });
  }

  filterCategory(category: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: category !== 'todos' ? category : null },
      queryParamsHandling: 'merge',
    });
  }

  getCategoryLabel(slugRaw: string): string {
    const slug = String(slugRaw || '').trim().toLowerCase();
    if (!slug || slug === 'todos') return 'Todo';

    const match = (this.categories || []).find(c => String(c.slug || '').toLowerCase() === slug);
    if (match?.nombre) return match.nombre;

    if (slug === 'mujer') return 'Mujer';
    if (slug === 'hombre') return 'Hombre';
    if (slug === 'unisex') return 'Unisex';

    return slug
      .split('-')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  applyFilters() {
    let result = this.products;

    if (this.selectedPromotionId) {
      result = result.filter(p => (p as any).promo_id === this.selectedPromotionId);
    }

    if (this.selectedCategory && this.selectedCategory !== 'todos') {
      result = result.filter(p => p.genero === this.selectedCategory);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.trim().toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.notes.toLowerCase().includes(term)
      );
    }

    this.filteredProducts = result;
  }
}
