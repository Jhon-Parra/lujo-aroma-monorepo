import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../config/api-config';

export interface MyReview {
  producto_id: string;
  rating: number;
  comentario?: string | null;
  creado_en: string;
}

export interface CreateReviewDto {
  product_id: string;
  order_id?: string;
  rating: number;
  comment?: string;
}

export interface ProductReview {
  id: string;
  rating: number;
  comentario?: string | null;
  creado_en: string;
  nombre: string;
  apellido: string;
  verificada?: boolean; // true = confirmed buyer; used for demo reviews
}

export interface ProductReviewSummary {
  average: number | string;
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private apiUrl = `${API_CONFIG.baseUrl}/reviews`;

  constructor(private http: HttpClient) {}

  getMyReviews(): Observable<MyReview[]> {
    return this.http.get<MyReview[]>(`${this.apiUrl}/my`, { withCredentials: true });
  }

  createReview(payload: CreateReviewDto): Observable<{ message: string; id: string }> {
    return this.http.post<{ message: string; id: string }>(this.apiUrl, payload, { withCredentials: true });
  }

  getProductReviews(productId: string): Observable<ProductReview[]> {
    return this.http.get<ProductReview[]>(`${this.apiUrl}/product/${encodeURIComponent(productId)}`);
  }

  getProductReviewSummary(productId: string): Observable<ProductReviewSummary> {
    return this.http.get<ProductReviewSummary>(`${this.apiUrl}/product/${encodeURIComponent(productId)}/summary`);
  }
}
