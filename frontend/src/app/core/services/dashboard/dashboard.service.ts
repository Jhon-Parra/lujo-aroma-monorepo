import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../config/api-config';
import { HttpParams } from '@angular/common/http';

export interface DashboardTopProduct {
  id: string;
  nombre: string;
  imagen_url: string | null;
  unidades: number;
  ingresos: number;
}

export interface DashboardSummary {
  months_back?: number;
  total_revenue: number;
  pending_orders: number;
  products_count: number;
  users_count: number;
  monthly_sales: Array<{ month_start: string; revenue: number; orders_count: number }>;
  orders_by_status?: Record<string, number>;
  pending_orders_preview?: Array<{
    id: string;
    total: number;
    estado: string;
    creado_en: string;
    cliente_nombre: string;
    cliente_email: string;
    items: Array<{ producto_id: string; nombre: string; cantidad: number; imagen_url: string | null }>;
  }>;
  top_products: DashboardTopProduct[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = `${API_CONFIG.baseUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  getSummary(params?: { months_back?: number }): Observable<DashboardSummary> {
    let httpParams = new HttpParams();
    if (params?.months_back) {
      httpParams = httpParams.set('months_back', String(params.months_back));
    }
    return this.http.get<DashboardSummary>(`${this.apiUrl}/summary`, { withCredentials: true, params: httpParams });
  }
}
