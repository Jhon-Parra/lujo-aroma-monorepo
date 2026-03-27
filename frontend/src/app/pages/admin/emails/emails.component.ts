import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService, DashboardSummary } from '../../../core/services/dashboard/dashboard.service';
import { EmailTemplatesService, OrderEmailLog, OrderEmailTemplate } from '../../../core/services/email-templates/email-templates.service';
import { LowStockBellComponent } from '../../../shared/components/low-stock-bell/low-stock-bell.component';

@Component({
  selector: 'app-emails',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LowStockBellComponent],
  templateUrl: './emails.component.html'
})
export class EmailsComponent implements OnInit {
  userRole = '';

  summaryLoading = false;
  summaryError = '';
  summary: DashboardSummary = {
    total_revenue: 0,
    pending_orders: 0,
    products_count: 0,
    users_count: 0,
    monthly_sales: [],
    top_products: []
  };

  emailStatuses = [
    { key: 'PAGADO', label: 'Pagado' },
    { key: 'ENVIADO', label: 'Enviado' },
    { key: 'ENTREGADO', label: 'Entregado' },
    { key: 'CANCELADO', label: 'Cancelado' }
  ];

  emailTemplates: Record<string, OrderEmailTemplate> = {};
  selectedEmailStatus = 'PAGADO';
  templateDraft: OrderEmailTemplate | null = null;
  templatesLoading = false;
  templatesSaving = false;
  templatesError = '';

  emailLogs: OrderEmailLog[] = [];
  logsLoading = false;
  logsError = '';

  constructor(
    private authService: AuthService,
    private dashboardService: DashboardService,
    private emailTemplatesService: EmailTemplatesService
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.loadSummary();
    this.loadEmailTemplates();
    this.loadEmailLogs();
  }

  loadSummary(): void {
    this.summaryLoading = true;
    this.summaryError = '';
    this.dashboardService.getSummary({ months_back: 1 }).subscribe({
      next: (data) => {
        this.summary = data;
        this.summaryLoading = false;
      },
      error: (err) => {
        console.error('Error cargando resumen:', err);
        this.summaryError = err?.error?.error || 'No se pudieron cargar los estados de pedidos.';
        this.summaryLoading = false;
      }
    });
  }

  loadEmailTemplates(): void {
    this.templatesLoading = true;
    this.templatesError = '';
    this.emailTemplatesService.getOrderTemplates().subscribe({
      next: (res) => {
        const templates = res?.templates || [];
        const map: Record<string, OrderEmailTemplate> = {};
        templates.forEach((t) => {
          if (!t || !t.status) return;
          map[String(t.status).toUpperCase()] = t;
        });
        this.emailTemplates = map;
        this.selectEmailStatus(this.selectedEmailStatus);
        this.templatesLoading = false;
      },
      error: (err) => {
        console.error('Error cargando plantillas de correo:', err);
        this.templatesError = err?.error?.error || 'No se pudieron cargar las plantillas de correo.';
        this.templatesLoading = false;
      }
    });
  }

  selectEmailStatus(status: string): void {
    const key = String(status || '').toUpperCase();
    this.selectedEmailStatus = key;
    const template = this.emailTemplates[key];
    if (!template) {
      this.templateDraft = null;
      return;
    }

    // Para no llenar la UI con un HTML enorme por defecto,
    // dejamos el HTML vacio a menos que exista una plantilla personalizada.
    const isDefault = template.source === 'default' || !template.source;
    this.templateDraft = {
      ...template,
      body_html: isDefault ? '' : (template.body_html || '')
    };
  }

  saveEmailTemplate(): void {
    if (!this.templateDraft) return;
    this.templatesSaving = true;
    this.templatesError = '';

    const payload = {
      subject: this.templateDraft.subject || '',
      body_text: this.templateDraft.body_text || '',
      body_html: (this.templateDraft.body_html || '').trim()
    };

    this.emailTemplatesService.updateOrderTemplate(this.selectedEmailStatus, payload).subscribe({
      next: (tpl) => {
        this.emailTemplates[this.selectedEmailStatus] = tpl;
        this.templateDraft = { ...tpl };
        this.templatesSaving = false;
        alert('Plantilla de correo guardada.');
      },
      error: (err) => {
        console.error('Error guardando plantilla:', err);
        this.templatesError = err?.error?.error || 'No se pudo guardar la plantilla.';
        this.templatesSaving = false;
      }
    });
  }

  loadEmailLogs(): void {
    this.logsLoading = true;
    this.logsError = '';
    this.emailTemplatesService.getOrderEmailLogs(50).subscribe({
      next: (res) => {
        this.emailLogs = res?.logs || [];
        this.logsLoading = false;
      },
      error: (err) => {
        console.error('Error cargando logs de correo:', err);
        this.logsError = err?.error?.error || 'No se pudieron cargar los logs de correo.';
        this.logsLoading = false;
      }
    });
  }

  logout() {
    this.authService.logout();
  }
}
