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
    if (this.forceLocalLogo) return 'assets/images/logo.png';
    return this.resolveLogoUrl(this.settings?.logo_url);
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement | null;

    if (img?.src?.includes('/assets/images/logo.png')) return;

    this.forceLocalLogo = true;

    if (img) {
      img.src = 'assets/images/logo.png';
    }
  }

  getLogoCssVars(): Record<string, string> {
    const mobile = Number(this.settings?.logo_height_mobile ?? 100);
    const desktop = Number(this.settings?.logo_height_desktop ?? 100);

    const safeMobile = Number.isFinite(mobile)
      ? Math.min(Math.max(mobile, 24), 260)
      : 120;

    const safeDesktop = Number.isFinite(desktop)
      ? Math.min(Math.max(desktop, 24), 300)
      : 160;

    return {
      '--logo-h-mobile': `${safeMobile}px`,
      '--logo-h-desktop': `${safeDesktop}px`
    };
  }

  private resolveLogoUrl(raw: string | null | undefined): string {
    const url = String(raw || '').trim();

    if (!url) return 'assets/images/logo.png';

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