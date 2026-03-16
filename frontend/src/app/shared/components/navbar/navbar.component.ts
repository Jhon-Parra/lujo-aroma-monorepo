import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, Router, NavigationEnd, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartService, CartItem } from '../../../core/services/cart/cart.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsService, Settings } from '../../../core/services/settings/settings.service';
import { LowStockBellComponent } from '../low-stock-bell/low-stock-bell.component';
import { Observable, Subscription, filter, map } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, FormsModule, LowStockBellComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  cartItemCount$!: Observable<number>;
  cartItems$!: Observable<CartItem[]>;
  favoritesCount$!: Observable<number>;
  settings: Settings | null = null;
  searchTerm = '';
  isAdminRoute = false;
  mobileMenuOpen = false;
  private navSub?: Subscription;
  private settingsSub?: Subscription;

  constructor(
    private cartService: CartService,
    private favoritesService: FavoritesService,
    public authService: AuthService,
    private settingsService: SettingsService,
    private router: Router
  ) {
    this.cartItemCount$ = this.cartService.items$.pipe(
      map(items => items.reduce((acc, item) => acc + item.quantity, 0))
    );
    this.cartItems$ = this.cartService.items$;
    this.favoritesCount$ = this.favoritesService.favorites$.pipe(
      map(items => items.length)
    );
  }

  ngOnInit() {
    // Suscribirse a cambios para reflejar updates (ej. logo) sin recargar
    this.settingsSub = this.settingsService.settings$.subscribe((s) => {
      if (s) this.settings = s;
    });

    this.settingsService.getSettings().subscribe({
      next: (data) => {
        this.settings = data;
      },
      error: (err) => console.error('Error cargando configuraciones', err)
    });

    this.isAdminRoute = this.router.url.startsWith('/admin');
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.isAdminRoute = e.urlAfterRedirects.startsWith('/admin');
        this.mobileMenuOpen = false;
      });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    this.settingsSub?.unsubscribe();
  }

  getLogoUrl(): string {
    const url = (this.settings?.logo_url || '').trim();
    if (!url) return 'assets/images/logo.png';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${API_CONFIG.serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  getLogoCssVars(): Record<string, string> {
    const mobile = Number(this.settings?.logo_height_mobile ?? 100);
    const desktop = Number(this.settings?.logo_height_desktop ?? 100);

    const safeMobile = Number.isFinite(mobile) ? Math.min(Math.max(mobile, 24), 260) : 120;
    const safeDesktop = Number.isFinite(desktop) ? Math.min(Math.max(desktop, 24), 300) : 160;

    return {
      '--logo-h-mobile': `${safeMobile}px`,
      '--logo-h-desktop': `${safeDesktop}px`,
    };
  }

  getCartItemImage(item: CartItem): string {
    const raw = String(item?.product?.imageUrl || item?.product?.imagen_url || '').trim();
    if (!raw) return 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=100';
    if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
    return `${API_CONFIG.serverUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
  }

  getCartItemName(item: CartItem): string {
    return String(item?.product?.name || item?.product?.nombre || 'Producto').trim();
  }

  getCartItemUnitPrice(item: CartItem): number {
    const discounted: any = (item?.product as any)?.precio_con_descuento;
    if (discounted !== null && discounted !== undefined && discounted !== '') {
      const n = typeof discounted === 'string' ? parseFloat(discounted) : Number(discounted);
      if (Number.isFinite(n)) return n;
    }
    const v: any = (item?.product as any)?.price ?? (item?.product as any)?.precio;
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  getCartSubtotal(items: CartItem[] | null | undefined): number {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (this.getCartItemUnitPrice(item) * item.quantity), 0);
  }

  logout() {
    this.authService.logout();
    this.mobileMenuOpen = false;
  }

  toggleMobileMenu(): void {
    if (this.isAdminRoute) return;
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  onSearch() {
    if (this.searchTerm.trim()) {
      this.router.navigate(['/catalog'], { queryParams: { q: this.searchTerm.trim() }, queryParamsHandling: 'merge' });
      this.searchTerm = ''; // Limpiar input después de buscar
      this.mobileMenuOpen = false;
    }
  }
}
