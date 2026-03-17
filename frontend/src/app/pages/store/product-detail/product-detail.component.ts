import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ProductService, Product as ApiProduct } from '../../../core/services/product/product.service';
import { CartService } from '../../../core/services/cart/cart.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { ReviewService, ProductReview, ProductReviewSummary } from '../../../core/services/review/review.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import { AnalyticsService } from '../../../core/services/analytics/analytics.service';

import { Product as CardProduct } from '../../../shared/components/product-card/product-card.component';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';

import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ProductCardComponent, SkeletonCardComponent],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnDestroy {
  loading = true;
  error = '';
  product: ApiProduct | null = null;

  reviewsLoading = false;
  reviewsError = '';
  reviews: ProductReview[] = [];
  reviewSummary: ProductReviewSummary = { average: 0, count: 0 };

  relatedLoading = false;
  related: CardProduct[] = [];

  quantity = 1;
  galleryImages: string[] = [];
  selectedImage: string = '';
  addedToCartNotice = '';
  private noticeTimer?: any;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cartService: CartService,
    private favoritesService: FavoritesService,
    private reviewService: ReviewService,
    private seo: SeoService,
    private analyticsService: AnalyticsService
  ) {}

  ngOnDestroy(): void {
    this.seo.clearJsonLd();
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = undefined;
    }
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.error = 'Producto inválido.';
        this.loading = false;
        return;
      }
      this.fetchProduct(id);
    });
  }

  private fetchProduct(id: string): void {
    this.loading = true;
    this.error = '';
    this.product = null;
    this.quantity = 1;

    this.productService.getProduct(id).subscribe({
      next: (p) => {
        this.product = p;
        this.loading = false;

        this.galleryImages = [
          p.imageUrl || p.imagen_url || '',
          p.imageUrl2 || p.imagen_url_2 || '',
          p.imageUrl3 || p.imagen_url_3 || ''
        ].filter(url => !!url);
        this.selectedImage = this.galleryImages[0] || '';

        const anyP: any = p as any;
        const title = `${String(anyP?.nombre || 'Producto')} | Perfumissimo`;
        const description = String(anyP?.descripcion || 'Perfume disponible en Perfumissimo.').trim();
        const image = this.selectedImage || String(anyP?.imagen_url || '').trim();
        this.seo.set({ title, description, image, type: 'product' });

        const price = Number(anyP?.precio_con_descuento ?? anyP?.precio ?? 0);
        this.seo.setJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: String(anyP?.nombre || 'Producto'),
          description,
          image: image ? [image] : undefined,
          sku: String(p.id || id),
          brand: {
            '@type': 'Brand',
            name: 'Perfumissimo'
          },
          offers: {
            '@type': 'Offer',
            url: window.location.href,
            priceCurrency: 'COP',
            price: Number.isFinite(price) ? String(price) : '0',
            availability: (anyP?.stock ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            shippingDetails: {
              '@type': 'OfferShippingDetails',
              shippingRate: {
                '@type': 'MonetaryAmount',
                value: '0',
                currency: 'COP'
              },
              deliveryTime: {
                '@type': 'ShippingDeliveryTime',
                handlingTime: {
                  '@type': 'QuantitativeValue',
                  minValue: '1',
                  maxValue: '2',
                  unitCode: 'DAY'
                },
                transitTime: {
                  '@type': 'ShippingDeliveryTime',
                  minValue: '2',
                  maxValue: '5',
                  unitCode: 'DAY'
                }
              }
            }
          }
        });

        // Cargar reseñas (si existen en BD)
        this.loadReviews(String(p.id || id));

        // Relacionados
        this.loadRelated(String(p.id || id));

        // Tracking de vista
        this.analyticsService.trackProductView(String(p.id || id));
      },
      error: (err) => {
        console.error('Error loading product:', err);
        this.error = err?.error?.error || 'No se pudo cargar el producto.';
        this.loading = false;

        this.seo.set({
          title: 'Producto no encontrado | Perfumissimo',
          description: 'El producto que buscas no esta disponible.'
        });
        this.seo.clearJsonLd();
      }
    });
  }

  private loadRelated(productId: string): void {
    this.relatedLoading = true;
    this.related = [];

    this.productService.getRelatedProducts(productId, 4).subscribe({
      next: (rows) => {
        const list = rows || [];
        this.related = list.map((ap: any) => {
          const original = ap?.precio_original ?? ap?.precio;
          const originalN = typeof original === 'string' ? parseFloat(original) : Number(original);
          const final = ap?.price ? Number(ap.price) : (ap?.precio_con_descuento ? Number(ap.precio_con_descuento) : (typeof ap?.precio === 'string' ? parseFloat(ap.precio) : Number(ap?.precio || 0)));
          return {
            id: ap.id || '',
            promo_id: ap.promo_id || null,
            name: ap.name || ap.nombre,
            notes: ap.notes || ap.notas_olfativas || ap.descripcion,
            price: Number.isFinite(final) ? final : 0,
            imageUrl: ap.imageUrl || ap.imagen_url || 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=800&auto=format&fit=crop',
            soldCount: String(ap.soldCount || ap.unidades_vendidas || 0),
            isNew: !!(ap.isNew ?? ap.es_nuevo),
            genero: ap.genero,
            categoria_nombre: ap.categoria_nombre ?? null,
            categoria_slug: ap.categoria_slug ?? null,
            precio: Number.isFinite(originalN) ? originalN : (Number.isFinite(final) ? final : 0),
            precio_con_descuento: ap.precio_con_descuento !== null && ap.precio_con_descuento !== undefined ? Number(ap.precio_con_descuento) : null,
            tiene_promocion: !!ap.tiene_promocion
          };
        });
        this.relatedLoading = false;
      },
      error: () => {
        this.related = [];
        this.relatedLoading = false;
      }
    });
  }

  private loadReviews(productId: string): void {
    this.reviewsLoading = true;
    this.reviewsError = '';
    this.reviews = [];
    this.reviewSummary = { average: 0, count: 0 };

    this.reviewService.getProductReviewSummary(productId).subscribe({
      next: (s) => {
        this.reviewSummary = s;
      },
      error: (err) => {
        // Si la tabla no existe, el backend devuelve 400. No bloquear el detalle.
        this.reviewsError = err?.error?.error || '';
      }
    });

    this.reviewService.getProductReviews(productId).subscribe({
      next: (rows) => {
        this.reviews = rows || [];
        this.reviewsLoading = false;
      },
      error: (err) => {
        this.reviewsError = err?.error?.error || 'No se pudieron cargar las reseñas.';
        this.reviewsLoading = false;
      }
    });
  }

  getAverageRating(): number {
    const avg: any = (this.reviewSummary as any)?.average;
    const n = typeof avg === 'string' ? parseFloat(avg) : Number(avg);
    return Number.isFinite(n) ? n : 0;
  }

  getStarFill(i: number): boolean {
    return this.getAverageRating() >= i;
  }

  getNotes(): string {
    const anyP: any = this.product as any;
    const notes = String(anyP?.notes || anyP?.notas_olfativas || '').trim();
    return notes || '—';
  }

  getPrecioNumber(): number {
    const v: any = this.product?.precio;
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  hasPromotion(): boolean {
    const anyP: any = this.product as any;
    if (!anyP) return false;
    if (anyP.tiene_promocion === true) return true;

    const amount = Number(anyP.monto_descuento || 0);
    if (Number.isFinite(amount) && amount > 0 && anyP.precio_con_descuento !== null && anyP.precio_con_descuento !== undefined) {
      return true;
    }

    const pct = Number(anyP.porcentaje_descuento || 0);
    return Number.isFinite(pct) && pct > 0 && anyP.precio_con_descuento !== null && anyP.precio_con_descuento !== undefined;
  }

  isAmountPromotion(): boolean {
    const anyP: any = this.product as any;
    if (!anyP) return false;
    const dtype = String(anyP.discount_type || '').toUpperCase();
    if (dtype === 'AMOUNT') return true;
    const pct = this.getPromotionPercent();
    const amount = this.getPromotionAmount();
    return pct <= 0 && amount > 0;
  }

  getPromotionAmount(): number {
    const anyP: any = this.product as any;
    const amount = Number(anyP?.monto_descuento || 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  getPromotionPercent(): number {
    const anyP: any = this.product as any;
    const pct = Number(anyP?.porcentaje_descuento || 0);
    return Number.isFinite(pct) ? pct : 0;
  }

  getPromoName(): string {
    const anyP: any = this.product as any;
    return String(anyP?.promo_nombre || '').trim();
  }

  getFinalPriceNumber(): number {
    const anyP: any = this.product as any;
    const discounted = anyP?.precio_con_descuento;
    if (this.hasPromotion() && discounted !== null && discounted !== undefined) {
      const n = typeof discounted === 'string' ? parseFloat(discounted) : Number(discounted);
      if (Number.isFinite(n)) return n;
    }
    return this.getPrecioNumber();
  }

  getOriginalPriceNumber(): number {
    const anyP: any = this.product as any;
    const original = anyP?.precio_original;
    if (original !== null && original !== undefined) {
      const n = typeof original === 'string' ? parseFloat(original) : Number(original);
      if (Number.isFinite(n)) return n;
    }
    return this.getPrecioNumber();
  }

  decrementQty(): void {
    this.quantity = Math.max(1, Math.trunc(Number(this.quantity || 1)) - 1);
  }

  incrementQty(): void {
    this.quantity = Math.max(1, Math.trunc(Number(this.quantity || 1)) + 1);
  }

  getCategoryLabel(): string {
    const anyP: any = this.product as any;
    const name = String(anyP?.categoria_nombre || '').trim();
    if (name) return name;

    const slug = String(anyP?.categoria_slug || this.product?.genero || 'unisex').trim().toLowerCase();
    if (slug === 'mujer') return 'Para Mujer';
    if (slug === 'hombre') return 'Para Hombre';
    if (slug === 'unisex' || !slug) return 'Unisex';

    return slug
      .split('-')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  getCategorySlug(): string {
    const anyP: any = this.product as any;
    const slug = String(anyP?.categoria_slug || this.product?.genero || 'unisex').trim().toLowerCase();
    return slug || 'unisex';
  }

  getCategoryClass(): { [klass: string]: boolean } {
    const slug = this.getCategorySlug();
    return {
      'bg-pink-50 text-pink-600 border-pink-100': slug === 'mujer',
      'bg-blue-50 text-blue-600 border-blue-100': slug === 'hombre',
      'bg-gray-100 text-gray-500 border-gray-200': slug === 'unisex',
      'bg-[#f9f9f6] text-soft-charcoal border-[#e7e7df]': slug !== 'mujer' && slug !== 'hombre' && slug !== 'unisex'
    };
  }

  get isFavorite(): boolean {
    const id = String(this.product?.id || '');
    if (!id) return false;
    return this.favoritesService.isFavorite(id);
  }

  toggleFavorite(): void {
    const card = this.toCardProduct();
    if (!card) return;
    this.favoritesService.toggleFavorite(card);
  }

  addToCart(): void {
    const card = this.toCardProduct();
    if (!card) return;
    const qty = Math.max(1, Math.trunc(Number(this.quantity || 1)));
    this.quantity = qty;

    const stock = Number((this.product as any)?.stock ?? 0);
    if (Number.isFinite(stock) && stock <= 0) {
      this.addedToCartNotice = 'Este producto no tiene stock.';
      if (this.noticeTimer) clearTimeout(this.noticeTimer);
      this.noticeTimer = setTimeout(() => {
        this.addedToCartNotice = '';
      }, 2200);
      return;
    }

    const finalQty = Number.isFinite(stock) && stock > 0 ? Math.min(qty, stock) : qty;
    if (finalQty !== qty) {
      this.quantity = finalQty;
    }

    this.cartService.addToCart(card, finalQty);

    this.addedToCartNotice = finalQty !== qty && Number.isFinite(stock)
      ? `Agregado al carrito (máximo disponible: ${stock}).`
      : 'Agregado al carrito.';
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.addedToCartNotice = '';
    }, 2200);
  }

  private toCardProduct(): CardProduct | null {
    if (!this.product?.id) return null;
    const price = this.getFinalPriceNumber();
    return {
      id: this.product.id,
      name: this.product.nombre,
      notes: this.getNotes() === '—' ? '' : this.getNotes(),
      genero: this.product.genero,
      categoria_nombre: (this.product as any).categoria_nombre ?? null,
      categoria_slug: (this.product as any).categoria_slug ?? null,
      price: Number.isFinite(price) ? price : 0,
      imageUrl: this.product.imagen_url || 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=800&auto=format&fit=crop',
      soldCount: String(this.product.unidades_vendidas || 0),
      isNew: !!this.product.es_nuevo,
      precio: this.getOriginalPriceNumber(),
      precio_con_descuento: this.hasPromotion() ? this.getFinalPriceNumber() : null,
      tiene_promocion: this.hasPromotion(),
      descripcion: this.product.descripcion,
      nombre: this.product.nombre,
      imagen_url: this.product.imagen_url,
      unidades_vendidas: this.product.unidades_vendidas
    };
  }

  setMainImage(url: string): void {
    this.selectedImage = url;
  }
}
