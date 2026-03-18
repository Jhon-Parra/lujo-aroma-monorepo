import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_CONFIG } from '../../config/api-config';

// ─── DTOs ─────────────────────────────────────────────────────────────────────
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
  /** Teléfono del cliente — obligatorio */
  phone: string;
  nombre_cliente?: string;
  metodo_pago?: string;
  canal_pago?: string;

  cart_recovery_applied?: boolean;
  cart_recovery_discount_pct?: number;
  envio_prioritario?: boolean;
  perfume_lujo?: boolean;
}

// ─── Interfaces de respuesta ──────────────────────────────────────────────────
export interface OrderItem {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  imagen_url?: string;
}

export interface EnvioInfo {
  transportadora: string;
  numero_guia: string;
  fecha_envio: string;
  link_rastreo?: string;
  observacion?: string;
}

export interface HistorialEntry {
  estado_anterior: string | null;
  estado_nuevo: string;
  cambio_en: string;
  observacion?: string;
  admin_nombre?: string;
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

  // Campos nuevos
  telefono?: string;
  nombre_cliente?: string;
  metodo_pago?: string;
  canal_pago?: string;
  estado_pago?: string;
  referencia_pago?: string;

  // Envío (JOIN con tabla envios)
  transportadora?: string;
  numero_guia?: string;
  fecha_envio?: string;
  link_rastreo?: string;

  // Historial de estados
  historial?: HistorialEntry[];

  // Admin fields
  cliente_nombre?: string;
  cliente_email?: string;
  cliente_telefono?: string;
  orden_telefono?: string;
  total_items?: number;
}

export interface RegisterShippingDto {
  transportadora: string;
  numero_guia: string;
  link_rastreo?: string;
  observacion?: string;
  fecha_envio?: string;
}

// ─── Función normalizadora de órdenes ─────────────────────────────────────────
const normalizeOrder = (o: Order): Order => ({
  ...o,
  items: Array.isArray(o.items) ? o.items.filter(i => i != null) : [],
  historial: Array.isArray(o.historial) ? o.historial : []
});

@Injectable({ providedIn: 'root' })
export class OrderService {
  private apiUrl = `${API_CONFIG.baseUrl}/orders`;

  constructor(private http: HttpClient) {}

  // ── Crear pedido ────────────────────────────────────────────────────────────
  createOrder(orderData: CreateOrderDto): Observable<{ message: string; orderId: string }> {
    return this.http.post<{ message: string; orderId: string }>(
      this.apiUrl,
      orderData,
      { withCredentials: true }
    );
  }

  // ── Pedidos del usuario ─────────────────────────────────────────────────────
  getMyOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/my-orders`, { withCredentials: true }).pipe(
      map((orders) => (orders || []).map(normalizeOrder))
    );
  }

  getMyOrderById(orderId: string): Observable<Order> {
    return this.http.get<Order>(
      `${this.apiUrl}/my-orders/${encodeURIComponent(orderId)}`,
      { withCredentials: true }
    ).pipe(map(normalizeOrder));
  }

  // ── Admin: todos los pedidos ────────────────────────────────────────────────
  getAllOrders(filters?: {
    status?: string;
    q?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }): Observable<Order[]> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.fechaDesde) params = params.set('fechaDesde', filters.fechaDesde);
    if (filters?.fechaHasta) params = params.set('fechaHasta', filters.fechaHasta);

    return this.http.get<Order[]>(this.apiUrl, { params, withCredentials: true }).pipe(
      map((orders: Order[]) => (orders || []).map(normalizeOrder))
    );
  }

  getAdminOrderById(orderId: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${orderId}`, { withCredentials: true }).pipe(
      map(normalizeOrder)
    );
  }

  // ── Cambiar estado ──────────────────────────────────────────────────────────
  updateOrderStatus(orderId: string, estado: string, observacion?: string): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/${orderId}/status`,
      { estado, observacion },
      { withCredentials: true }
    );
  }

  // ── Registrar envío (guía) ──────────────────────────────────────────────────
  registerShipping(orderId: string, data: RegisterShippingDto): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${orderId}/shipping`,
      data,
      { withCredentials: true }
    );
  }

  // ── Descargar PDF ───────────────────────────────────────────────────────────
  downloadPdf(orderId: string): void {
    const url = `${this.apiUrl}/${orderId}/pdf`;
    // Abrir en nueva pestaña para descarga directa
    window.open(url, '_blank');
  }

  // ── Utilidades de etiquetas/colores ────────────────────────────────────────
  getStatusLabel(estado: string): string {
    const labels: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      PAGADO: 'Pagado',
      PROCESANDO: 'Procesando',
      ENVIADO: 'Enviado',
      CANCELADO: 'Cancelado',
      ENTREGADO: 'Entregado'
    };
    return labels[estado] || estado;
  }

  getStatusColor(estado: string): string {
    const colors: Record<string, string> = {
      PENDIENTE: '#f59e0b',
      PAGADO: '#10b981',
      PROCESANDO: '#0ea5e9',
      ENVIADO: '#3b82f6',
      CANCELADO: '#ef4444',
      ENTREGADO: '#8b5cf6'
    };
    return colors[estado] || '#6b7280';
  }

  /** Retorna true si la transición de estado es válida en el cliente */
  static isValidTransition(actual: string, nuevo: string): boolean {
    const transitions: Record<string, string[]> = {
      PENDIENTE: ['PAGADO', 'PROCESANDO', 'CANCELADO'],
      PAGADO: ['PROCESANDO', 'CANCELADO'],
      PROCESANDO: ['ENVIADO', 'CANCELADO'],
      ENVIADO: ['ENTREGADO'],
      ENTREGADO: [],
      CANCELADO: []
    };
    return (transitions[actual] || []).includes(nuevo);
  }
}
