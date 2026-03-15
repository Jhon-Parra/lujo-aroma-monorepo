import { Injectable, Inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

type SeoConfig = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
};

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private defaultTitle = 'Perfumissimo';
  private defaultDescription = 'Perfumes y fragancias para mujer, hombre y unisex. Descubre tu esencia en Perfumissimo.';

  constructor(
    private title: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private doc: Document
  ) {}

  set(config: SeoConfig): void {
    const title = (config.title || this.defaultTitle).trim();
    const description = (config.description || this.defaultDescription).trim();
    const url = (config.url || this.getCurrentUrl()).trim();
    const type = (config.type || 'website').trim();
    const image = (config.image || '').trim();

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });

    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: type });
    if (image) {
      this.meta.updateTag({ property: 'og:image', content: image });
    }

    this.meta.updateTag({ name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    if (image) {
      this.meta.updateTag({ name: 'twitter:image', content: image });
    }

    this.setCanonical(url);
  }

  setCanonical(url: string): void {
    const head = this.doc.head;
    if (!head) return;

    let link = head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  setJsonLd(obj: any): void {
    const head = this.doc.head;
    if (!head) return;

    const id = 'seo-jsonld';
    const existing = head.querySelector(`#${id}`);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const script = this.doc.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.text = JSON.stringify(obj);
    head.appendChild(script);
  }

  clearJsonLd(): void {
    const head = this.doc.head;
    if (!head) return;
    const existing = head.querySelector('#seo-jsonld');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  private getCurrentUrl(): string {
    try {
      return String(this.doc.location?.href || '').trim();
    } catch {
      return '';
    }
  }
}
