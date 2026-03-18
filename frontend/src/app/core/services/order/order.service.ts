import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CartItemForOrder {
  product_id: string;
  quantity: number;
  price: number;
}

export interface CreateOrderDto {
  total: number;
  shipping_address: string;
  items: CartItemForOrder[];
  transaction_code?: string;
  cart_session_id?: string;

  cart_recovery_applied?: boolean;
  cart_recovery_discount_pct?: number;

  envio_prioritario?: boolean;
  perfume_lujo?: boolean;
}

export interface OrderItem {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  imagen_url?: string;
}

export interface Order {
  id: string;
  total: number;
  subtotal_productos?: number;
  envio_prioritario?: boolean;
  costo_envio_prioritario?: number;
  perfume_lujo?: boolean;
  costo_perfume_lujo?: number;
  estado: 'PENDIENTE' | 'PAGADO' | 'PROCESANDO' | 'ENVIADO' | 'CANCELADO' | 'ENTREGADO';
  direccion_envio: string;
  codigo_transaccion?: string;
  creado_en: string;
  items: OrderItem[];
  // Admin fields
  cliente_nombre?: string;
  cliente_email?: string;
  total_items?: number;
}

import { API_CONFIG } from '../../config/api-config';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${API_CONFIG.baseUrl}/orders`;

  constructor(private http: HttpClient) { }

  createOrder(orderData: CreateOrderDto): Observable<{ message: string; orderId: string }> {
    return this.http.post<{ message: string; orderId: string }>(
      this.apiUrl,
      orderData,
      { withCredentials: true }
    );
  }

  getMyOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/my-orders`, { withCredentials: true }).pipe(
      map((orders) => (orders || []).map(o => ({
        ...o,
        // JSON_ARRAYAGG puede devolver null cuando no hay items — normalizamos a []
        items: Array.isArray(o.items) ? o.items.filter(i => i != null) : []
      })))
    );
  }

  getMyOrderById(orderId: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/my-orders/${encodeURIComponent(orderId)}`, { withCredentials: true }).pipe(
      map((o: Order) => ({ ...o, items: Array.isArray(o?.items) ? o.items.filter(i => i != null) : [] }))
    );
  }

  getAllOrders(filters?: { status?: string; q?: string }): Observable<Order[]> {
    const status = (filters?.status || '').trim();
    const q = (filters?.q || '').trim();
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<Order[]>(`${this.apiUrl}${suffix}`, { withCredentials: true }).pipe(
      map((orders: Order[]) => (orders || []).map(o => ({
        ...o,
        items: Array.isArray(o?.items) ? o.items.filter(i => i != null) : []
      })))
    );
  }

  getAdminOrderById(orderId: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${orderId}`, { withCredentials: true }).pipe(
      map((o: Order) => ({ ...o, items: Array.isArray(o?.items) ? o.items.filter(i => i != null) : [] }))
    );
  }

  updateOrderStatus(orderId: string, estado: string): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/${orderId}/status`,
      { estado },
      { withCredentials: true }
    );
  }

  getStatusLabel(estado: string): string {
    const labels: Record<string, string> = {
      'PENDIENTE': 'Pendiente',
      'PAGADO': 'Pagado',
      'PROCESANDO': 'Procesando',
      'ENVIADO': 'Enviado',
      'CANCELADO': 'Cancelado',
      'ENTREGADO': 'Entregado'
    };
    return labels[estado] || estado;
  }

  getStatusColor(estado: string): string {
    const colors: Record<string, string> = {
      'PENDIENTE': '#f59e0b',
      'PAGADO': '#10b981',
      'PROCESANDO': '#0ea5e9',
      'ENVIADO': '#3b82f6',
      'CANCELADO': '#ef4444',
      'ENTREGADO': '#8b5cf6'
    };
    return colors[estado] || '#6b7280';
  }
}
