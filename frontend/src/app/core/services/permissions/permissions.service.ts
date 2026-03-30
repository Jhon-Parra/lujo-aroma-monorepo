import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

import { API_CONFIG } from '../../config/api-config';

export type PermissionId =
  | 'admin.dashboard'
  | 'admin.products'
  | 'admin.orders'
  | 'admin.promotions'
  | 'admin.settings'
  | 'admin.users';

export type RoleId = 'SUPERADMIN' | 'ADMIN' | 'VENTAS' | 'PRODUCTOS' | 'CUSTOMER';

export type RolePermissionsMapping = Record<string, PermissionId[]>;

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private apiUrl = `${API_CONFIG.baseUrl}/permissions`;
  private readonly CACHE_KEY = 'lujo_aroma_permissions_me_v1';
  private inflight$?: Observable<PermissionId[]>;
  private inflightAt = 0;
  private readonly CACHE_MS = 30_000;

  constructor(private http: HttpClient) {}

  getMePermissions(): Observable<PermissionId[]> {
    const now = Date.now();
    if (this.inflight$ && now - this.inflightAt < this.CACHE_MS) return this.inflight$;

    const cached = this.loadCachedMe();
    if (cached && now - cached.at < this.CACHE_MS) {
      return of(cached.permissions);
    }

    this.inflightAt = now;
    this.inflight$ = this.http
      .get<{ role: string; permissions: PermissionId[] }>(`${this.apiUrl}/me`, { withCredentials: true })
      .pipe(
        map((r) => (Array.isArray(r?.permissions) ? r.permissions : [])),
        tap((perms) => this.saveCachedMe(perms)),
        catchError(() => of([] as PermissionId[])),
        shareReplay(1)
      );

    return this.inflight$;
  }

  has(permission: PermissionId): Observable<boolean> {
    return this.getMePermissions().pipe(map((perms) => perms.includes(permission)));
  }

  getAll(): Observable<{ roles: RoleId[]; permissions: PermissionId[]; mapping: RolePermissionsMapping }> {
    return this.http.get<{ roles: RoleId[]; permissions: PermissionId[]; mapping: RolePermissionsMapping }>(this.apiUrl, {
      withCredentials: true
    });
  }

  saveAll(mapping: RolePermissionsMapping): Observable<any> {
    return this.http.put(this.apiUrl, { mapping }, { withCredentials: true });
  }

  clearMeCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch {
      // ignore
    }
    this.inflight$ = undefined;
    this.inflightAt = 0;
  }

  private loadCachedMe(): { at: number; permissions: PermissionId[] } | null {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const at = Number(parsed.at || 0);
      const permissions = Array.isArray(parsed.permissions) ? (parsed.permissions as PermissionId[]) : [];
      return { at: Number.isFinite(at) ? at : 0, permissions };
    } catch {
      return null;
    }
  }

  private saveCachedMe(permissions: PermissionId[]): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({ at: Date.now(), permissions }));
    } catch {
      // ignore
    }
  }
}
