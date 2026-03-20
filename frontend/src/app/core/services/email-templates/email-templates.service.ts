import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../config/api-config';

export type OrderEmailTemplateSource = 'custom' | 'default';

export interface OrderEmailTemplate {
  status: string;
  subject: string;
  body_html: string;
  body_text?: string | null;
  source?: OrderEmailTemplateSource;
}

export interface OrderEmailLog {
  id: string;
  order_id?: string | null;
  status: string;
  to_email: string;
  from_email?: string | null;
  subject?: string | null;
  success: boolean;
  error_message?: string | null;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailTemplatesService {
  private apiUrl = `${API_CONFIG.baseUrl}/email-templates`;

  constructor(private http: HttpClient) {}

  getOrderTemplates(): Observable<{ templates: OrderEmailTemplate[] }> {
    return this.http.get<{ templates: OrderEmailTemplate[] }>(`${this.apiUrl}/orders`, { withCredentials: true });
  }

  updateOrderTemplate(status: string, payload: { subject: string; body_text: string; body_html?: string }): Observable<OrderEmailTemplate> {
    return this.http.put<OrderEmailTemplate>(`${this.apiUrl}/orders/${encodeURIComponent(status)}`, payload, { withCredentials: true });
  }

  getOrderEmailLogs(limit = 50): Observable<{ logs: OrderEmailLog[] }> {
    return this.http.get<{ logs: OrderEmailLog[] }>(`${this.apiUrl}/orders/logs?limit=${encodeURIComponent(String(limit))}`, { withCredentials: true });
  }
}
