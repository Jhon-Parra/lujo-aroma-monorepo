import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { API_CONFIG } from '../../core/config/api-config';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ProductCardComponent, Product } from '../../shared/components/product-card/product-card.component';
import { ProductService } from '../../core/services/product/product.service';
import { PromotionService, Promotion } from '../../core/services/promotion/promotion.service';
import { SettingsService, Settings } from '../../core/services/settings/settings.service';
import { InstagramService, InstagramMediaItem } from '../../core/services/social/instagram.service';
import { SeoService } from '../../core/services/seo/seo.service';

import { SkeletonCardComponent } from '../../shared/components/skeleton-card/skeleton-card.component';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ProductCardComponent, SkeletonCardComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly HOME_VIDEO_AUTOPLAY_KEY = 'lujo_aroma_home_video_autoplay_done_v1';
  private readonly EXIT_OFFER_KEY = 'lujo_aroma_exit_offer_seen_v1';

  // Map to track video elements by slide index for programmatic control
  private videoElements = new Map<number, HTMLVideoElement>();

  // Home premium (carousel)
  homeSlides: any[] = [];
  homeCategories: any[] = [];
  activeSlideIndex = 0;
  carouselPaused = false;
  exitOfferOpen = false;



  private carouselTimer: any;

  @HostListener('document:mouseout', ['$event'])
  onDocumentMouseOut(e: MouseEvent): void {
    // Exit intent: mouse leaving at top edge (desktop only)
    const isTouch = (navigator as any)?.maxTouchPoints > 0;
    if (isTouch) return;
    if (this.exitOfferOpen) return;
    if (e.clientY <= 0) {
      this.maybeOpenExitOffer();
    }
  }

  products: Product[] = [];
  bestsellers: Product[] = [];
  loading = true;
  loadingBestsellers = true;
  error = '';
  settings: Settings | null = null;
  promotions: Promotion[] = [];

  instagramMedia: InstagramMediaItem[] = [];
  instagramLoading = true;
  instagramError = '';
  showInstagramSection = true;
  private instagramRequested = false;

  instagramUrl = '';
  instagramLabel = '@lujo_aroma.col';

  facebookUrl = '';
  whatsappUrl = '';
  tiktokUrl = '';

  recoQuery = '';

  categories = [
    { name: 'Ver Todo', slug: 'all', image: 'assets/images/home_category_all_v2_1774016212167.png', icon: 'bi-grid-3x3-gap' },
    { name: 'Arabe', slug: 'arabe', image: 'assets/images/home_category_arabe_v2_1774016227682.png', icon: 'bi-stars' },
    { name: 'Caballero', slug: 'hombre', image: 'assets/images/home_category_caballero_v3_1774016267276.png', icon: 'bi-gender-male' },
    { name: 'Dama', slug: 'mujer', image: 'assets/images/home_category_dama_v3_1774016281790.png', icon: 'bi-gender-female' },
    { name: 'Kits de perfumes', slug: 'kits', image: 'assets/images/home_category_kits_v3_1774016299370.png', icon: 'bi-box-seam' },
    { name: 'Unisex', slug: 'unisex', image: 'assets/images/home_category_unisex_v2_1774016243719.png', icon: 'bi-gender-ambiguous' }
  ];

  constructor(
    private productService: ProductService,
    private settingsService: SettingsService,
    private promotionService: PromotionService,
    private instagramService: InstagramService,
    private seo: SeoService,
    private router: Router
  ) {}

  ngOnDestroy(): void {
    if (this.carouselTimer) {
      clearInterval(this.carouselTimer);
      this.carouselTimer = undefined;
    }
  }

  /** Called by (loadeddata) on each video element. */
  onVideoLoaded(event: Event, index: number): void {
    const video = event.target as HTMLVideoElement;
    this.videoElements.set(index, video);
    if (index === this.activeSlideIndex) {
      this.playSlideVideo(index);
    }
  }

  /** Programmatically play video at given slide index. */
  private playSlideVideo(index: number): void {
    const video = this.videoElements.get(index);
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => { /* browser policy: ignore */ });
  }

  /** Pause all video elements except the active one. */
  private pauseOtherVideos(activeIndex: number): void {
    this.videoElements.forEach((video, idx) => {
      if (idx !== activeIndex) {
        video.pause();
        video.currentTime = 0;
        video.style.opacity = '1';
      }
    });
  }



  goToRecommenderQuiz(): void {
    this.router.navigate(['/recommender'], { queryParams: { mode: 'quiz' } });
  }

  goToRecommenderFree(): void {
    const q = String(this.recoQuery || '').trim();
    this.router.navigate(['/recommender'], { queryParams: q ? { mode: 'free', q } : { mode: 'free' } });
  }

  filterByPromotions(): void {
    this.router.navigate(['/promotions']);
  }

  getCategoryParams(cat: any): any {
    if (cat.slug === 'all') return {};
    // Todas las tarjetas de categoria deben navegar como filtro de categoria.
    // (Antes algunas usaban q=slug, lo cual no activaba el paginado de categorias)
    return { category: cat.slug };
  }

  ngOnInit(): void {
    // SEO & JSON-LD
    this.seo.set({
      title: 'Lujo & Aroma | Perfumería Árabe',
      description: 'Perfumería árabe y perfumes originales en Bogotá y Colombia. Fragancias para hombre, mujer y unisex con envíos rápidos. Descubre Lujo & Aroma.',
      keywords: 'perfumería árabe, perfumes árabes, perfumes originales, oud, perfumes bogota, fragancias originales, perfumes colombia'
    });

    this.seo.setJsonLd({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Lujo & Aroma",
      "url": "https://lujo_aromacol.com/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://lujo_aromacol.com/catalog?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    });

    // Load Settings
    this.settingsService.settings$.subscribe({
      next: (data) => {
        if (data) this.applySettings(data);
      }
    });
    this.settingsService.getSettings().subscribe({
      next: (data) => this.applySettings(data),
      error: (err) => console.error('Error cargando configuración', err)
    });

    // Load Newest Products
    this.productService.getNewestProducts(8).subscribe({
      next: (apiProducts) => {
        this.products = this.mapApiProducts(apiProducts);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching newest products', err);
        this.error = 'No se pudieron cargar los productos nuevos.';
        this.loading = false;
      }
    });

    // Load Bestsellers
    this.productService.getBestsellers(4).subscribe({
      next: (apiProducts) => {
        this.bestsellers = this.mapApiProducts(apiProducts);
        this.loadingBestsellers = false;
      },
      error: (err) => {
        console.error('Error fetching bestsellers', err);
        this.loadingBestsellers = false;
      }
    });

    // Load Promotions
    this.promotionService.getPromotions().subscribe({
      next: (promos) => {
        const typeOf = (p: Promotion) => String((p as any).discount_type || 'PERCENT').toUpperCase();
        const scoreOf = (p: Promotion) => {
          const t = typeOf(p);
          return t === 'AMOUNT' ? Number((p as any).amount_discount || 0) : Number(p.porcentaje_descuento || 0);
        };
        const priorityOf = (p: Promotion) => Number((p as any).priority || 0);

        this.promotions = (promos || [])
          .filter(p => {
            if (!p?.activo) return false;
            const now = Date.now();
            const start = new Date(p.fecha_inicio).getTime();
            const end = new Date(p.fecha_fin).getTime();
            if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
            if (start > now || end < now) return false;
            const t = typeOf(p);
            if (t === 'AMOUNT') return Number((p as any).amount_discount || 0) > 0;
            return Number(p.porcentaje_descuento || 0) > 0;
          })
          .sort((a, b) => {
            const prio = priorityOf(b) - priorityOf(a);
            if (prio !== 0) return prio;
            return scoreOf(b) - scoreOf(a);
          })
          .slice(0, 2);
      },
      error: (err) => {
        console.error('Error cargando promociones', err);
        this.promotions = [];
      }
    });

    this.startCarousel();
  }

  private applySettings(data: Settings): void {
    this.settings = data;
    this.showInstagramSection = (data as any)?.show_instagram_section !== false;
    this.instagramUrl = this.normalizeInstagramUrl(this.settings?.instagram_url || '');
    this.instagramLabel = this.buildInstagramLabel(this.instagramUrl, this.settings?.instagram_url || '');

    this.facebookUrl = this.normalizeExternalUrl(this.settings?.facebook_url || '', 'facebook.com');
    this.whatsappUrl = this.buildWhatsappUrl(this.settings?.whatsapp_number || '', this.settings?.whatsapp_message || '');
    this.tiktokUrl = this.normalizeExternalUrl(this.settings?.tiktok_url || '', 'tiktok.com');

    this.loadInstagramIfEnabled();

    // Home premium config
    const slides = Array.isArray((data as any)?.home_carousel) ? (data as any).home_carousel : null;
    const cats = Array.isArray((data as any)?.home_categories) ? (data as any).home_categories : null;
    this.homeSlides = slides && slides.length ? slides.slice(0, 3) : this.getDefaultSlides();
    this.homeCategories = cats && cats.length ? cats.slice(0, 4) : this.getDefaultCategories();

    if (this.activeSlideIndex >= (this.homeSlides?.length || 0)) {
      this.activeSlideIndex = 0;
    }
  }

  private getDefaultSlides(): any[] {
    const heroUrl = String((this.settings as any)?.hero_media_url || this.settings?.hero_image_url || '').trim();
    const heroType = this.getHeroMediaType();
    return [
      {
        headline: 'Descubre la esencia del lujo',
        subhead: 'Perfumes originales con presencia. Seleccion curada para quien exige mas.',
        ctaText: 'Explorar coleccion',
        ctaLink: '/catalog',
        mediaType: heroType === 'video' ? 'video' : 'image',
        mediaUrl: heroUrl
      },
      {
        headline: 'Fragancias originales que definen tu estilo',
        subhead: 'Bestsellers y lanzamientos: tu aroma firma en un clic.',
        ctaText: 'Comprar ahora',
        ctaLink: '/catalog',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=2000&auto=format&fit=crop'
      },
      {
        headline: 'Hasta 20% OFF por tiempo limitado',
        subhead: 'Ofertas activas: el mejor momento para probar tu proximo favorito.',
        ctaText: 'Aprovechar oferta',
        ctaLink: '/catalog?promo=true',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1585386959984-a41552231693?q=80&w=2000&auto=format&fit=crop'
      }
    ];
  }

  private getDefaultCategories(): any[] {
    return [
      {
        title: 'Para El',
        subtitle: 'Fresco. Intenso. Memorables.',
        emotion: 'Define tu presencia',
        link: '/catalog?category=hombre',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1526045478516-99145907023c?q=80&w=1600&auto=format&fit=crop'
      },
      {
        title: 'Para Ella',
        subtitle: 'Elegancia que se siente cerca.',
        emotion: 'Elegancia femenina',
        link: '/catalog?category=mujer',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?q=80&w=1600&auto=format&fit=crop'
      },
      {
        title: 'Exclusivos / Nicho',
        subtitle: 'Oud, arabes, raros.',
        emotion: 'Fragancias unicas',
        link: '/catalog?category=arabe',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=1600&auto=format&fit=crop'
      },
      {
        title: 'Ofertas',
        subtitle: 'Descuentos activos hoy.',
        emotion: 'Compra inteligente',
        link: '/catalog?promo=true',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1526045431048-5b92f4f1b77f?q=80&w=1600&auto=format&fit=crop'
      }
    ];
  }

  startCarousel(): void {
    if (this.carouselTimer) return;
    this.carouselTimer = setInterval(() => {
      if (this.carouselPaused) return;
      this.nextSlide();
    }, 4500); // Speeds up autoplay to 4.5s so it's obvious to the user
  }

  pauseCarousel(): void {
    this.carouselPaused = true;
  }

  resumeCarousel(): void {
    this.carouselPaused = false;
  }

  goToSlide(i: number): void {
    const total = (this.homeSlides || []).length || 0;
    if (!total) return;
    const next = Math.max(0, Math.min(total - 1, Math.trunc(Number(i || 0))));
    this.activeSlideIndex = next;
    this.carouselPaused = true;
    this.playSlideVideo(this.activeSlideIndex);
    this.pauseOtherVideos(this.activeSlideIndex);
  }

  nextSlide(): void {
    const total = (this.homeSlides || []).length || 0;
    if (!total) return;
    this.activeSlideIndex = (this.activeSlideIndex + 1) % total;
    this.playSlideVideo(this.activeSlideIndex);
    this.pauseOtherVideos(this.activeSlideIndex);
  }

  prevSlide(): void {
    const total = (this.homeSlides || []).length || 0;
    if (!total) return;
    this.activeSlideIndex = (this.activeSlideIndex - 1 + total) % total;
    this.carouselPaused = true;
    this.playSlideVideo(this.activeSlideIndex);
    this.pauseOtherVideos(this.activeSlideIndex);
  }

  isVideoSlide(slide: any): boolean {
    const t = String(slide?.mediaType || '').trim().toLowerCase();
    if (t === 'video') return true;
    const url = String(slide?.mediaUrl || '').trim().toLowerCase();
    return url.endsWith('.mp4') || url.endsWith('.webm');
  }

  getHomeSlideMediaUrl(slide: any, index: number): string {
    const url = String(slide?.mediaUrl || '').trim();
    if (url) {
      if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/assets/') || url.startsWith('assets/')) {
        return url.startsWith('assets/') ? `/${url}`.replace('//', '/') : url;
      }
      return `${API_CONFIG.serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    // Fallbacks
    if (index === 2) return 'https://images.unsplash.com/photo-1585386959984-a41552231693?q=80&w=2000&auto=format&fit=crop';
    if (index === 1) return 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=2000&auto=format&fit=crop';
    return this.getHeroMediaUrl();
  }

  navigateCta(linkRaw: string): void {
    const link = String(linkRaw || '').trim();
    if (!link) return;
    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
    // Permitir links con querystring
    this.router.navigateByUrl(link);
  }

  maybeOpenExitOffer(): void {
    // Se controla desde template via (document) mouseleave
    try {
      if (localStorage.getItem(this.EXIT_OFFER_KEY)) return;
    } catch {
      // ignore
    }
    this.exitOfferOpen = true;
    try { localStorage.setItem(this.EXIT_OFFER_KEY, '1'); } catch { /* ignore */ }
  }

  closeExitOffer(): void {
    this.exitOfferOpen = false;
  }

  private loadInstagramIfEnabled(): void {
    if (!this.showInstagramSection) {
      this.instagramLoading = false;
      this.instagramMedia = [];
      this.instagramError = '';
      return;
    }
    if (this.instagramRequested) return;
    this.instagramRequested = true;
    this.instagramService.getMedia(12).subscribe({
      next: (res) => {
        const items = res?.items || [];
        this.instagramMedia = items.filter(i => !!i.media_url);
        this.instagramError = res?.message || '';
        this.instagramLoading = false;
      },
      error: (err) => {
        console.error('Error cargando Instagram media:', err);
        this.instagramMedia = [];
        this.instagramError = 'No se pudieron cargar las publicaciones.';
        this.instagramLoading = false;
      }
    });
  }

  buyNow(): void {
    this.router.navigate(['/catalog']);
  }

  getInstagramImage(item: InstagramMediaItem): string {
    if (item.media_type === 'VIDEO') {
      return item.thumbnail_url || item.media_url || '';
    }
    return item.media_url || '';
  }

  private normalizeInstagramUrl(raw: string): string {
    const value = (raw || '').trim();
    if (!value) return '';

    if (/^https?:\/\//i.test(value)) return value;

    // Aceptar formatos: @handle, handle, instagram.com/handle
    const noAt = value.startsWith('@') ? value.slice(1) : value;
    if (/instagram\.com\//i.test(noAt)) {
      return `https://${noAt.replace(/^https?:\/\//i, '').replace(/^www\./i, '')}`;
    }
    return `https://instagram.com/${noAt.replace(/^\/+/, '')}`;
  }

  private buildInstagramLabel(normalizedUrl: string, raw: string): string {
    const fallback = '@lujo_aroma.col';
    const rawValue = (raw || '').trim();
    if (!rawValue && !normalizedUrl) return fallback;

    // Si ya viene como @handle, respetar
    if (rawValue.startsWith('@') && rawValue.length > 1) return rawValue;

    const url = normalizedUrl || rawValue;
    try {
      const u = new URL(url);
      const handle = u.pathname.split('/').filter(Boolean)[0];
      if (handle) return `@${handle}`;
    } catch {
      // ignore
    }

    const m = String(url).match(/instagram\.com\/([^/?#]+)/i);
    if (m?.[1]) return `@${m[1]}`;

    return fallback;
  }

  private normalizeExternalUrl(raw: string, expectedHost: string): string {
    const value = (raw || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    // Permitir "facebook.com/.." o "www.facebook.com/.."
    if (new RegExp(expectedHost.replace(/\./g, '\\.') + '\\/', 'i').test(value) || value.startsWith('www.')) {
      return `https://${value.replace(/^https?:\/\//i, '')}`;
    }
    // Si es solo handle, intentar construir URL
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

  getHeroMediaType(): 'image' | 'gif' | 'video' {
    const raw = String((this.settings as any)?.hero_media_type || '').trim().toLowerCase();
    if (raw === 'video' || raw === 'gif' || raw === 'image') return raw;

    const url = String((this.settings as any)?.hero_media_url || this.settings?.hero_image_url || '').toLowerCase();
    if (url.endsWith('.mp4') || url.endsWith('.webm')) return 'video';
    if (url.endsWith('.gif')) return 'gif';
    return 'image';
  }

  getHeroMediaUrl(): string {
    const url = String((this.settings as any)?.hero_media_url || this.settings?.hero_image_url || '').trim();
    if (url) {
      if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/assets/')) {
        return url;
      }
      return `${API_CONFIG.serverUrl}${url}`;
    }
    return 'https://images.unsplash.com/photo-1615397323891-b6aab016b801?q=80&w=2000&auto=format&fit=crop';
  }

  getHeroPosterUrl(): string {
    // Para video, usar hero_image_url como poster si existe
    if (this.getHeroMediaType() !== 'video') return '';
    const url = String(this.settings?.hero_image_url || '').trim();
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/assets/')) return url;
    return `${API_CONFIG.serverUrl}${url}`;
  }

  private mapApiProducts(apiProducts: any[]): Product[] {
    return apiProducts.map(ap => ({
      id: ap.id || '',
      name: ap.name || ap.nombre,
      notes: ap.notes || ap.notas_olfativas || ap.descripcion,
      price: ap.price ? Number(ap.price) : (ap.precio_con_descuento ? Number(ap.precio_con_descuento) : (typeof ap.precio === 'string' ? parseFloat(ap.precio) : ap.precio)),
      imageUrl: ap.imageUrl || ap.imagen_url || 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=800&auto=format&fit=crop',
      soldCount: (ap.soldCount || ap.unidades_vendidas || 0).toString(),
      isNew: !!(ap.isNew ?? ap.es_nuevo),
      genero: ap.genero,
      categoria_nombre: (ap as any).categoria_nombre ?? null,
      categoria_slug: (ap as any).categoria_slug ?? null,
      precio: (() => {
        const original = (ap as any).precio_original ?? ap.precio;
        return typeof original === 'string' ? parseFloat(original) : original;
      })(),
      precio_con_descuento: ap.precio_con_descuento !== null && ap.precio_con_descuento !== undefined ? Number(ap.precio_con_descuento) : null,
      tiene_promocion: ap.tiene_promocion || false
    }));
  }
}
