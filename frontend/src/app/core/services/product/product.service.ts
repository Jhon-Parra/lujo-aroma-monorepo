import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Product {
  id?: string;
  slug?: string;
  nombre: string;
  name?: string; // Alias
  genero?: string;
  casa?: string | null;
  house?: string | null; // Alias
  categoria_nombre?: string | null;
  categoria_slug?: string | null;
  descripcion: string;
  description?: string; // Alias
  notas_olfativas?: string | null;
  notes?: string | null; // Alias
  precio: number | string;
  price?: number | string; // Alias
  precio_con_descuento?: number | string | null;
  precio_original?: number | string;
  promo_id?: string | null;
  promo_nombre?: string | null;
  porcentaje_descuento?: number | null;
  tiene_promocion?: boolean;
  es_nuevo?: boolean;
  isNew?: boolean; // Alias
  nuevo_hasta?: string | null;
  stock: number;
  imagen_url?: string;
  imageUrl?: string; // Alias
  imagen_url_2?: string;
  imageUrl2?: string; // Alias
  imagen_url_3?: string;
  imageUrl3?: string; // Alias
  unidades_vendidas?: number;
  soldCount?: number; // Alias
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

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: T[];
}

import { API_CONFIG } from '../../config/api-config';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private publicUrl = `${API_CONFIG.baseUrl}/products`;

  constructor(private http: HttpClient) { }

  /**
   * Defensive normalization: some deployments/caches might return legacy shapes.
   * We always want a PaginatedResponse with `items` as an array.
   */
  private normalizePaginatedResponse<T>(res: any, fallbackPageSize: number): PaginatedResponse<T> {
    const items: T[] =
      Array.isArray(res?.items) ? (res.items as T[]) :
      Array.isArray(res?.data?.items) ? (res.data.items as T[]) :
      Array.isArray(res?.rows) ? (res.rows as T[]) :
      Array.isArray(res) ? (res as T[]) :
      [];

    const totalRaw = res?.total ?? res?.count ?? items.length;
    const pageRaw = res?.page ?? 1;
    const pageSizeRaw = res?.pageSize ?? res?.limit ?? fallbackPageSize ?? items.length;

    const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : items.length;
    const page = Number.isFinite(Number(pageRaw)) ? Math.max(1, Math.trunc(Number(pageRaw))) : 1;
    const pageSize = Number.isFinite(Number(pageSizeRaw)) ? Math.max(1, Math.trunc(Number(pageSizeRaw))) : Math.max(1, items.length);
    const totalPagesRaw = res?.totalPages;
    const totalPages = Number.isFinite(Number(totalPagesRaw))
      ? Math.max(1, Math.trunc(Number(totalPagesRaw)))
      : Math.max(1, Math.ceil(total / pageSize));

    return { total, page, pageSize, totalPages, items };
  }

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.publicUrl}`);
  }

  getPublicCatalog(page = 1, limit = 12, query = ''): Observable<PaginatedResponse<Product>> {
    const q = encodeURIComponent(query.trim());
    return this.http.get<any>(
      `${this.publicUrl}/catalog?page=${page}&limit=${limit}&q=${q}`
    ).pipe(
      map(res => this.normalizePaginatedResponse<Product>(res, limit))
    );
  }

  /**
   * Returns up to 'limit' products whose name matches the query.
   * Used by the navbar autocomplete dropdown.
   */
  searchSuggestions(query: string, limit = 5): Observable<Product[]> {
    const q = encodeURIComponent(query.trim());
    return this.http.get<any>(
      `${this.publicUrl}/catalog?q=${q}&limit=${limit}`
    ).pipe(
      map(res => this.normalizePaginatedResponse<Product>(res, limit).items.slice(0, limit))
    );
  }

  getNewestProducts(limit = 8): Observable<PaginatedResponse<Product>> {
    return this.http.get<any>(
      `${this.publicUrl}/newest?limit=${encodeURIComponent(String(limit))}`
    ).pipe(
      map(res => this.normalizePaginatedResponse<Product>(res, limit))
    );
  }

  getBestsellers(limit = 4): Observable<PaginatedResponse<Product>> {
    return this.http.get<any>(
      `${this.publicUrl}/bestsellers?limit=${encodeURIComponent(String(limit))}`
    ).pipe(
      map(res => this.normalizePaginatedResponse<Product>(res, limit))
    );
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
