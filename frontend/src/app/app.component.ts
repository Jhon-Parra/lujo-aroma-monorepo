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
  private settingsSub?: Subscription;
  private promoSub?: Subscription;

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    private promotionService: PromotionService,
    private router: Router,
    private seoService: SeoService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    // Asegura config en background (si ya esta cacheado, es instantaneo)
    this.configService.loadConfig().catch(() => {});

    this.seoService.setJsonLd({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Lujo & Aroma",
      "image": "https://lujo_aromacol.com/assets/images/logo.png",
      "@id": "https://lujo_aromacol.com",
      "url": "https://lujo_aromacol.com",
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
    ).subscribe(() => {
      window.scrollTo(0, 0);
    });

    this.settingsSub = this.settingsService.settings$.subscribe({
      next: (s) => {
        if (!s) return;
        this.settings = s;
        this.whatsappUrl = this.buildWhatsappUrl(s.whatsapp_number || '', s.whatsapp_message || '');
        this.updateFavicon(s.logo_url);
      }
    });

    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.settings = s;
        this.whatsappUrl = this.buildWhatsappUrl(s?.whatsapp_number || '', s?.whatsapp_message || '');
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
      link.href = url + (url.includes('?') ? '&' : '?') + 'v=' + new Date().getTime();
    }
  }

  private getAbsoluteLogoUrl(logoUrl: string | null | undefined): string {
    const url = (logoUrl || '').trim();
    if (!url) return 'assets/images/logo.png';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
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
