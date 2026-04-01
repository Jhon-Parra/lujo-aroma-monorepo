import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartService } from '../../../core/services/cart/cart.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { Router } from '@angular/router';
import { ToastService } from '../toast/toast.service';

export interface Product {
  id: string;
  slug?: string;
  promo_id?: string | null;
  name: string;
  notes: string;
  genero?: string;
  casa?: string | null;
  house?: string | null;
  categoria_nombre?: string | null;
  categoria_slug?: string | null;
  price: number;
  imageUrl: string;
  soldCount: string;
  isNew: boolean;
  precio?: number | string;
  precio_con_descuento?: number | string | null;
  tiene_promocion?: boolean;
  imagen_url?: string;
  descripcion?: string;
  nombre?: string;
  unidades_vendidas?: number;
  stock?: number;
}

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.css']
})
export class ProductCardComponent {
  @Input() product: Product = {
    id: '1',
    name: 'FLORAL ELEGANCE',
    notes: 'Jazmín, Rosas y Ámbar.',
    price: 75.00,
    imageUrl: 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=800&auto=format&fit=crop',
    soldCount: '0',
    isNew: true
  };

  constructor(
    private cartService: CartService,
    private favoritesService: FavoritesService,
    private router: Router,
    private toastService: ToastService
  ) { }

  private getGeneroSlug(): 'mujer' | 'hombre' | 'unisex' {
    const slug = String((this.product as any)?.genero || '').trim().toLowerCase();
    if (slug === 'mujer' || slug === 'hombre' || slug === 'unisex') return slug;
    return 'unisex';
  }

  private getHouseSlug(): string {
    const anyP: any = this.product as any;
    const slug = String(anyP?.categoria_slug || anyP?.casa || anyP?.house || '').trim().toLowerCase();
    return slug;
  }

  private titleFromSlug(slugRaw: string): string {
    const slug = String(slugRaw || '').trim().toLowerCase();
    if (!slug) return '';
    return slug
      .split('-')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  getGeneroLabel(): string {
    const g = this.getGeneroSlug();
    if (g === 'mujer') return 'Mujer';
    if (g === 'hombre') return 'Hombre';
    return 'Unisex';
  }

  getHouseLabel(): string {
    const anyP: any = this.product as any;
    const name = String(anyP?.categoria_nombre || '').trim();
    if (name) return name;
    return this.titleFromSlug(this.getHouseSlug());
  }

  getProductTagLabel(): string {
    const house = this.getHouseLabel();
    const genero = this.getGeneroLabel();
    return house ? `${genero} · ${house}` : genero;
  }

  getGeneroClass(): { [klass: string]: boolean } {
    const slug = this.getGeneroSlug();
    return {
      'bg-rose-100 text-rose-700 border-rose-200': slug === 'mujer',
      'bg-blue-100 text-blue-700 border-blue-200': slug === 'hombre',
      'bg-emerald-100 text-emerald-700 border-emerald-200': slug === 'unisex'
    };
  }

  get isFavorite(): boolean {
    return this.favoritesService.isFavorite(this.product.id);
  }

  toggleFavorite(event: Event) {
    event.stopPropagation();
    this.favoritesService.toggleFavorite(this.product);
  }

  addToCart(event?: Event) {
    event?.stopPropagation();
    if ((this.product as any)?.stock <= 0) {
      this.toastService.error('Este producto se encuentra agotado temporalmente.');
      return;
    }
    this.cartService.addToCart(this.product);
    const name = this.product?.name || this.product?.nombre || 'Producto';
    this.toastService.success(`${name} se agregó al carrito de compras.`);
  }

  getOriginalPrice(): number {
    const v: any = (this.product as any)?.precio ?? (this.product as any)?.price;
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  getFinalPrice(): number {
    const discounted: any = (this.product as any)?.precio_con_descuento;
    if (discounted !== null && discounted !== undefined && discounted !== '') {
      const n = typeof discounted === 'string' ? parseFloat(discounted) : Number(discounted);
      if (Number.isFinite(n)) return n;
    }
    const v: any = (this.product as any)?.price;
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  getSavings(): number {
    const save = this.getOriginalPrice() - this.getFinalPrice();
    return save > 0 ? save : 0;
  }

  openDetail(): void {
    const identifier = (this.product as any)?.slug || this.product?.id;
    if (!identifier) return;
    this.router.navigate(['/product', identifier]);
  }
}
