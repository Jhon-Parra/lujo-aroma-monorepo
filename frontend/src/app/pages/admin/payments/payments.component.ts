import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../core/services/auth.service';
import { SettingsService, Settings } from '../../../core/services/settings/settings.service';
import { LowStockBellComponent } from '../../../shared/components/low-stock-bell/low-stock-bell.component';
import { WompiDiagnostics, WompiService } from '../../../core/services/payment/wompi.service';
import { API_CONFIG } from '../../../core/config/api-config';

@Component({
  selector: 'app-payments-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LowStockBellComponent],
  templateUrl: './payments.component.html'
})
export class PaymentsAdminComponent implements OnInit {
  saving = false;
  wompiHasPrivateKey = false;
  wompiPrivateKeyInput = '';
  wompiClearPrivateKey = false;
  settings: Partial<Settings> = {
    seller_bank_name: '',
    seller_bank_account_type: '',
    seller_bank_account_number: '',
    seller_bank_account_holder: '',
    seller_bank_account_id: '',
    seller_nequi_number: '',
    seller_payment_notes: '',

    wompi_env: 'sandbox',
    wompi_public_key: ''
  };

  wompiWebhookUrl = `${API_CONFIG.baseUrl}/payments/wompi/webhook`;
  wompiDiagLoading = false;
  wompiDiagError = '';
  wompiDiag: WompiDiagnostics | null = null;

  constructor(
    private authService: AuthService,
    private settingsService: SettingsService,
    private wompiService: WompiService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.settings = {
          ...this.settings,
          seller_bank_name: (s as any).seller_bank_name || '',
          seller_bank_account_type: (s as any).seller_bank_account_type || '',
          seller_bank_account_number: (s as any).seller_bank_account_number || '',
          seller_bank_account_holder: (s as any).seller_bank_account_holder || '',
          seller_bank_account_id: (s as any).seller_bank_account_id || '',
          seller_nequi_number: (s as any).seller_nequi_number || '',
          seller_payment_notes: (s as any).seller_payment_notes || '',

          wompi_env: (s as any).wompi_env || 'sandbox'
        };

        // Wompi public key se obtiene desde /payments/wompi/config (no viene por /settings)
        this.wompiService.getConfig().subscribe({
          next: (cfg) => {
            this.settings.wompi_env = (cfg as any).env || (this.settings.wompi_env as any) || 'sandbox';
            this.settings.wompi_public_key = (cfg as any).public_key || '';
            this.wompiHasPrivateKey = !!(cfg as any).has_private_key;
            this.wompiPrivateKeyInput = '';
            this.wompiClearPrivateKey = false;
          },
          error: () => {
            this.settings.wompi_public_key = '';
            this.wompiHasPrivateKey = false;
          }
        });
      },
      error: (err) => console.error('Error cargando ajustes de pagos', err)
    });
  }

  copy(text: string): void {
    const v = String(text || '').trim();
    if (!v) return;
    try {
      navigator.clipboard?.writeText(v);
    } catch {
      // ignore
    }
  }

  runWompiDiagnostics(): void {
    if (this.wompiDiagLoading) return;
    this.wompiDiagLoading = true;
    this.wompiDiagError = '';
    this.wompiDiag = null;
    this.wompiService.getDiagnostics().subscribe({
      next: (d) => {
        this.wompiDiagLoading = false;
        this.wompiDiag = d;
      },
      error: (err) => {
        this.wompiDiagLoading = false;
        this.wompiDiagError = err?.error?.error || err?.error?.message || 'No se pudo correr el diagnostico de Wompi.';
      }
    });
  }

  save(): void {
    this.saving = true;

    const formData = new FormData();
    formData.append('seller_bank_name', String(this.settings.seller_bank_name || ''));
    formData.append('seller_bank_account_type', String(this.settings.seller_bank_account_type || ''));
    formData.append('seller_bank_account_number', String(this.settings.seller_bank_account_number || ''));
    formData.append('seller_bank_account_holder', String(this.settings.seller_bank_account_holder || ''));
    formData.append('seller_bank_account_id', String(this.settings.seller_bank_account_id || ''));
    formData.append('seller_nequi_number', String(this.settings.seller_nequi_number || ''));
    formData.append('seller_payment_notes', String(this.settings.seller_payment_notes || ''));

    formData.append('wompi_env', String(this.settings.wompi_env || 'sandbox'));
    formData.append('wompi_public_key', String(this.settings.wompi_public_key || ''));

    if (this.wompiClearPrivateKey) {
      formData.append('wompi_private_key', '');
    } else if (this.wompiPrivateKeyInput.trim()) {
      formData.append('wompi_private_key', this.wompiPrivateKeyInput.trim());
    }

    this.settingsService.updateSettings(formData).subscribe({
      next: () => {
        this.saving = false;
        alert('Datos de pago guardados');
        this.load();
      },
      error: (err) => {
        this.saving = false;
        console.error('Error guardando pagos:', err);
        const msg = err?.error?.error || err?.error?.message || 'Hubo un error al guardar';
        alert(msg);
      }
    });
  }

  logout(): void {
    this.authService.logout();
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
