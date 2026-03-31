import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductCardComponent, Product } from '../../../shared/components/product-card/product-card.component';
import { ProductService } from '../../../core/services/product/product.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import { CategoryService, Category } from '../../../core/services/category/category.service';
import { AnalyticsService } from '../../../core/services/analytics/analytics.service';

import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductCardComponent, SkeletonCardComponent],
  templateUrl: './catalog.component.html'
})
export class CatalogComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  loading = true;
  error = '';
  // category = Casa (marca)
  selectedCategory = 'todos';
  selectedGender: 'all' | 'mujer' | 'hombre' | 'unisex' = 'all';
  searchTerm = '';
  selectedPromotionId = '';
  isMobileMenuOpen = false;
  totalProducts = 0;
  private lastTrackedSearch = '';

  categories: Category[] = [];

  // Paginacion (cliente)
  // En categorias (filtro activo): 4 columnas (lg) x 3 filas = 12 productos.
  // En "Ver todo": se muestran mas por pagina.
  pageSizeAll = 24;
  pageSizeCategory = 12;
  currentPage = 1;
  totalPages = 1;
  pages: number[] = [];
  private lastFilterKey = '';
  skeletonCards: number[] = Array.from({ length: 24 }, (_, i) => i);

  private get effectivePageSize(): number {
    return (this.selectedCategory && this.selectedCategory !== 'todos')
      ? this.pageSizeCategory
      : this.pageSizeAll;
  }


  private searchIndexCache = new Map<string, string>();

  private normalizeSlug(raw: any): string {
    const v = String(raw ?? '').trim().toLowerCase();
    if (!v || v === 'null' || v === 'undefined') return 'todos';
    return v;
  }

  private normalizeText(raw: any): string {
    const s = String(raw ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return s
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private getSearchIndex(p: Product): string {
    const id = String((p as any)?.id || '');
    if (id && this.searchIndexCache.has(id)) return this.searchIndexCache.get(id) as string;

    const anyP: any = p as any;
    const blob = [
      anyP?.name,
      anyP?.nombre,
      anyP?.notes,
      anyP?.notas_olfativas,
      anyP?.descripcion,
      anyP?.casa,
      anyP?.house,
      anyP?.categoria_nombre,
      anyP?.categoria_slug,
      anyP?.genero,
    ].filter(Boolean).join(' ');

    const idx = this.normalizeText(blob);
    if (id) this.searchIndexCache.set(id, idx);
    return idx;
  }

  private levenshteinWithin(a: string, b: string, maxDist: number): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > maxDist) return false;

    // DP with early exit.
    const prev = new Array<number>(lb + 1);
    const curr = new Array<number>(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;

    for (let i = 1; i <= la; i++) {
      curr[0] = i;
      let rowMin = curr[0];
      const ca = a.charCodeAt(i - 1);
      for (let j = 1; j <= lb; j++) {
        const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        const del = prev[j] + 1;
        const ins = curr[j - 1] + 1;
        const sub = prev[j - 1] + cost;
        const v = Math.min(del, ins, sub);
        curr[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > maxDist) return false;
      for (let j = 0; j <= lb; j++) prev[j] = curr[j];
    }

    return prev[lb] <= maxDist;
  }

  private fuzzyTokenMatch(token: string, words: string[]): boolean {
    // Keep fuzzy matching conservative to avoid false positives.
    if (!token) return true;
    if (/^\d+$/.test(token)) return words.includes(token);
    if (token.length < 4) return words.some(w => w.startsWith(token));

    const maxDist = token.length <= 6 ? 1 : 2;
    const first = token.charAt(0);
    for (const w of words) {
      if (!w) continue;
      if (w === token) return true;
      if (w.startsWith(token) || token.startsWith(w)) return true;
      if (w.charAt(0) !== first) continue;
      if (this.levenshteinWithin(token, w, maxDist)) return true;
    }
    return false;
  }

  private matchesQuery(p: Product, query: string, tokens: string[]): boolean {
    const hay = this.getSearchIndex(p);
    if (!hay) return false;
    if (hay.includes(query)) return true;

    // Require all tokens to match (either exact in blob or fuzzy in name tokens).
    const nameWords = this.normalizeText((p as any)?.name || (p as any)?.nombre || '').split(' ').filter(Boolean);
    return tokens.every(t => hay.includes(t) || this.fuzzyTokenMatch(t, nameWords));
  }

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
      title: 'Catálogo de Perfumes en Bogotá | Lujo & Aroma',
      description: 'Explora nuestra colección exclusiva de perfumes originales en Bogotá. Envíos a toda Colombia. Filtra por categoría y encuentra tu aroma ideal.'
    });

    this.categoryService.getPublicCategories().subscribe({
      next: (rows) => {
        const seen = new Set<string>();
        const blocked = new Set(['mujer', 'hombre', 'unisex']);
        this.categories = (rows || [])
          .map((c) => {
            const slug = this.normalizeSlug((c as any)?.slug);
            return { ...c, slug } as Category;
          })
          .filter((c) => {
            if (!c?.slug || c.slug === 'todos') return false;
            if (blocked.has(String(c.slug || '').toLowerCase())) return false;
            if (seen.has(c.slug)) return false;
            seen.add(c.slug);
            return true;
          })
          .slice()
          .sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
      },
      error: () => {
        this.categories = [];
      }
    });

    this.route.queryParams.subscribe(params => {
      this.searchTerm = params['q'] || '';
      this.selectedCategory = this.normalizeSlug(params['category'] ?? params['house']);
      this.selectedPromotionId = params['promo'] || '';
      const g = String(params['gender'] || '').trim().toLowerCase();
      this.selectedGender = (g === 'mujer' || g === 'hombre' || g === 'unisex') ? (g as any) : 'all';
      this.currentPage = Math.max(1, Math.trunc(Number(params['page'] || 1)));

      this.fetchProducts();
    });
  }

  private fetchProducts(): void {
    this.loading = true;
    this.productService.getPublicCatalog(this.currentPage, this.effectivePageSize, this.searchTerm).subscribe({
      next: (res) => {
        const items = Array.isArray((res as any)?.items) ? (res as any).items : [];
        this.products = items.map((ap: any) => ({
          id: ap.id || '',
          promo_id: (ap as any).promo_id || null,
          name: ap.name || ap.nombre,
          notes: ap.notes || ap.notas_olfativas || ap.descripcion,
          price: ap.price ? Number(ap.price) : (ap.precio_con_descuento ? Number(ap.precio_con_descuento) : (typeof ap.precio === 'string' ? parseFloat(ap.precio) : ap.precio)),
          imageUrl: ap.imageUrl || ap.imagen_url || 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=800&auto=format&fit=crop',
          soldCount: (ap.soldCount || ap.unidades_vendidas || 0).toString(),
          isNew: !!(ap.isNew ?? ap.es_nuevo),
          genero: ap.genero,
          casa: (ap as any).casa ?? (ap as any).house ?? null,
          house: (ap as any).house ?? (ap as any).casa ?? null,
          categoria_nombre: (ap as any).categoria_nombre ?? null,
          categoria_slug: (ap as any).categoria_slug ?? null,
          precio: (() => {
            const original = (ap as any).precio_original ?? ap.precio;
            return typeof original === 'string' ? parseFloat(original) : original;
          })(),
          precio_con_descuento: ap.precio_con_descuento !== null && ap.precio_con_descuento !== undefined ? Number(ap.precio_con_descuento) : null,
          tiene_promocion: ap.tiene_promocion || false
        }));

        this.filteredProducts = this.products; // Server already filtered
        this.totalProducts = Number((res as any)?.total || 0);
        this.totalPages = Number((res as any)?.totalPages || 1);
        this.updatePaginationMetadata();
        
        this.loading = false;

        const trimmed = String(this.searchTerm || '').trim();
        if (trimmed && trimmed !== this.lastTrackedSearch) {
          const ids = this.products.slice(0, 10).map(p => p.id).filter(Boolean);
          this.analyticsService.trackSearch(trimmed, ids, this.totalProducts);
          this.lastTrackedSearch = trimmed;
        }
      },
      error: (err) => {
        console.error(err);
        this.error = 'Error cargando el catálogo.';
        this.loading = false;
      }
    });
  }

  private updatePaginationMetadata(): void {
    // Construir rango de paginas (max 7)
    const windowSize = 7;
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, this.currentPage - half);
    let end = Math.min(this.totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);

    const arr: number[] = [];
    for (let p = start; p <= end; p++) arr.push(p);
    this.pages = arr;
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  clearFilters(): void {
    this.isMobileMenuOpen = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: null, gender: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  filterCategory(category: string) {
    this.isMobileMenuOpen = false; // Close menu on selection
    const normalized = this.normalizeSlug(category);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: normalized !== 'todos' ? normalized : null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  filterGender(gender: 'all' | 'mujer' | 'hombre' | 'unisex') {
    this.isMobileMenuOpen = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { gender: gender !== 'all' ? gender : null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  getCategoryLabel(slugRaw: string): string {
    const slug = String(slugRaw || '').trim().toLowerCase();
    if (!slug || slug === 'todos') return 'Todo';
    const match = (this.categories || []).find(c => String(c.slug || '').toLowerCase() === slug);
    if (match?.nombre) return match.nombre;
    return slug
      .split('-')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  getGenderLabel(slugRaw: string): string {
    const slug = String(slugRaw || '').trim().toLowerCase();
    if (!slug || slug === 'todos' || slug === 'all') return 'Todo';

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
    // With server-side pagination, applyFilters just re-fetches from server
    this.currentPage = 1;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { 
        page: null,
        q: this.searchTerm || null,
        category: this.selectedCategory !== 'todos' ? this.selectedCategory : null,
        gender: this.selectedGender !== 'all' ? this.selectedGender : null
      },
      queryParamsHandling: 'merge',
    });
  }

  get paginatedProducts(): Product[] {
    return this.products; // Server already paginated
  }

  setPage(page: number): void {
    const next = Math.max(1, Math.min(this.totalPages || 1, Math.trunc(Number(page || 1))));
    this.currentPage = next;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: next > 1 ? next : null },
      queryParamsHandling: 'merge',
    });
  }

  private updatePagination(): void {
    // This is now partially handled by updatePaginationMetadata from server response
  }
}
