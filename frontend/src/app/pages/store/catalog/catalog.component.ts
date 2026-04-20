import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductCardComponent, Product } from '../../../shared/components/product-card/product-card.component';
import { ProductService } from '../../../core/services/product/product.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import { CategoryService, Category } from '../../../core/services/category/category.service';
import { AnalyticsService } from '../../../core/services/analytics/analytics.service';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, takeUntil, tap } from 'rxjs/operators';

import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductCardComponent, SkeletonCardComponent],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.css']
})
export class CatalogComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly smartSearch$ = new Subject<string>();

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
  houseSearchTerm = '';
  showOnlyPromotions = false;

  smartSearchTerm = '';
  smartSuggestions: any[] = [];
  smartSuggestionsLoading = false;
  showSmartSuggestions = false;
  isSmartLoading = false;

  // Paginacion: siempre 12 por pagina.
  readonly itemsPerPage = 12;
  currentPage = 1;
  totalPages = 1;
  pages: number[] = [];
  private lastFilterKey = '';
  skeletonCards: number[] = Array.from({ length: 12 }, (_, i) => i);


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
      title: 'Lujo&Aroma | Perfumes Bogotá',
      description: 'Explora nuestra colección exclusiva de perfumes originales en Bogotá. Envíos a toda Colombia. Filtra por categoría y encuentra tu aroma ideal.'
    });

    this.initSmartSearch();

    this.loadHouseFilters();
    this.route.queryParams.subscribe(params => {
      this.searchTerm = params['q'] || '';
      this.smartSearchTerm = this.searchTerm;
      const isSmart = params['smart'] === 'true';
      this.selectedCategory = this.normalizeSlug(params['category'] ?? params['house']);
      this.selectedPromotionId = params['promo'] || '';
      const g = String(params['gender'] || '').trim().toLowerCase();
      this.selectedGender = (g === 'mujer' || g === 'hombre' || g === 'unisex') ? (g as any) : 'all';
      this.currentPage = Math.max(1, Math.trunc(Number(params['page'] || 1)));

      // Actualizar SEO inicial
      this.updateCatalogSeo();

      // Make skeleton count match the requested page size.
      const skeletonCount = isSmart && this.searchTerm ? 6 : this.itemsPerPage;
      this.skeletonCards = Array.from({ length: skeletonCount }, (_, i) => i);

      this.fetchProducts();
    });
  }

  private normalizeHouseRows(rows: any[]): Category[] {
    const seen = new Set<string>();
    const blocked = new Set(['mujer', 'hombre', 'unisex']);

    return (rows || [])
      .map((c) => {
        const slug = this.normalizeSlug((c as any)?.slug ?? (c as any)?.casa);
        const nombre = String((c as any)?.nombre ?? (c as any)?.casa ?? '').trim();
        return { ...(c as any), slug, nombre } as Category;
      })
      .filter((c) => {
        if (!c?.slug || c.slug === 'todos') return false;
        if (!String(c?.nombre || '').trim()) return false;
        if (blocked.has(String(c.slug || '').toLowerCase())) return false;
        if (seen.has(c.slug)) return false;
        seen.add(c.slug);
        return true;
      })
      .slice()
      .sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
  }

  private loadHouseFilters(): void {
    this.productService.getPublicHouses().subscribe({
      next: (rows) => {
        const normalized = this.normalizeHouseRows(rows || []);
        if (normalized.length > 0) {
          this.categories = normalized;
          return;
        }

        this.categoryService.getPublicCategories().subscribe({
          next: (fallbackRows) => {
            this.categories = this.normalizeHouseRows(fallbackRows || []);
          },
          error: () => {
            this.categories = [];
          }
        });
      },
      error: () => {
        this.categoryService.getPublicCategories().subscribe({
          next: (rows) => {
            this.categories = this.normalizeHouseRows(rows || []);
          },
          error: () => {
            this.categories = [];
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.setBodyScrollLock(false);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initSmartSearch(): void {
    this.smartSearch$
      .pipe(
        debounceTime(240),
        distinctUntilChanged(),
        tap((term) => {
          if (term.length >= 2) {
            this.smartSuggestionsLoading = true;
            this.showSmartSuggestions = true;
          }
        }),
        switchMap((term) => {
          const q = term.trim();
          if (q.length < 2) {
            return of([] as Product[]);
          }
          // Sugerencias inteligentes activan el refinamiento IA
          return this.productService.searchSuggestions(q, 7, true).pipe(
            catchError(() => of([] as Product[]))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.smartSuggestions = results || [];
        this.smartSuggestionsLoading = false;
        this.showSmartSuggestions = this.smartSearchTerm.trim().length >= 2;
      });
  }

  onSmartSearchInput(): void {
    const term = this.smartSearchTerm.trim();
    if (!term) {
      this.hideSmartSuggestions();
      return;
    }

    this.showSmartSuggestions = true;
    this.smartSearch$.next(term);
  }

  onSmartSearchBlur(): void {
    setTimeout(() => this.hideSmartSuggestions(), 140);
  }

  submitSmartSearch(): void {
    const term = this.smartSearchTerm.trim();
    this.searchTerm = term;
    this.hideSmartSuggestions();
    this.isMobileMenuOpen = false;
    this.setBodyScrollLock(false);
    this.isSmartLoading = true; // Empieza el proceso inteligente
    this.applyFilters();
  }

  clearSmartSearch(): void {
    this.smartSearchTerm = '';
    this.searchTerm = '';
    this.hideSmartSuggestions();
    this.applyFilters();
  }

  pickSmartSuggestion(product: any): void {
    const term = String((product as any)?.name || (product as any)?.nombre || '').trim();
    if (!term) return;
    this.smartSearchTerm = term;
    this.submitSmartSearch();
  }

  hideSmartSuggestions(): void {
    this.smartSuggestions = [];
    this.smartSuggestionsLoading = false;
    this.showSmartSuggestions = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.isMobileMenuOpen) return;
    this.isMobileMenuOpen = false;
    this.setBodyScrollLock(false);
  }

  private setBodyScrollLock(lock: boolean): void {
    if (typeof document === 'undefined') return;
    // Prevent background scroll when the off-canvas is open.
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  private updateCatalogSeo(): void {
    const categoryLabel = this.getCategoryLabel(this.selectedCategory);
    const genderLabel = this.selectedGender !== 'all' ? ` para ${this.getGenderLabel(this.selectedGender)}` : '';
    
    let title = 'Lujo & Aroma | Perfumes Originales';
    let description = 'Descubre nuestra colección exclusiva de perfumes originales en Bogotá y envíos a toda Colombia.';

    if (this.selectedCategory !== 'todos') {
      title = `${categoryLabel}${genderLabel} | Perfumes Originales Lujo & Aroma`;
      description = `Compra perfumes originales de ${categoryLabel}${genderLabel} en Bogotá. Fragancias exclusivas con garantía de autenticidad y envío rápido.`;
    } else if (this.selectedGender !== 'all') {
      title = `Perfumes Originales${genderLabel} | Lujo & Aroma Bogotá`;
      description = `Los mejores perfumes originales${genderLabel} en Bogotá. Encuentra tu esencia ideal en Lujo & Aroma con precios competitivos.`;
    }

    if (this.searchTerm) {
      title = `Resultados para "${this.searchTerm}" | Lujo & Aroma`;
    }

    this.seo.set({ title, description });
    this.injectJsonLd();
    this.updateCanonical();
  }

  private updateCanonical(): void {
    if (typeof window === 'undefined') return;
    const old = document.querySelector('link[rel="canonical"]');
    if (old) old.remove();

    const link: HTMLLinkElement = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    const url = new URL(window.location.href);
    url.searchParams.delete('page'); // Canonical usually doesn't include page
    link.setAttribute('href', url.toString());
    document.head.appendChild(link);
  }

  private injectJsonLd(): void {
    if (typeof window === 'undefined') return;
    
    // Remove old JSON-LD
    const old = document.getElementById('catalog-jsonld');
    if (old) old.remove();

    const script = document.createElement('script');
    script.id = 'catalog-jsonld';
    script.type = 'application/ld+json';
    
    const categoryLabel = this.getCategoryLabel(this.selectedCategory);
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": `Catálogo de Perfumes Originales ${categoryLabel} - Lujo & Aroma`,
      "description": "Tienda online de perfumes originales en Bogotá, Colombia. Fragancias de lujo y casas exclusivas.",
      "url": window.location.href,
      "mainEntity": {
        "@type": "ItemList",
        "itemListElement": this.products.slice(0, 10).map((p, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "item": {
            "@type": "Product",
            "name": p.name,
            "image": p.imageUrl,
            "brand": {
              "@type": "Brand",
              "name": p.casa || 'Lujo & Aroma'
            },
            "offers": {
              "@type": "Offer",
              "price": p.price,
              "priceCurrency": "COP",
              "availability": "https://schema.org/InStock"
            }
          }
        }))
      }
    };

    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }

  private fetchProducts(): void {
    this.loading = true;
    const category = this.selectedCategory !== 'todos' ? this.selectedCategory : null;
    const gender = this.selectedGender !== 'all' ? this.selectedGender : null;
    const isSmart = this.route.snapshot.queryParams['smart'] === 'true';
    const requestLimit = isSmart && this.searchTerm ? 6 : this.itemsPerPage;
    
    // El backend ya filtra por category/house y q. 
    this.productService.getPublicCatalog(this.currentPage, requestLimit, this.searchTerm, { category, gender }, isSmart).subscribe({
      next: (res) => {
        const items = Array.isArray((res as any)?.items) ? (res as any).items : [];
        this.products = items.map((ap: any) => ({
          id: ap.id || '',
          promo_id: (ap as any).promo_id || null,
          name: ap.name || ap.nombre,
          notes: ap.notes || ap.notas_olfativas || ap.descripcion,
          price: ap.price ? Number(ap.price) : (ap.precio_con_descuento ? Number(ap.precio_con_descuento) : (typeof ap.precio === 'string' ? parseFloat(ap.precio) : ap.precio)),
          stock: (() => {
            const n = Number((ap as any)?.stock);
            return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : undefined;
          })(),
          imageUrl: ap.imageUrl || ap.imagen_url || '/assets/images/logo.png',
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

        if (this.showOnlyPromotions) {
          this.products = this.products.filter(p => p.tiene_promocion);
        }

        this.filteredProducts = this.products; 
        this.totalProducts = this.showOnlyPromotions ? this.products.length : Number((res as any)?.total || 0);
        this.totalPages = Math.max(1, Number((res as any)?.totalPages || 1));

        // Guard: if URL has page > totalPages, jump to last page so the catalog
        // never looks "recortado" by showing an empty page.
        if (this.currentPage > this.totalPages) {
          this.setPage(this.totalPages);
          return;
        }
        this.updatePaginationMetadata();
        this.updateCatalogSeo(); // Update SEO with products loaded
        
        this.loading = false;
        this.isSmartLoading = false;

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
        this.isSmartLoading = false;
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
    this.setBodyScrollLock(this.isMobileMenuOpen);
  }

  clearFilters(): void {
    this.isMobileMenuOpen = false;
    this.setBodyScrollLock(false);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: null, gender: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  filterCategory(category: string) {
    this.isMobileMenuOpen = false; // Close menu on selection
    this.setBodyScrollLock(false);
    const normalized = this.normalizeSlug(category);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: normalized !== 'todos' ? normalized : null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  filterGender(gender: 'all' | 'mujer' | 'hombre' | 'unisex') {
    this.isMobileMenuOpen = false;
    this.setBodyScrollLock(false);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { gender: gender !== 'all' ? gender : null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  togglePromotions() {
    this.showOnlyPromotions = !this.showOnlyPromotions;
    this.fetchProducts();
  }

  get filteredHouses(): Category[] {
    if (!this.houseSearchTerm.trim()) return this.categories;
    const term = this.normalizeText(this.houseSearchTerm);
    return this.categories.filter(c => 
      this.normalizeText(c.nombre).includes(term) || 
      this.normalizeText(c.slug).includes(term)
    );
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
        smart: this.searchTerm ? 'true' : null, // Activar modo IA si hay busqueda
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
