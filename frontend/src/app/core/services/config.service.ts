import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { updateApiConfig } from '../config/api-config';

export interface AppConfig {
  apiUrl: string;
  googleClientId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private config: AppConfig | null = null;
  private inflight?: Promise<void>;
  private readonly CACHE_KEY = 'lujo_aroma_app_config_v1';

  constructor(private http: HttpClient) {}

  async loadConfig(): Promise<void> {
    // Evitar multiples cargas en paralelo
    if (this.inflight) return this.inflight;

    // Importante: el apiUrl se usa para construir URLs en varios servicios.
    // Si resolvemos el APP_INITIALIZER usando un valor cacheado y luego lo
    // cambiamos en background, algunos servicios pueden quedar apuntando al
    // endpoint viejo durante toda la sesion.
    // Por eso: usar cache como fallback, pero SIEMPRE intentar cargar de red
    // (assets/config.json) antes de continuar el bootstrap.
    const cached = this.loadFromLocal();
    if (cached) {
      this.config = cached;
      updateApiConfig(cached.apiUrl, cached.googleClientId);
    }

    this.inflight = (async () => {
      await this.refreshFromNetwork();
    })().finally(() => {
      this.inflight = undefined;
    });

    return this.inflight;
  }

  private async refreshFromNetwork(): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.http.get<AppConfig>('/assets/config.json'));
      if (cfg) {
        this.config = cfg;
        updateApiConfig(cfg.apiUrl, cfg.googleClientId);
        this.saveToLocal(cfg);
      }
    } catch (error) {
      console.error('Could not load app config, falling back to cached/defaults', error);
      // Defaults already in api-config.ts
    }
  }

  private loadFromLocal(): AppConfig | null {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const apiUrl = String((parsed as any).apiUrl || '').trim();
      const googleClientId = String((parsed as any).googleClientId || '').trim();
      if (!apiUrl) return null;
      return { apiUrl, googleClientId };
    } catch {
      return null;
    }
  }

  private saveToLocal(cfg: AppConfig): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cfg));
    } catch {
      // ignore
    }
  }
// ...

  get apiUrl(): string {
    return this.config?.apiUrl || 'http://localhost:3000';
  }

  get googleClientId(): string {
    return this.config?.googleClientId || '';
  }
}
