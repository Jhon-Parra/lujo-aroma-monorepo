import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../config/api-config';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  constructor(private http: HttpClient) { }

  generateDescription(nombre: string, notas_olfativas: string): Observable<{ message: string, data: string }> {
    return this.http.post<{ message: string, data: string }>(
      `${API_CONFIG.baseUrl}/ai/generate-description`,
      { nombre, notas_olfativas },
      { withCredentials: true }
    );
  }
}
