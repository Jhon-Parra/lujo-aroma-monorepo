import {
  Component,
  OnDestroy,
  OnInit,
  HostListener,
  ElementRef,
  inject
} from '@angular/core';
import {
  RouterLink,
  Router,
  NavigationEnd,
  RouterLinkActive
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Observable,
  Subject,
  of
} from 'rxjs';
import {
  filter,
  map,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  takeUntil,
  tap
} from 'rxjs/operators';

import { CartService, CartItem } from '../../../core/services/cart/cart.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsService, Settings } from '../../../core/services/settings/settings.service';
import { ProductService, Product } from '../../../core/services/product/product.service';
import { LowStockBellComponent } from '../low-stock-bell/low-stock-bell.component';
import { API_CONFIG } from '../../../core/config/api-config';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    CommonModule,
    FormsModule,
    LowStockBellComponent
  ],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<string>();

  private forceLocalLogo = false;

  // Logo recortado para ignorar padding transparente del archivo.
  private trimmedLogoUrl: string | null = null;
  private trimmedLogoSrc: string | null = null;
  private trimInFlightSrc: string | null = null;
  private readonly trimCache = new Map<string, string>();

  cartItemCount$!: Observable<number>;
  cartItems$!: Observable<CartItem[]>;
  favoritesCount$!: Observable<number>;

  settings: Settings | null = null;

  searchTerm = '';
  isAdminRoute = false;
  mobileMenuOpen = false;
  mobileSearchOpen = false;

  suggestions: Product[] = [];
  suggestionsLoading = false;
  showSuggestions = false;

  private readonly cartService = inject(CartService);
  private readonly favoritesService = inject(FavoritesService);
  readonly authService = inject(AuthService);
  private readonly settingsService = inject(SettingsService);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  private readonly elRef = inject(ElementRef);

  constructor() {
    this.cartItemCount$ = this.cartService.items$.pipe(
      map((items) => items.reduce((acc, item) => acc + item.quantity, 0))
    );

    this.cartItems$ = this.cartService.items$;

    this.favoritesCount$ = this.favoritesService.favorites$.pipe(
      map((items) => items.length)
    );
  }

  ngOnInit(): void {
    this.initSettings();
    this.initRouterListener();
    this.initSearchAutocomplete();
    this.isAdminRoute = this.router.url.startsWith('/admin');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================================================
  // INIT
  // =========================================================
  private initSettings(): void {
    this.settingsService.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        if (!settings) return;
        this.settings = settings;
        this.forceLocalLogo = false;
      });

    this.settingsService.getSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.settings = data;
          this.forceLocalLogo = false;
        },
        error: (err) => {
          console.error('Error cargando configuraciones', err);
        }
      });
  }

  private initRouterListener(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        this.isAdminRoute = event.urlAfterRedirects.startsWith('/admin');
        this.mobileMenuOpen = false;
        this.mobileSearchOpen = false;
        this.closeSuggestions();
      });
  }

  private initSearchAutocomplete(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((term) => {
          if (term.length >= 2) {
            this.suggestionsLoading = true;
          }
        }),
        switchMap((term) => {
          if (term.length < 2) {
            this.resetSuggestionsState();
            return of([]);
          }

          return this.productService.searchSuggestions(term, 6).pipe(
            catchError(() => of([]))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results: Product[]) => {
        this.suggestions = (results || []).slice(0, 6);
        this.suggestionsLoading = false;
        this.showSuggestions =
          this.searchTerm.trim().length >= 2 &&
          (this.suggestions.length > 0 || !this.suggestionsLoading);
      });
  }

  // =========================================================
  // SEARCH
  // =========================================================
  onSearchInput(): void {
    const term = this.searchTerm.trim();

    if (!term) {
      this.closeSuggestions();
      return;
    }

    this.showSuggestions = true;
    this.searchSubject.next(term);
  }

  onSearch(): void {
    const term = this.searchTerm.trim();
    if (!term) return;

    this.router.navigate(['/catalog'], {
      queryParams: { q: term },
      queryParamsHandling: 'merge'
    });

    this.searchTerm = '';
    this.mobileMenuOpen = false;
    this.mobileSearchOpen = false;
    this.closeSuggestions();
  }

  selectSuggestion(product: Product): void {
    const slug = product.slug || product.id;

    if (slug) {
      this.router.navigate(['/products', slug]);
    }

    this.searchTerm = '';
    this.mobileSearchOpen = false;
    this.mobileMenuOpen = false;
    this.closeSuggestions();
  }

  closeSuggestions(): void {
    this.resetSuggestionsState();
  }

  private resetSuggestionsState(): void {
    this.suggestions = [];
    this.suggestionsLoading = false;
    this.showSuggestions = false;
  }

  // =========================================================
  // MOBILE
  // =========================================================
  toggleMobileMenu(): void {
    if (this.isAdminRoute) return;

    this.mobileMenuOpen = !this.mobileMenuOpen;

    if (this.mobileMenuOpen) {
      this.mobileSearchOpen = false;
    }
  }

  toggleMobileSearch(): void {
    if (this.isAdminRoute) return;

    this.mobileSearchOpen = !this.mobileSearchOpen;

    if (this.mobileSearchOpen) {
      this.mobileMenuOpen = false;
    }
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  filterByPromotions(): void {
    this.router.navigate(['/promotions']);
    this.mobileMenuOpen = false;
    this.mobileSearchOpen = false;
  }

  // =========================================================
  // AUTH
  // =========================================================
  logout(): void {
    this.authService.logout();
    this.mobileMenuOpen = false;
    this.mobileSearchOpen = false;
    this.closeSuggestions();
  }

  // =========================================================
  // CLICK OUTSIDE
  // =========================================================
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.closeSuggestions();
    }
  }

  // =========================================================
  // LOGO
  // =========================================================
  getLogoUrl(): string {
    const src = this.forceLocalLogo
      ? 'assets/images/logo.svg'
      : this.resolveLogoUrl(this.settings?.logo_url);

    // Si ya lo recortamos (sin espacios transparentes), usarlo.
    if (this.trimmedLogoSrc === src && this.trimmedLogoUrl) {
      return this.trimmedLogoUrl;
    }

    // Cache inmediato.
    const cached = this.trimCache.get(src);
    if (cached) {
      this.trimmedLogoSrc = src;
      this.trimmedLogoUrl = cached;
      return cached;
    }

    // Recorte async: evita repetir trabajo en cada change detection.
    if (this.trimInFlightSrc !== src) {
      this.trimInFlightSrc = src;
      this.trimmedLogoSrc = src;
      this.trimmedLogoUrl = null;

      void this.trimTransparentPadding(src)
        .then((trimmed) => {
          if (!trimmed) return;
          this.trimCache.set(src, trimmed);
          if (this.trimmedLogoSrc === src) {
            this.trimmedLogoUrl = trimmed;
          }
        })
        .catch(() => {})
        .finally(() => {
          if (this.trimInFlightSrc === src) this.trimInFlightSrc = null;
        });
    }

    return src;
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement | null;

    if (img?.src?.includes('/assets/images/logo.svg')) return;

    this.forceLocalLogo = true;
    this.trimmedLogoUrl = null;
    this.trimmedLogoSrc = null;

    if (img) {
      img.src = 'assets/images/logo.svg';
    }
  }

  getLogoCssVars(): Record<string, string> {
    const mobile = Number(this.settings?.logo_height_mobile ?? 100);
    const desktop = Number(this.settings?.logo_height_desktop ?? 100);

    // Permitimos un valor alto para la capa overlay. El navbar mantiene su alto fijo via CSS.
    const safeMobile = Number.isFinite(mobile)
      ? Math.min(Math.max(mobile, 24), 600)
      : 110;

    const safeDesktop = Number.isFinite(desktop)
      ? Math.min(Math.max(desktop, 24), 600)
      : 140;

    return {
      '--logo-h-mobile': `${safeMobile}px`,
      '--logo-h-desktop': `${safeDesktop}px`
    };
  }

  private trimTransparentPadding(src: string): Promise<string | null> {
    const url = String(src || '').trim();
    if (!url) return Promise.resolve(null);

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const iw = img.naturalWidth || img.width;
          const ih = img.naturalHeight || img.height;
          if (!iw || !ih) {
            resolve(null);
            return;
          }

          // Escanear en tamanio reducido para performance.
          const maxDim = 512;
          const scale = Math.min(1, maxDim / Math.max(iw, ih));
          const sw = Math.max(1, Math.round(iw * scale));
          const sh = Math.max(1, Math.round(ih * scale));

          const scan = document.createElement('canvas');
          scan.width = sw;
          scan.height = sh;
          const sctx = scan.getContext('2d');
          if (!sctx) {
            resolve(null);
            return;
          }

          sctx.clearRect(0, 0, sw, sh);
          sctx.drawImage(img, 0, 0, sw, sh);

          const data = sctx.getImageData(0, 0, sw, sh).data;

          // Buscar bounding box donde alpha sea significativo.
          const alphaThreshold = 18; // 0-255
          let minX = sw;
          let minY = sh;
          let maxX = -1;
          let maxY = -1;

          for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
              const a = data[(y * sw + x) * 4 + 3];
              if (a > alphaThreshold) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
              }
            }
          }

          // Si no encontramos pixeles (imagen totalmente transparente), no tocar.
          if (maxX < 0 || maxY < 0) {
            resolve(null);
            return;
          }

          // Padding para no dejarlo demasiado "apretado".
          const pad = Math.max(2, Math.round(Math.min(sw, sh) * 0.04));
          minX = Math.max(0, minX - pad);
          minY = Math.max(0, minY - pad);
          maxX = Math.min(sw - 1, maxX + pad);
          maxY = Math.min(sh - 1, maxY + pad);

          const cw = Math.max(1, maxX - minX + 1);
          const ch = Math.max(1, maxY - minY + 1);

          // Evitar generar un PNG enorme; mantenemos el resultado en un tamano razonable.
          const outMax = 900;
          const outScale = Math.min(1, outMax / Math.max(cw, ch));
          const ow = Math.max(1, Math.round(cw * outScale));
          const oh = Math.max(1, Math.round(ch * outScale));

          const out = document.createElement('canvas');
          out.width = ow;
          out.height = oh;
          const octx = out.getContext('2d');
          if (!octx) {
            resolve(null);
            return;
          }

          octx.clearRect(0, 0, ow, oh);
          octx.drawImage(scan, minX, minY, cw, ch, 0, 0, ow, oh);

          const dataUrl = out.toDataURL('image/png');
          resolve(dataUrl);
        } catch {
          // Si el canvas queda "tainted" por CORS o cualquier error, fallback.
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  private resolveLogoUrl(raw: string | null | undefined): string {
    const url = String(raw || '').trim();

    if (!url) return 'assets/images/logo.svg';

    if (url.startsWith('assets/') || url.startsWith('/assets/')) {
      return url.replace(/^\/+/, '');
    }

    if (url.startsWith('data:')) return url;

    if (/^https?:\/\//i.test(url)) {
      try {
        if (
          typeof window !== 'undefined' &&
          window.location.protocol === 'https:' &&
          url.startsWith('http://')
        ) {
          return `https://${url.slice('http://'.length)}`;
        }
      } catch {
        // ignore
      }

      return url;
    }

    return `${API_CONFIG.serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // =========================================================
  // PRODUCT SUGGESTIONS
  // =========================================================
  getSuggestionPrice(product: Product): number {
    const discounted = product.precio_con_descuento;

    if (discounted !== null && discounted !== undefined && discounted !== '') {
      const parsed = typeof discounted === 'string'
        ? parseFloat(discounted)
        : Number(discounted);

      if (Number.isFinite(parsed)) return parsed;
    }

    const price = product.price ?? product.precio;
    const parsed = typeof price === 'string'
      ? parseFloat(price)
      : Number(price);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  getSuggestionImage(product: Product): string {
    const raw = String(product.imageUrl || product.imagen_url || '').trim();

    if (!raw) {
      return 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=100';
    }

    if (raw.startsWith('http') || raw.startsWith('data:')) {
      return raw;
    }

    return `${API_CONFIG.serverUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
  }

  // =========================================================
  // CART
  // =========================================================
  getCartItemImage(item: CartItem): string {
    const raw = String(item?.product?.imageUrl || item?.product?.imagen_url || '').trim();

    if (!raw) {
      return 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=100';
    }

    if (raw.startsWith('http') || raw.startsWith('data:')) {
      return raw;
    }

    return `${API_CONFIG.serverUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
  }

  getCartItemName(item: CartItem): string {
    return String(item?.product?.name || item?.product?.nombre || 'Producto').trim();
  }

  getCartItemUnitPrice(item: CartItem): number {
    const discounted = (item?.product as any)?.precio_con_descuento;

    if (discounted !== null && discounted !== undefined && discounted !== '') {
      const parsed = typeof discounted === 'string'
        ? parseFloat(discounted)
        : Number(discounted);

      if (Number.isFinite(parsed)) return parsed;
    }

    const price = (item?.product as any)?.price ?? (item?.product as any)?.precio;
    const parsed = typeof price === 'string' ? parseFloat(price) : Number(price);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  getCartSubtotal(items: CartItem[] | null | undefined): number {
    if (!items?.length) return 0;

    return items.reduce((sum, item) => {
      return sum + this.getCartItemUnitPrice(item) * item.quantity;
    }, 0);
  }

  updateCartQuantity(item: CartItem, delta: number): void {
    if (!item?.product?.id) return;

    const current = Math.max(0, Number(item.quantity || 0));
    const next = Math.max(0, Math.min(99, current + delta));

    this.cartService.updateQuantity(item.product.id, next);
  }

  removeCartItem(item: CartItem): void {
    if (!item?.product?.id) return;
    this.cartService.removeFromCart(item.product.id);
  }

  clearCart(): void {
    const confirmed = window.confirm('¿Vaciar el carrito?');
    if (!confirmed) return;

    this.cartService.clearCart();
  }
}
