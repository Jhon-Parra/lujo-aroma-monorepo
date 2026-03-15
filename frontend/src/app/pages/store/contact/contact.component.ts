import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsService, Settings } from '../../../core/services/settings/settings.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contact.component.html'
})
export class ContactComponent {
  settings: Settings | null = null;
  instagramUrl = '';
  facebookUrl = '';
  whatsappUrl = '';
  tiktokUrl = '';

  mapEmbedUrl: SafeResourceUrl | null = null;

  constructor(private settingsService: SettingsService, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.settings = s;
        this.instagramUrl = this.normalizeExternalUrl(s?.instagram_url || '', 'instagram.com');
        this.facebookUrl = this.normalizeExternalUrl(s?.facebook_url || '', 'facebook.com');
        this.whatsappUrl = this.buildWhatsappUrl(s?.whatsapp_number || '', s?.whatsapp_message || '');
        this.tiktokUrl = this.normalizeExternalUrl(s?.tiktok_url || '', 'tiktok.com');

        const line1 = (s as any)?.boutique_address_line1 || 'Calle 12 #13-85';
        const line2 = (s as any)?.boutique_address_line2 || 'Bogotá, Colombia';
        const url = this.buildGoogleMapsEmbedUrl(`${line1}, ${line2}`);
        this.mapEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      },
      error: () => {
        this.settings = null;
        this.instagramUrl = '';
        this.facebookUrl = '';
        this.whatsappUrl = '';
        this.tiktokUrl = '';
        const url = this.buildGoogleMapsEmbedUrl('Calle 12 #13-85, Bogotá, Colombia');
        this.mapEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      }
    });
  }

  private buildGoogleMapsEmbedUrl(query: string): string {
    const q = (query || '').trim() || 'Bogotá, Colombia';
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
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
}
