import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Product {
  id?: string;
  nombre: string;
  genero?: string;
  categoria_nombre?: string | null;
  categoria_slug?: string | null;
  descripcion: string;
  notas_olfativas?: string | null;
  precio: number | string;
  precio_con_descuento?: number | string | null;
  precio_original?: number | string;
  promo_id?: string | null;
  promo_nombre?: string | null;
  porcentaje_descuento?: number | null;
  tiene_promocion?: boolean;
  es_nuevo?: boolean;
  nuevo_hasta?: string | null;
  stock: number;
  imagen_url?: string;
  unidades_vendidas?: number;
}

export interface LowStockProduct {
  id: string;
  nombre: string;
  stock: number;
  imagen_url?: string | null;
}

export interface LowStockResponse {
  threshold: number;
  count: number;
  items: LowStockProduct[];
}

import { API_CONFIG } from '../../config/api-config';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private publicUrl = `${API_CONFIG.baseUrl}/products`;

  constructor(private http: HttpClient) { }

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.publicUrl}`);
  }

  getPublicCatalog(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.publicUrl}/catalog`);
  }

  getNewestProducts(limit = 8): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.publicUrl}/newest?limit=${encodeURIComponent(String(limit))}`);
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.publicUrl}/${id}`);
  }

  getRelatedProducts(id: string, limit = 4): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.publicUrl}/${encodeURIComponent(id)}/related?limit=${encodeURIComponent(String(limit))}`);
  }

  createProduct(productData: FormData): Observable<any> {
    return this.http.post(this.publicUrl, productData, { withCredentials: true });
  }

  updateProduct(id: string, productData: FormData): Observable<any> {
    return this.http.put(`${this.publicUrl}/${id}`, productData, { withCredentials: true });
  }

  deleteProduct(id: string): Observable<any> {
    return this.http.delete(`${this.publicUrl}/${id}`, { withCredentials: true });
  }

  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${this.publicUrl}/import/template`, { withCredentials: true, responseType: 'blob' });
  }

  importFromSpreadsheet(file: File, dryRun = false): Observable<any> {
    const formData = new FormData();
    formData.append('archivo', file);
    const qs = dryRun ? '?dry_run=true' : '';
    return this.http.post(`${this.publicUrl}/import${qs}`, formData, { withCredentials: true });
  }

  getLowStock(threshold = 5, limit = 20): Observable<LowStockResponse> {
    return this.http.get<LowStockResponse>(`${this.publicUrl}/low-stock`, {
      withCredentials: true,
      params: {
        threshold: String(threshold),
        limit: String(limit)
      }
    });
  }
}
