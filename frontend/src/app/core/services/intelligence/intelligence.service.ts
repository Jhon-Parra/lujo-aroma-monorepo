import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../config/api-config';

export type IntelligenceSummary = {
  days: number;
  filters: { category: string | null; product_id: string | null };
  top_searches: Array<{ product_id: string; nombre: string; searches: number; trend: number[] }>;
  abandoned: {
    total: number;
    lost_value: number;
    trend_days: string[];
    trend_counts: number[];
    top_products: Array<{ product_id: string; nombre: string; count: number }>;
    recent: Array<{ session_id: string; user_email: string | null; total: number; updated_at: string; items: any[] }>;
  };
  frequent_clients: Array<{ user_id: string; nombre: string; apellido: string; email: string; orders_count: number; total_spent: number }>;
  sales_by_category: Array<{ category: string; revenue: number; units: number; top_product: string }>;
  alerts: Array<{ type: string; title: string; detail: string; meta: string; tone: 'up' | 'down' | 'warn' }>;
};

@Injectable({
  providedIn: 'root'
})
export class IntelligenceService {
  private baseUrl = `${API_CONFIG.baseUrl}/intelligence`;

  constructor(private http: HttpClient) {}

  getSummary(params?: { days?: number; category?: string; product_id?: string }): Observable<IntelligenceSummary> {
    const qs = new URLSearchParams();
    if (params?.days) qs.set('days', String(params.days));
    if (params?.category) qs.set('category', params.category);
    if (params?.product_id) qs.set('product_id', params.product_id);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.http.get<IntelligenceSummary>(`${this.baseUrl}/summary${suffix}`, { withCredentials: true });
  }
}
