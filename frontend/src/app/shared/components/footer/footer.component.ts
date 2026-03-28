import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SettingsService, Settings } from '../../../core/services/settings/settings.service';
import { API_CONFIG } from '../../../core/config/api-config';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  private forceLocalLogo = false;

  settings: Settings | null = null;
  whatsappUrl = '';
  instagramUrl = '';
  facebookUrl = '';
  tiktokUrl = '';

  constructor(private settingsService: SettingsService) { }

  ngOnInit() {
    this.settingsService.settings$.subscribe((s) => {
      if (s) this.updateSettingsData(s);
    });

    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.updateSettingsData(s);
      },
      error: () => {
        this.resetSettingsData();
      }
    });
  }

  private updateSettingsData(s: Settings): void {
    this.settings = s;
    this.forceLocalLogo = false;
    this.whatsappUrl = this.buildWhatsappUrl(s?.whatsapp_number || '', s?.whatsapp_message || '');
    this.instagramUrl = this.normalizeExternalUrl(s?.instagram_url || '', 'instagram.com');
    this.facebookUrl = this.normalizeExternalUrl(s?.facebook_url || '', 'facebook.com');
    this.tiktokUrl = this.normalizeExternalUrl(s?.tiktok_url || '', 'tiktok.com');
  }

  private resetSettingsData(): void {
    this.settings = null;
    this.forceLocalLogo = false;
    this.whatsappUrl = '';
    this.instagramUrl = '';
    this.facebookUrl = '';
    this.tiktokUrl = '';
  }

  private resolveLogoUrl(raw: string | null | undefined): string {
    const url = String(raw || '').trim();
    if (!url) return 'assets/images/logo.png';
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

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src && img.src.includes('/assets/images/logo.png')) return;
    this.forceLocalLogo = true;
    img.src = 'assets/images/logo.png';
  }

  private normalizeExternalUrl(raw: string, expectedHost: string): string {
    const value = (raw || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (new RegExp(expectedHost.replace(/\./g, '\\.') + '\\/', 'i').test(value) || value.startsWith('www.')) {
      return `https://${value.replace(/^https?:\/\//i, '')}`;
    }
    const handle = value.startsWith('@') ? value.slice(1) : value;
    return `https://${expectedHost}/${handle.replace(/^\/+/, '')}`;
  }

  private buildWhatsappUrl(numberRaw: string, messageRaw: string): string {
    const number = (numberRaw || '').replace(/\D/g, '');
    if (!number) return '';
    const message = (messageRaw || '').trim();
    const base = `https://wa.me/${number}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
  }

  getLogoUrl(): string {
    if (this.forceLocalLogo) return 'assets/images/logo.png';
    return this.resolveLogoUrl(this.settings?.logo_url);
  }
}
