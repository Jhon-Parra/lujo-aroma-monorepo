import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../config/api-config';

export type QuizAnswers = {
  for_who?: 'hombre' | 'mujer' | 'unisex';
  aroma?: 'dulce' | 'fresco' | 'amaderado' | 'floral' | 'citrico' | 'oriental';
  occasion?: 'diario' | 'trabajo' | 'fiesta' | 'citas' | 'eventos';
  intensity?: 'suave' | 'moderada' | 'fuerte';
  climate?: 'calido' | 'templado' | 'frio';
};

export type RecommendationProduct = {
  id: string;
  nombre: string;
  precio: number;
  imagen_url?: string | null;
  genero?: string | null;
  categoria_nombre?: string | null;
  categoria_slug?: string | null;
};

export type RecommendationItem = {
  rank: number;
  reasons: string[];
  short_explanation: string;
  product: RecommendationProduct;
};

export type RecommendationResponse = {
  mode: 'quiz' | 'free';
  recommendations: RecommendationItem[];
};

@Injectable({
  providedIn: 'root'
})
export class RecommendationService {
  private baseUrl = `${API_CONFIG.baseUrl}/recommendations`;

  constructor(private http: HttpClient) {}

  getSessionId(): string {
    try {
      const key = 'perfumissimo_reco_session_v1';
      const existing = sessionStorage.getItem(key);
      if (existing) return existing;
      const id = 'sess_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
      sessionStorage.setItem(key, id);
      return id;
    } catch {
      return '';
    }
  }

  recommendFromQuiz(answers: QuizAnswers): Observable<RecommendationResponse> {
    return this.http.post<RecommendationResponse>(`${this.baseUrl}/quiz`, {
      session_id: this.getSessionId(),
      answers
    });
  }

  recommendFromFreeText(query: string): Observable<RecommendationResponse> {
    return this.http.post<RecommendationResponse>(`${this.baseUrl}/free`, {
      session_id: this.getSessionId(),
      query
    });
  }

  recordEvent(event_type: string, payload?: any): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/events`, {
      session_id: this.getSessionId(),
      event_type,
      payload: payload ?? null
    });
  }
}
