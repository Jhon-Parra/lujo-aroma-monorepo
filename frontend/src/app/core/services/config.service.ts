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

  constructor(private http: HttpClient) {}

  async loadConfig(): Promise<void> {
    try {
      this.config = await firstValueFrom(this.http.get<AppConfig>('/assets/config.json'));
      if (this.config) {
        updateApiConfig(this.config.apiUrl, this.config.googleClientId);
      }
    } catch (error) {
      console.error('Could not load app config, falling back to defaults', error);
      // Defaults already in api-config.ts
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
