import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { SettingsService, Settings } from './core/services/settings/settings.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { API_CONFIG } from './core/config/api-config';
import { SeoService } from './core/services/seo/seo.service';
import { PromotionService, Promotion } from './core/services/promotion/promotion.service';
import { ConfigService } from './core/services/config.service';
import { SpraySfxService } from './core/services/sfx/spray-sfx.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'frontend';
  settings: Settings | null = null;
  whatsappUrl = '';
  promotions: Promotion[] = [];
  isAdminRoute = false;
  isHomeRoute = false;
  private settingsSub?: Subscription;
  private promoSub?: Subscription;

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    private promotionService: PromotionService,
    private router: Router,
    private seoService: SeoService,
    private spraySfx: SpraySfxService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    // Play a subtle "spray" sound on each page load (after first user gesture).
    this.spraySfx.armSprayOnLoad();

    // Asegura config en background (si ya esta cacheado, es instantaneo)
    this.configService.loadConfig().catch(() => {});

    this.seoService.setJsonLd({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Perfumes Bogotá",
      "image": "https://perfumesbogota.com/assets/images/logo.png",
      "@id": "https://perfumesbogota.com",
      "url": "https://perfumesbogota.com",
      "telephone": "+573001234567",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Calle 12 #13-85",
        "addressLocality": "Bogotá",
        "addressRegion": "Cundinamarca",
        "postalCode": "110111",
        "addressCountry": "CO"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 4.6097,
        "longitude": -74.0817
      },
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday"
        ],
        "opens": "09:00",
        "closes": "18:00"
      },
      "sameAs": [
        "https://www.facebook.com/lujo_aroma",
        "https://www.instagram.com/lujo_aroma.col"
      ]
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      window.scrollTo(0, 0);
      const url = event.urlAfterRedirects || '/';
      this.isAdminRoute = url.includes('/admin');
      this.isHomeRoute = url === '/' || url === '/home' || url.split('?')[0] === '/' || url.split('?')[0] === '/home';
    });

    this.settingsSub = this.settingsService.settings$.subscribe({
      next: (s) => {
        if (!s) return;
        this.settings = s;
        this.whatsappUrl = this.buildWhatsappUrl(s.whatsapp_number || '', s.whatsapp_message || '');
        this.applyLogoCssVars(s);
        this.updateFavicon(s.logo_url);
      }
    });

    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.settings = s;
        this.whatsappUrl = this.buildWhatsappUrl(s?.whatsapp_number || '', s?.whatsapp_message || '');
        this.applyLogoCssVars(s);
        this.updateFavicon(s?.logo_url);
      },
      error: () => {
        this.settings = null;
        this.whatsappUrl = '';
      }
    });

    this.loadActivePromotions();

    this.warmRouteChunks();
  }

  private warmRouteChunks(): void {
    try {
      const nav: any = navigator as any;
      const conn = nav?.connection;
      if (conn?.saveData) return;
      const effective = String(conn?.effectiveType || '').toLowerCase();
      if (effective && (effective.includes('2g') || effective.includes('slow-2g'))) return;
    } catch {
      // ignore
    }

    const warm = () => {
      // Rutas mas comunes para evitar "loading" al primer click.
      void import('./pages/store/catalog/catalog.component');
      void import('./pages/store/promotions/promotions.component');
    };

    const w: any = window as any;
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(warm, { timeout: 2500 });
    } else {
      setTimeout(warm, 900);
    }
  }

  loadActivePromotions(): void {
    this.promoSub = this.promotionService.getPromotions().subscribe({
      next: (data) => {
        const now = new Date();
        this.promotions = data.filter(p => {
          const start = p.fecha_inicio ? new Date(p.fecha_inicio) : null;
          const end = p.fecha_fin ? new Date(p.fecha_fin) : null;
          const isActive = p.activo !== false;
          const isStarted = !start || start <= now;
          const isNotEnded = !end || end >= now;
          return isActive && isStarted && isNotEnded;
        });
      },
      error: (err) => console.error('Error cargando promociones globales', err)
    });
  }

  filterByPromotions(): void {
    // Fire-and-forget: track clicks on floating promotions button.
    this.promotionService.trackFabClick().subscribe({
      next: () => {},
      error: () => {}
    });
    this.router.navigate(['/promotions']);
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
    this.promoSub?.unsubscribe();
  }

  private updateFavicon(logoUrl: string | null | undefined): void {
    const link: HTMLLinkElement | null = this.document.querySelector("link[rel*='icon']");
    if (link) {
      const url = this.getAbsoluteLogoUrl(logoUrl);

      // Intentar generar un favicon con fondo (para logos plateados/transparentes)
      // Si falla por CORS/taint, hacemos fallback al URL directo.
      this.generateBadgeFaviconPng(url)
        .then((dataUrl) => {
          if (dataUrl) {
            link.type = 'image/png';
            link.href = dataUrl;

            const apple: HTMLLinkElement | null = this.document.querySelector("link[rel='apple-touch-icon']");
            if (apple) {
              apple.href = dataUrl;
            }
            return;
          }

          link.href = url + (url.includes('?') ? '&' : '?') + 'v=' + new Date().getTime();
        })
        .catch(() => {
          link.href = url + (url.includes('?') ? '&' : '?') + 'v=' + new Date().getTime();
        });
    }
  }

  private applyLogoCssVars(s: Settings | null | undefined): void {
    const root = this.document?.documentElement;
    if (!root) return;

    const mobileRaw = Number((s as any)?.logo_height_mobile);
    const desktopRaw = Number((s as any)?.logo_height_desktop);

    const clampInt = (n: number, min: number, max: number, fallback: number): number => {
      if (!Number.isFinite(n)) return fallback;
      const v = Math.trunc(n);
      return Math.min(Math.max(v, min), max);
    };

    // Guardamos el valor real para que footer/admin puedan escalar.
    // El navbar igual limita visualmente con CSS clamp().
    const mobile = clampInt(mobileRaw, 24, 600, 72);
    const desktop = clampInt(desktopRaw, 24, 600, 96);

    root.style.setProperty('--logo-h-mobile', `${mobile}px`);
    root.style.setProperty('--logo-h-desktop', `${desktop}px`);
  }

  private generateBadgeFaviconPng(url: string): Promise<string | null> {
    const src = String(url || '').trim();
    if (!src) return Promise.resolve(null);

    return new Promise((resolve) => {
      const img = new Image();
      // Necesario para dibujar en canvas sin taint (si el host permite CORS)
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const size = 96;
          const canvas = this.document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          // Background circle (navy) + subtle gold ring
          const cx = size / 2;
          const cy = size / 2;
          const r = (size / 2) - 4;

          const g = ctx.createLinearGradient(0, 0, size, size);
          g.addColorStop(0, '#07121a');
          g.addColorStop(1, '#274C68');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(216, 192, 138, 0.65)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();

          // Fit logo inside
          const pad = 18;
          const box = size - pad * 2;
          const iw = img.naturalWidth || img.width;
          const ih = img.naturalHeight || img.height;
          if (!iw || !ih) {
            resolve(null);
            return;
          }

          const scale = Math.min(box / iw, box / ih);
          const w = iw * scale;
          const h = ih * scale;
          const x = (size - w) / 2;
          const y = (size - h) / 2;

          ctx.drawImage(img, x, y, w, h);

          // Export
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  private getAbsoluteLogoUrl(logoUrl: string | null | undefined): string {
    const url = (logoUrl || '').trim();
    if (!url) return 'assets/images/logo.png';

    // Allow referencing frontend assets directly from settings
    if (url.startsWith('assets/') || url.startsWith('/assets/')) return url.replace(/^\/+/, '');

    if (url.startsWith('data:')) return url;
    if (/^https?:\/\//i.test(url)) {
      try {
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
          return `https://${url.slice('http://'.length)}`;
        }
      } catch {
        // ignore
      }
      return url;
    }

    return `${API_CONFIG.serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private buildWhatsappUrl(numberRaw: string, messageRaw: string): string {
    const number = (numberRaw || '').replace(/\D/g, '');
    if (!number) return '';
    const message = (messageRaw || '').trim();
    const base = `https://wa.me/${number}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
  }
}
