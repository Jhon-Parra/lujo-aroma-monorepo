import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Promotion {
  id: string;
  nombre: string;
  descripcion?: string | null;
  imagen_url?: string | null;
  discount_type?: 'PERCENT' | 'AMOUNT' | null;
  porcentaje_descuento: number;
  amount_discount?: number | null;
  priority?: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;

  // Reglas de asignacion (admin)
  product_scope?: 'GLOBAL' | 'SPECIFIC' | 'GENDER';
  // Cuando product_scope = 'GENDER', este campo guarda el slug de categoria
  product_gender?: string | null;
  product_ids?: string[];
  audience_scope?: 'ALL' | 'SEGMENT' | 'CUSTOMERS';
  audience_segment?: string | null;
  audience_user_ids?: string[];
}

export type CreatePromotionDto = Omit<Promotion, 'id'>;
export type UpdatePromotionDto = Partial<Omit<Promotion, 'id'>>;

import { API_CONFIG } from '../../config/api-config';

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  private apiUrl = `${API_CONFIG.baseUrl}/promotions`;

  constructor(private http: HttpClient) { }

  // Public: solo promos publicas activas
  getPromotions(): Observable<Promotion[]> {
    return this.http.get<Promotion[]>(this.apiUrl);
  }

  // Admin: listado completo con reglas
  getAdminPromotions(): Observable<Promotion[]> {
    return this.http.get<Promotion[]>(`${this.apiUrl}/admin`, { withCredentials: true });
  }

  createPromotion(payload: CreatePromotionDto | FormData): Observable<{ message: string; id: string }> {
    return this.http.post<{ message: string; id: string }>(this.apiUrl, payload as any, { withCredentials: true });
  }

  updatePromotion(id: string, payload: UpdatePromotionDto | FormData): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, payload as any, { withCredentials: true });
  }

  setActive(id: string, activo: boolean): Observable<{ message: string; activo: boolean }> {
    return this.http.patch<{ message: string; activo: boolean }>(`${this.apiUrl}/${id}/active`, { activo }, { withCredentials: true });
  }

  deletePromotion(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  trackFabClick(): Observable<{ ok: boolean; clicks: number }> {
    return this.http.post<{ ok: boolean; clicks: number }>(`${this.apiUrl}/fab/click`, {});
  }

  getFabMetrics(): Observable<{ ok: boolean; clicks: number }> {
    return this.http.get<{ ok: boolean; clicks: number }>(`${this.apiUrl}/fab/metrics`, { withCredentials: true });
  }
}
