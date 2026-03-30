import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { Product } from '../../../shared/components/product-card/product-card.component';
import { AnalyticsService, CartSnapshotItem } from '../analytics/analytics.service';
import { ProductService, Product as ServiceProduct } from '../product/product.service';

export interface CartItem {
  product: Product;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private itemsSubject = new BehaviorSubject<CartItem[]>([]);
  public items$: Observable<CartItem[]> = this.itemsSubject.asObservable();
  private trackTimer: any;

  constructor(
    private analyticsService: AnalyticsService,
    private productService: ProductService
  ) {
    this.loadCart();
    this.refreshProductData();
  }

  get items(): CartItem[] {
    return this.itemsSubject.value;
  }

  addToCart(product: Product, quantity: number = 1): void {
    const currentItems = [...this.items];
    const existingItem = currentItems.find(item => item.product.id === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      currentItems.push({ product, quantity });
    }

    this.updateCart(currentItems);
  }

  removeFromCart(productId: string): void {
    const currentItems = this.items.filter(item => item.product.id !== productId);
    this.updateCart(currentItems);
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    const currentItems = [...this.items];
    const item = currentItems.find(item => item.product.id === productId);
    if (item) {
      item.quantity = quantity;
      this.updateCart(currentItems);
    }
  }

  clearCart(): void {
    this.updateCart([]);
  }

  getCartSessionId(): string {
    return this.analyticsService.getSessionId();
  }

  clearCartStorage(): void {
    this.itemsSubject.next([]);
    try {
      localStorage.removeItem('lujo_aroma_cart');
    } catch {
      // ignore
    }
  }

  get total(): number {
    return this.items.reduce((sum, item) => sum + (this.getItemPrice(item.product) * item.quantity), 0);
  }

  get itemCount(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Returns the final price of a product, respecting any active promotion.
   */
  public getItemPrice(product: Product): number {
    const discounted: any = (product as any)?.precio_con_descuento;
    if (discounted !== null && discounted !== undefined && discounted !== '') {
      const n = typeof discounted === 'string' ? parseFloat(discounted) : Number(discounted);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const v: any = (product as any)?.price ?? (product as any)?.precio;
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private updateCart(items: CartItem[]): void {
    this.itemsSubject.next(items);
    localStorage.setItem('lujo_aroma_cart', JSON.stringify(items));
    this.scheduleCartTracking(items);
  }

  private scheduleCartTracking(items: CartItem[]): void {
    if (this.trackTimer) {
      clearTimeout(this.trackTimer);
    }

    this.trackTimer = setTimeout(() => {
      const snapshot: CartSnapshotItem[] = (items || []).map((item) => ({
        product_id: item.product.id,
        name: item.product.name,
        price: this.getItemPrice(item.product),
        quantity: Number(item.quantity || 0)
      }));
      const total = snapshot.reduce((sum, it) => sum + (it.price * it.quantity), 0);
      this.analyticsService.trackCartSnapshot(snapshot, total);
    }, 700);
  }

  private loadCart(): void {
    const stored = localStorage.getItem('lujo_aroma_cart');
    if (stored) {
      try {
        this.itemsSubject.next(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing stored cart', e);
        this.itemsSubject.next([]);
      }
    }
    this.refreshProductData();
  }

  /**
   * Fetches fresh product data from the catalog and updates cart items.
   * This ensures prices and promotions are always current.
   */
  public refreshProductData(): void {
    this.productService.getPublicCatalog().pipe(take(1)).subscribe({
      next: (freshProducts: ServiceProduct[]) => {
        const currentItems = [...this.items];
        let changed = false;

        currentItems.forEach(item => {
          const fresh = freshProducts.find(p => p.id === item.product.id);
          if (fresh) {
            // Update the product object with fresh data (prices, promos, etc.)
            item.product = fresh as any;
            changed = true;
          }
        });

        if (changed) {
          this.updateCart(currentItems);
        }
      },
      error: (err) => console.error('Error refreshing cart product data', err)
    });
  }
}
