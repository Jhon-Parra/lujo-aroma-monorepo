import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { SettingsService, Settings } from './core/services/settings/settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'frontend';

  settings: Settings | null = null;
  whatsappUrl = '';

  constructor(private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.settings = s;
        this.whatsappUrl = this.buildWhatsappUrl(s?.whatsapp_number || '', s?.whatsapp_message || '');
      },
      error: () => {
        this.settings = null;
        this.whatsappUrl = '';
      }
    });
  }

  private buildWhatsappUrl(numberRaw: string, messageRaw: string): string {
    const number = (numberRaw || '').replace(/\D/g, '');
    if (!number) return '';
    const message = (messageRaw || '').trim();
    const base = `https://wa.me/${number}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
  }
}
