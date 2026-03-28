import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, BehaviorSubject, catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { CartService } from './cart/cart.service';
import { FavoritesService } from './favorites/favorites.service';

export interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  foto_perfil: string | null;
  rol: string;
}

import { API_CONFIG } from '../config/api-config';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${API_CONFIG.baseUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private cartService: CartService,
    private favoritesService: FavoritesService
  ) {
    this.checkStoredAuth();
  }

  private checkStoredAuth(): void {
    this.refreshUser().subscribe({
      next: (response) => {
        if (response?.user) {
          this.currentUserSubject.next(response.user);
          this.favoritesService.refreshFavorites();
        } else {
          this.currentUserSubject.next(null);
          this.cartService.clearCartStorage();
          this.favoritesService.clearFavorites();
        }
      },
      error: () => {
        this.currentUserSubject.next(null);
        this.cartService.clearCartStorage();
        this.favoritesService.clearFavorites();
      }
    });
  }

  login(email: string, paramPassword: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password: paramPassword }, { withCredentials: true })
      .pipe(
        tap(response => {
          if (response.user) {
            this.currentUserSubject.next(response.user);
            this.favoritesService.refreshFavorites();
          }
        })
      );
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, userData, { withCredentials: true }).pipe(
      tap(response => {
        if (response.user) {
          this.currentUserSubject.next(response.user);
          try { localStorage.removeItem('lujo_aroma_permissions_me_v1'); } catch {}
          this.favoritesService.refreshFavorites();
        }
      })
    );
  }

  loginWithGoogle(credential: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/google`, { credential }, { withCredentials: true }).pipe(
      tap(response => {
        if (response.user) {
          this.currentUserSubject.next(response.user);
          try { localStorage.removeItem('lujo_aroma_permissions_me_v1'); } catch {}
          this.favoritesService.refreshFavorites();
        }
      })
    );
  }

  logout(): void {
    this.http.post<any>(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe({
      complete: () => {
        this.currentUserSubject.next(null);
        this.cartService.clearCartStorage();
        this.favoritesService.clearFavorites();
        try { localStorage.removeItem('lujo_aroma_permissions_me_v1'); } catch {}
        this.router.navigate(['/login']);
      }
    });
  }

  refreshUser(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((response) => {
          if (response?.user) {
            this.currentUserSubject.next(response.user);
            try { localStorage.removeItem('lujo_aroma_permissions_me_v1'); } catch {}
          } else {
            this.currentUserSubject.next(null);
            try { localStorage.removeItem('lujo_aroma_permissions_me_v1'); } catch {}
          }
        }),
        catchError(() => {
          this.currentUserSubject.next(null);
          try { localStorage.removeItem('lujo_aroma_permissions_me_v1'); } catch {}
          return of({ user: null });
        })
      );
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getUserRole(): string {
    return this.currentUserSubject.value?.rol || 'GUEST';
  }

  getUserId(): string | null {
    return this.currentUserSubject.value?.id || null;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getUserName(): string {
    const user = this.currentUserSubject.value;
    return user?.nombre || '';
  }

  getUserFullName(): string {
    const user = this.currentUserSubject.value;
    if (!user) return '';
    return `${user.nombre || ''} ${user.apellido || ''}`.trim();
  }

  getUserPhoto(): string | null {
    const user = this.currentUserSubject.value;
    return user?.foto_perfil || null;
  }

  getUserInitials(): string {
    const user = this.currentUserSubject.value;
    if (!user) return '';
    const nombre = user.nombre || '';
    const apellido = user.apellido || '';
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  }

  getUserEmail(): string {
    return this.currentUserSubject.value?.email || '';
  }
}
