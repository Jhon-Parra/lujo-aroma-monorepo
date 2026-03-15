import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../config/api-config';

export type WompiMerchant = {
  name: string | null;
  presigned_acceptance: {
    acceptance_token: string;
    permalink: string;
  };
};

export type WompiClientConfig = {
  env: 'sandbox' | 'production';
  public_key: string;
  base_url: string;
  has_private_key?: boolean;
};

export type WompiPseBank = {
  financial_institution_code: string;
  financial_institution_name: string;
};

export type WompiPseCheckoutRequest = {
  total: number;
  shipping_address: string;
  items: Array<{ product_id: string; quantity: number; price: number }>;

  acceptance_token: string;
  user_type: '0' | '1';
  user_legal_id_type: string;
  user_legal_id: string;
  financial_institution_code: string;
};

export type WompiPseCheckoutResponse = {
  message: string;
  orderId: string;
  transactionId: string;
  asyncPaymentUrl: string;
  redirectUrl: string;
};

export type WompiNequiCheckoutRequest = {
  total: number;
  shipping_address: string;
  items: Array<{ product_id: string; quantity: number; price: number }>;

  acceptance_token: string;
  phone_number: string;
};

export type WompiNequiCheckoutResponse = {
  message: string;
  orderId: string;
  transactionId: string;
  status: string | null;
  redirectUrl: string;
};

export type WompiCardCheckoutRequest = {
  total: number;
  shipping_address: string;
  items: Array<{ product_id: string; quantity: number; price: number }>;

  acceptance_token: string;
  token: string;
  installments: number;
};

export type WompiCardCheckoutResponse = {
  message: string;
  orderId: string;
  transactionId: string;
  status: string | null;
  redirectUrl: string;
};

@Injectable({
  providedIn: 'root'
})
export class WompiService {
  private apiUrl = `${API_CONFIG.baseUrl}/payments/wompi`;

  constructor(private http: HttpClient) {}

  getMerchant(): Observable<WompiMerchant> {
    return this.http.get<WompiMerchant>(`${this.apiUrl}/merchant`);
  }

  getConfig(): Observable<WompiClientConfig> {
    return this.http.get<WompiClientConfig>(`${this.apiUrl}/config`);
  }

  getPseBanks(): Observable<{ data: WompiPseBank[] }> {
    return this.http.get<{ data: WompiPseBank[] }>(`${this.apiUrl}/pse/banks`);
  }

  createPseCheckout(payload: WompiPseCheckoutRequest): Observable<WompiPseCheckoutResponse> {
    return this.http.post<WompiPseCheckoutResponse>(`${this.apiUrl}/pse/checkout`, payload, {
      withCredentials: true
    });
  }

  createNequiCheckout(payload: WompiNequiCheckoutRequest): Observable<WompiNequiCheckoutResponse> {
    return this.http.post<WompiNequiCheckoutResponse>(`${this.apiUrl}/nequi/checkout`, payload, {
      withCredentials: true
    });
  }

  createCardCheckout(payload: WompiCardCheckoutRequest): Observable<WompiCardCheckoutResponse> {
    return this.http.post<WompiCardCheckoutResponse>(`${this.apiUrl}/card/checkout`, payload, {
      withCredentials: true
    });
  }

  syncOrderPayment(orderId: string): Observable<{ ok: boolean; orderId: string; wompiStatus: string }> {
    return this.http.post<{ ok: boolean; orderId: string; wompiStatus: string }>(
      `${this.apiUrl}/orders/${encodeURIComponent(orderId)}/sync`,
      {},
      { withCredentials: true }
    );
  }
}
