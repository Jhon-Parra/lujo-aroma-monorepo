import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../config/api-config';

export interface Category {
  id?: string;
  nombre: string;
  slug: string;
  activo?: boolean;
  creado_en?: string;
  total_productos?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private baseUrl = `${API_CONFIG.baseUrl}/categories`;

  constructor(private http: HttpClient) {}

  getPublicCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.baseUrl);
  }

  getAdminCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/admin`, { withCredentials: true });
  }

  createCategory(nombre: string): Observable<any> {
    return this.http.post(this.baseUrl, { nombre }, { withCredentials: true });
  }

  updateCategory(id: string, payload: { nombre?: string; activo?: boolean }): Observable<any> {
    return this.http.put(`${this.baseUrl}/${encodeURIComponent(id)}`, payload, { withCredentials: true });
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${encodeURIComponent(id)}`, { withCredentials: true });
  }
}
