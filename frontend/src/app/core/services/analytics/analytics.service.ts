import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../../config/api-config';

export type CartSnapshotItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
};

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private baseUrl = `${API_CONFIG.baseUrl}/intelligence`;
  private sessionKey = 'perfumissimo_cart_session_id';

  constructor(private http: HttpClient) {}

  getSessionId(): string {
    try {
      const existing = localStorage.getItem(this.sessionKey);
      if (existing) return existing;
      const generated = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(this.sessionKey, generated);
      return generated;
    } catch {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  trackSearch(query: string, productIds: string[], resultsCount: number): void {
    const payload = {
      query,
      product_ids: productIds,
      results_count: resultsCount,
      session_id: this.getSessionId()
    };
    this.http.post(`${this.baseUrl}/search`, payload, { withCredentials: true }).subscribe({
      error: () => {}
    });
  }

  trackProductView(productId: string): void {
    const payload = {
      product_id: productId,
      session_id: this.getSessionId()
    };
    this.http.post(`${this.baseUrl}/product-view`, payload, { withCredentials: true }).subscribe({
      error: () => {}
    });
  }

  trackCartSnapshot(items: CartSnapshotItem[], total: number): void {
    const payload = {
      session_id: this.getSessionId(),
      items,
      total
    };
    this.http.post(`${this.baseUrl}/cart`, payload, { withCredentials: true }).subscribe({
      error: () => {}
    });
  }

  markCartConverted(orderId: string): void {
    const payload = {
      session_id: this.getSessionId(),
      order_id: orderId
    };
    this.http.post(`${this.baseUrl}/cart/convert`, payload, { withCredentials: true }).subscribe({
      error: () => {}
    });
  }
}
