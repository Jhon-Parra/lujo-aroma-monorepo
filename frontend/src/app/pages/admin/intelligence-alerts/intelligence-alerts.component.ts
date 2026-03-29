import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { IntelligenceService, IntelligenceSummary } from '../../../core/services/intelligence/intelligence.service';
import { CategoryService, Category } from '../../../core/services/category/category.service';
import { ProductService, Product } from '../../../core/services/product/product.service';

Chart.register(...registerables);

@Component({
  selector: 'app-intelligence-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './intelligence-alerts.component.html',
  styleUrls: ['./intelligence-alerts.component.css']
})
export class IntelligenceAlertsComponent implements OnInit, OnDestroy {
  @ViewChild('topSearchChart') topSearchChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('abandonedTrendChart') abandonedTrendChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('clientsChart') clientsChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('salesPieChart') salesPieChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('salesBarChart') salesBarChartRef?: ElementRef<HTMLCanvasElement>;

  dateRange = '30';
  categoryFilter = 'all';
  productFilter = 'all';

  loading = false;
  error = '';
  summary: IntelligenceSummary | null = null;

  categories: Category[] = [];
  products: Product[] = [];

  private charts: Chart[] = [];

  constructor(
    private intelligenceService: IntelligenceService,
    private categoryService: CategoryService,
    private productService: ProductService
  ) { }

  ngOnInit(): void {
    this.categoryService.getAdminCategories().subscribe({
      next: (rows) => {
        this.categories = (rows || []).slice().sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
      },
      error: () => {
        this.categories = [];
      }
    });

    this.productService.getProducts().subscribe({
      next: (rows) => {
        this.products = (rows || []).slice().sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
      },
      error: () => {
        this.products = [];
      }
    });

    this.load();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    const days = Number(this.dateRange || 30);
    const category = this.categoryFilter !== 'all' ? this.categoryFilter : undefined;
    const productId = this.productFilter !== 'all' ? this.productFilter : undefined;

    this.intelligenceService.getSummary({ days, category, product_id: productId }).subscribe({
      next: (data) => {
        this.summary = data;
        this.loading = false;
        setTimeout(() => this.renderCharts(), 0);
      },
      error: (err) => {
        console.error('Error cargando inteligencia:', err);
        this.error = err?.error?.error || 'No se pudo cargar inteligencia y alertas.';
        this.loading = false;
      }
    });
  }

  get notificationCount(): number {
    return this.summary?.alerts?.length || 0;
  }

  getAbandonedTopProductsLabel(): string {
    const list = this.summary?.abandoned?.top_products || [];
    if (!list.length) return 'Sin datos';
    return list.map((p) => p.nombre).filter(Boolean).join(', ');
  }

  getCartItemsLabel(items: any[]): string {
    if (!Array.isArray(items)) return '';
    return items
      .map((it) => it?.name || it?.nombre || it?.product_name)
      .filter(Boolean)
      .join(', ');
  }

  getTrendWidth(value: number) {
    return `${Math.min(100, Math.max(8, value))}%`;
  }

  private destroyCharts(): void {
    for (const chart of this.charts) {
      try {
        chart.destroy();
      } catch {
        // ignore
      }
    }
    this.charts = [];
  }

  private renderCharts(): void {
    if (!this.summary) return;
    this.destroyCharts();

    const topSearch = this.topSearchChartRef?.nativeElement;
    if (topSearch && this.summary.top_searches?.length) {
      const labels = this.summary.top_searches.map((p) => p.nombre);
      const values = this.summary.top_searches.map((p) => p.searches);
      this.charts.push(new Chart(topSearch, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Busquedas',
            data: values,
            backgroundColor: '#c2a878',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#333' } },
            y: { ticks: { color: '#333' } }
          }
        }
      }));
    }

    const abandonedTrend = this.abandonedTrendChartRef?.nativeElement;
    if (abandonedTrend && this.summary.abandoned?.trend_counts?.length) {
      const labels = (this.summary.abandoned.trend_days || []).map((d) => new Date(d).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }));
      const values = this.summary.abandoned.trend_counts || [];
      this.charts.push(new Chart(abandonedTrend, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Carritos abandonados',
            data: values,
            borderColor: '#c379ac',
            backgroundColor: 'rgba(195,121,172,0.2)',
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#333' } },
            y: { ticks: { color: '#333' } }
          }
        }
      }));
    }

    const clientsChart = this.clientsChartRef?.nativeElement;
    if (clientsChart && this.summary.frequent_clients?.length) {
      const labels = this.summary.frequent_clients.map((c) => `${c.nombre} ${c.apellido}`.trim());
      const values = this.summary.frequent_clients.map((c) => c.orders_count);
      this.charts.push(new Chart(clientsChart, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Compras',
            data: values,
            backgroundColor: '#36404a',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#333' } },
            y: { ticks: { color: '#333' } }
          }
        }
      }));
    }

    const salesPie = this.salesPieChartRef?.nativeElement;
    const salesBar = this.salesBarChartRef?.nativeElement;
    if (salesPie && this.summary.sales_by_category?.length) {
      const labels = this.summary.sales_by_category.map((c) => c.category);
      const values = this.summary.sales_by_category.map((c) => c.revenue);
      this.charts.push(new Chart(salesPie, {
        type: 'pie',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: ['#c2a878', '#36404a', '#e9e2d0', '#c379ac']
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } }
        }
      }));
    }

    if (salesBar && this.summary.sales_by_category?.length) {
      const labels = this.summary.sales_by_category.map((c) => c.category);
      const values = this.summary.sales_by_category.map((c) => c.units);
      this.charts.push(new Chart(salesBar, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Unidades',
            data: values,
            backgroundColor: '#c2a878',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#333' } },
            y: { ticks: { color: '#333' } }
          }
        }
      }));
    }
  }

  getAdminLogoUrl(): string {
    const s = String(localStorage.getItem('lujo_aroma_settings_cache_v1') || '');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        const url = parsed.logo_url;
        if (url) {
          if (url.startsWith('http') || url.startsWith('data:')) return url;
          if (url.startsWith('assets/')) return '/' + url;
          return url;
        }
      } catch (e) {}
    }
    return '/assets/images/logo.png';
  }
}
