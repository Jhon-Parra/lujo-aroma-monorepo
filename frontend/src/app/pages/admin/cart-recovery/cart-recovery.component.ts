import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SettingsService, Settings } from '../../../core/services/settings/settings.service';
import { ToastService } from '../../../shared/components/toast/toast.service';

@Component({
  selector: 'app-cart-recovery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart-recovery.component.html',
  styleUrls: ['./cart-recovery.component.css']
})
export class CartRecoveryComponent implements OnInit {
  loading = true;
  saving = false;
  error = '';

  form = {
    enabled: false,
    message: '¡Espera! No te vayas todavía. Completa tu compra ahora y obtén un 10% de descuento exclusivo por tiempo limitado.',
    discountPct: 10,
    countdownSeconds: 120,
    buttonText: 'Finalizar compra'
  };

  constructor(
    private settingsService: SettingsService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.settingsService.refreshSettings().subscribe({
      next: (s) => {
        this.applySettings(s);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private applySettings(s: Settings): void {
    this.form.enabled = !!s.cart_recovery_enabled;
    this.form.message = String(s.cart_recovery_message || this.form.message);
    this.form.discountPct = Number(s.cart_recovery_discount_pct ?? this.form.discountPct) || this.form.discountPct;
    this.form.countdownSeconds = Number(s.cart_recovery_countdown_seconds ?? this.form.countdownSeconds) || this.form.countdownSeconds;
    this.form.buttonText = String(s.cart_recovery_button_text || this.form.buttonText);
  }

  save(): void {
    this.saving = true;
    this.error = '';

    const formData = new FormData();
    formData.append('cart_recovery_enabled', String(!!this.form.enabled));
    formData.append('cart_recovery_message', this.form.message || '');
    formData.append('cart_recovery_discount_pct', String(this.form.discountPct || 0));
    formData.append('cart_recovery_countdown_seconds', String(this.form.countdownSeconds || 0));
    formData.append('cart_recovery_button_text', this.form.buttonText || '');

    this.settingsService.updateSettings(formData).subscribe({
      next: () => {
        this.saving = false;
        this.toastService.success('Configuración guardada.');
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.error || 'No se pudo guardar la configuración.';
        this.toastService.error(this.error);
      }
    });
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
    return '/assets/images/logo.svg';
  }
}
