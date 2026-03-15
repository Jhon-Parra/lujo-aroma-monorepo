import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService, DashboardSummary } from '../../../core/services/dashboard/dashboard.service';
import { LowStockBellComponent } from '../../../shared/components/low-stock-bell/low-stock-bell.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LowStockBellComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  userRole = '';

  loading = true;
  error = '';

  summary: DashboardSummary = {
    total_revenue: 0,
    pending_orders: 0,
    products_count: 0,
    users_count: 0,
    monthly_sales: [],
    top_products: []
  };

  maxMonthlyRevenue = 0;

  monthsBack = 12;

  constructor(
    private authService: AuthService,
    private dashboardService: DashboardService
  ) { }

  ngOnInit() {
    this.userRole = this.authService.getUserRole();

    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = '';
    this.dashboardService.getSummary({ months_back: this.monthsBack }).subscribe({
      next: (data) => {
        this.summary = data;
        this.monthsBack = Number(data?.months_back || this.monthsBack || 12);
        const revenues = (data?.monthly_sales || []).map((m) => Number((m as any)?.revenue || 0)).filter((n) => Number.isFinite(n));
        this.maxMonthlyRevenue = revenues.length ? Math.max(...revenues, 0) : 0;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando dashboard:', err);
        this.error = err?.error?.error || 'No se pudieron cargar las métricas.';
        this.loading = false;
      }
    });
  }

  getMonthBarWidth(revenue: number): string {
    const max = this.maxMonthlyRevenue || 0;
    if (!max) return '0%';
    const pct = Math.max(0, Math.min(100, (Number(revenue || 0) / max) * 100));
    return `${pct.toFixed(1)}%`;
  }

  logout() {
    this.authService.logout();
  }

  exportMonthlySalesCsv(): void {
    const rows = (this.summary?.monthly_sales || []).map((m) => ({
      month_start: String((m as any).month_start || ''),
      revenue: Number((m as any).revenue || 0),
      orders_count: Number((m as any).orders_count || 0)
    }));

    const header = ['month_start', 'revenue', 'orders_count'];
    const csv = [header.join(',')]
      .concat(rows.map((r) => header.map((k) => this.csvCell((r as any)[k])).join(',')))
      .join('\n');

    this.downloadCsv(csv, `ventas_mensuales_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  exportTopProductsCsv(): void {
    const rows = (this.summary?.top_products || []).map((p) => ({
      id: String((p as any).id || ''),
      nombre: String((p as any).nombre || ''),
      unidades: Number((p as any).unidades || 0),
      ingresos: Number((p as any).ingresos || 0)
    }));

    const header = ['id', 'nombre', 'unidades', 'ingresos'];
    const csv = [header.join(',')]
      .concat(rows.map((r) => header.map((k) => this.csvCell((r as any)[k])).join(',')))
      .join('\n');

    this.downloadCsv(csv, `top_productos_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  private downloadCsv(csv: string, filename: string): void {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
