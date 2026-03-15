import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { OrderService, Order } from '../../../core/services/order/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { LowStockBellComponent } from '../../../shared/components/low-stock-bell/low-stock-bell.component';

type OrderStatus = 'PENDIENTE' | 'PAGADO' | 'PROCESANDO' | 'ENVIADO' | 'ENTREGADO' | 'CANCELADO';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LowStockBellComponent],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css']
})
export class OrdersComponent implements OnInit {
  loading = true;
  error = '';

  statusFilter: '' | OrderStatus = '';
  query = '';

  orders: Order[] = [];

  detailOpen = false;
  detailLoading = false;
  detailError = '';
  selectedOrder: Order | null = null;

  savingStatusForId = new Set<string>();

  statuses: { value: '' | OrderStatus; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'PENDIENTE', label: 'Pendiente' },
    { value: 'PAGADO', label: 'Pagado' },
    { value: 'PROCESANDO', label: 'Procesando' },
    { value: 'ENVIADO', label: 'Enviado' },
    { value: 'ENTREGADO', label: 'Entregado' },
    { value: 'CANCELADO', label: 'Cancelado' }
  ];

  constructor(
    public orderService: OrderService,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const status = (params['status'] || '').toString().trim().toUpperCase();
      const q = (params['q'] || '').toString();

      const allowed = new Set(['', 'PENDIENTE', 'PAGADO', 'PROCESANDO', 'ENVIADO', 'ENTREGADO', 'CANCELADO']);
      this.statusFilter = (allowed.has(status) ? status : '') as any;
      this.query = q;
      this.load();
    });
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.orderService.getAllOrders({ status: this.statusFilter, q: this.query }).subscribe({
      next: (data) => {
        this.orders = data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando ordenes', err);
        this.error = 'No se pudieron cargar los pedidos.';
        this.loading = false;
      }
    });
  }

  openDetail(orderId: string): void {
    this.detailOpen = true;
    this.detailLoading = true;
    this.detailError = '';
    this.selectedOrder = null;

    this.orderService.getAdminOrderById(orderId).subscribe({
      next: (order) => {
        this.selectedOrder = order;
        this.detailLoading = false;
      },
      error: (err) => {
        console.error('Error cargando detalle', err);
        this.detailError = err?.error?.message || 'No se pudo cargar el detalle del pedido.';
        this.detailLoading = false;
      }
    });
  }

  closeDetail(): void {
    this.detailOpen = false;
    this.detailLoading = false;
    this.detailError = '';
    this.selectedOrder = null;
  }

  updateStatus(order: Order, estado: OrderStatus): void {
    if (!order?.id) return;

    this.savingStatusForId.add(order.id);
    this.orderService.updateOrderStatus(order.id, estado).subscribe({
      next: () => {
        // Actualizar en UI
        order.estado = estado as any;
        if (this.selectedOrder?.id === order.id) {
          this.selectedOrder.estado = estado as any;
        }
        this.savingStatusForId.delete(order.id);
      },
      error: (err) => {
        console.error('Error actualizando estado', err);
        alert(err?.error?.message || 'No se pudo actualizar el estado.');
        this.savingStatusForId.delete(order.id);
        this.load();
      }
    });
  }

  isSaving(orderId: string): boolean {
    return this.savingStatusForId.has(orderId);
  }

  getStatusClass(estado: string): string {
    const classes: Record<string, string> = {
      'PENDIENTE': 'bg-yellow-100 text-yellow-800',
      'PAGADO': 'bg-green-100 text-green-800',
      'PROCESANDO': 'bg-sky-100 text-sky-800',
      'ENVIADO': 'bg-blue-100 text-blue-800',
      'CANCELADO': 'bg-red-100 text-red-800',
      'ENTREGADO': 'bg-purple-100 text-purple-800'
    };
    return classes[estado] || 'bg-gray-100 text-gray-700';
  }

  logout(): void {
    this.authService.logout();
  }

  exportCsv(): void {
    const rows = (this.orders || []).map((o) => ({
      id: String(o.id || ''),
      creado_en: String((o as any).creado_en || ''),
      estado: String(o.estado || ''),
      cliente_nombre: String((o as any).cliente_nombre || ''),
      cliente_email: String((o as any).cliente_email || ''),
      total: Number((o as any).total || 0),
      total_items: Number((o as any).total_items || 0)
    }));

    const header = ['id', 'creado_en', 'estado', 'cliente_nombre', 'cliente_email', 'total', 'total_items'];
    const csv = [header.join(',')]
      .concat(rows.map((r) => header.map((k) => this.csvCell((r as any)[k])).join(',')))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos_${this.statusFilter || 'TODOS'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private csvCell(value: any): string {
    const s = String(value ?? '');
    const escaped = s.replace(/"/g, '""');
    return `"${escaped}"`;
  }
}
