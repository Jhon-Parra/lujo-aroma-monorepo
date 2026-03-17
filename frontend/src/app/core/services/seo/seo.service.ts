import { Injectable, Inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

type SeoConfig = {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
};

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private defaultTitle = 'Perfumissimo | Perfumes Originales en Bogotá y Colombia';
  private defaultDescription = 'Perfumes originales de lujo en Bogotá. Fragancias exclusivas para mujer, hombre y unisex con envíos a toda Colombia. Descubre los mejores perfumes en Perfumissimo.';
  private defaultKeywords = 'perfumes, perfumes originales, perfumería de lujo, perfumes Bogotá, fragancias, Perfumissimo';

  constructor(
    private title: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private doc: Document
  ) {}

  set(config: SeoConfig): void {
    const title = (config.title || this.defaultTitle).trim();
    const description = (config.description || this.defaultDescription).trim();
    const keywords = (config.keywords || this.defaultKeywords).trim();
    const url = (config.url || this.getCurrentUrl()).trim();
    const type = (config.type || 'website').trim();
    const image = (config.image || '').trim();

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'keywords', content: keywords });

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
