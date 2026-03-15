import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../config/api-config';

export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string;

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_type?: InstagramMediaType;
  timestamp?: string;
}

export interface InstagramMediaResponse {
  enabled: boolean;
  items: InstagramMediaItem[];
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InstagramService {
  private apiUrl = `${API_CONFIG.baseUrl}/social/instagram/media`;

  constructor(private http: HttpClient) {}

  getMedia(limit = 12): Observable<InstagramMediaResponse> {
    return this.http.get<InstagramMediaResponse>(`${this.apiUrl}?limit=${encodeURIComponent(String(limit))}`);
  }
}
