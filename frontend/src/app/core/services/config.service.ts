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
  private readonly CACHE_KEY = 'perfumissimo_app_config_v1';

  constructor(private http: HttpClient) {}

  async loadConfig(): Promise<void> {
    // Evitar multiples cargas en paralelo
    if (this.inflight) return this.inflight;

    // 1) Usar cache si existe (no bloquea el primer render en cargas repetidas)
    const cached = this.loadFromLocal();
    if (cached) {
      this.config = cached;
      updateApiConfig(cached.apiUrl, cached.googleClientId);
      // Refrescar en background sin bloquear
      this.inflight = this.refreshFromNetwork().finally(() => {
        this.inflight = undefined;
      });
      return;
    }

    // 2) Primera carga: esperar config para no usar endpoints equivocados
    this.inflight = this.refreshFromNetwork().finally(() => {
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
      console.error('Could not load app config, falling back to defaults', error);
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
    return this.config?.apiUrl || 'https://api.perfumissimocol.com';
  }

  get googleClientId(): string {
    return this.config?.googleClientId || '';
  }
}
