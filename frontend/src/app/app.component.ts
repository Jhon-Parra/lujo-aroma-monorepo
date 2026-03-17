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
  private settingsSub?: Subscription;

  constructor(
    private settingsService: SettingsService,
    private router: Router,
    private seoService: SeoService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.seoService.setJsonLd({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Perfumissimo",
      "image": "https://perfumissimocol.com/assets/images/logo.png",
      "@id": "https://perfumissimocol.com",
      "url": "https://perfumissimocol.com",
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
        "https://www.facebook.com/perfumissimo",
        "https://www.instagram.com/perfumissimo.col"
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
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
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
