import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from '../../../shared/components/product-card/product-card.component';

import { API_CONFIG } from '../../config/api-config';

@Injectable({
    providedIn: 'root'
})
export class FavoritesService {
    private apiUrl = `${API_CONFIG.baseUrl}/favorites`;
    private refreshUrl = `${API_CONFIG.baseUrl}/auth/refresh`;
    private favoritesSubject = new BehaviorSubject<Product[]>([]);
    public favorites$: Observable<Product[]> = this.favoritesSubject.asObservable();

    public isUserAuthenticated = false;

    constructor(private http: HttpClient) {
        // Importante: no llamamos al API en el constructor.
        // Antes de saber si hay sesion valida, esto genera 401/403 en consola.
        // AuthService se encarga de llamar refreshFavorites() cuando hay usuario.
    }

    clearFavorites(): void {
        this.favoritesSubject.next([]);
        try {
            localStorage.removeItem('lujo_aroma_favorites');
        } catch {
            // ignore
        }
    }

    refreshFavorites(): void {
        if (!this.isUserAuthenticated) return;
        this.loadFavoritesFromAPI();
    }

    get favorites(): Product[] {
        return this.favoritesSubject.value;
    }

    private loadFavoritesFromAPI(): void {
        if (!this.isUserAuthenticated) return;

        this.http.get<Product[]>(this.apiUrl, { withCredentials: true }).subscribe({
            next: (favs) => {
                const products: Product[] = favs.map(f => ({
                    id: f.id,
                    name: f.nombre || '',
                    notes: f.descripcion || '',
                    price: typeof f.precio === 'string' ? parseFloat(f.precio) : (f.precio || 0),
                    stock: (() => {
                        const n = Number((f as any)?.stock);
                        return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : undefined;
                    })(),
                    imageUrl: f.imagen_url || '',
                    soldCount: (f.unidades_vendidas || 0).toString(),
                    isNew: !!(f as any).es_nuevo,
                    genero: f.genero || ''
                }));
                this.favoritesSubject.next(products);
                this.saveToLocal(products);
            },
            error: (err) => {
                // Si no hay sesión, no debemos mostrar favoritos del localStorage.
                if (err?.status === 401 || err?.status === 403) {
                    this.clearFavorites();
                    return;
                }
                // Si el backend no responde, podemos usar el local como fallback.
                this.loadFromLocal();
            }
        });
    }

    toggleFavorite(product: Product): void {
        if (!this.isUserAuthenticated) {
            import('sweetalert2').then(Swal => {
                Swal.default.fire({
                    icon: 'info',
                    title: 'Inicia sesión',
                    text: 'Debes iniciar sesión para guardar tus extractos y perfumes favoritos.',
                    confirmButtonColor: '#d4af37'
                });
            });
            return;
        }

        const previousFavorites = [...this.favorites];
        const nextFavorites = [...previousFavorites];
        const index = nextFavorites.findIndex(p => p.id === product.id);

        if (index !== -1) {
            nextFavorites.splice(index, 1);
            this.updateFavorites(nextFavorites);
            this.removeFromAPI(product.id, previousFavorites);
        } else {
            nextFavorites.push(product);
            this.updateFavorites(nextFavorites);
            this.addToAPI(product.id, previousFavorites);
        }
    }

    private addToAPI(productId: string, previousFavorites: Product[], hasRetried = false): void {
        if (!this.isUserAuthenticated) return;
        this.http.post(this.apiUrl, { producto_id: productId }, { withCredentials: true }).subscribe({
            error: (err) => this.handleSyncError(err, previousFavorites, () => {
                this.addToAPI(productId, previousFavorites, true);
            }, hasRetried)
        });
    }

    private removeFromAPI(productId: string, previousFavorites: Product[], hasRetried = false): void {
        if (!this.isUserAuthenticated) return;
        this.http.delete(`${this.apiUrl}/${productId}`, { withCredentials: true }).subscribe({
            error: (err) => this.handleSyncError(err, previousFavorites, () => {
                this.removeFromAPI(productId, previousFavorites, true);
            }, hasRetried)
        });
    }

    private handleSyncError(
        err: any,
        previousFavorites: Product[],
        retryRequest: () => void,
        hasRetried: boolean
    ): void {
        if ((err?.status === 401 || err?.status === 403) && !hasRetried) {
            this.tryRefreshSession(retryRequest);
            return;
        }

        if (err?.status === 401 || err?.status === 403) {
            this.clearFavorites();
            return;
        }

        this.updateFavorites(previousFavorites);
        console.error('Error syncing favorites:', err);
    }

    private tryRefreshSession(retryRequest: () => void): void {
        this.http.post<any>(this.refreshUrl, {}, { withCredentials: true }).subscribe({
            next: (response) => {
                if (response?.user) {
                    this.isUserAuthenticated = true;
                    retryRequest();
                    return;
                }

                this.isUserAuthenticated = false;
                this.clearFavorites();
            },
            error: () => {
                this.isUserAuthenticated = false;
                this.clearFavorites();
            }
        });
    }

    isFavorite(productId: string): boolean {
        return this.favorites.some(p => p.id === productId);
    }

    private updateFavorites(favorites: Product[]): void {
        this.favoritesSubject.next(favorites);
        this.saveToLocal(favorites);
    }

    private saveToLocal(favorites: Product[]): void {
        localStorage.setItem('lujo_aroma_favorites', JSON.stringify(favorites));
    }

    private loadFromLocal(): void {
        const stored = localStorage.getItem('lujo_aroma_favorites');
        if (stored) {
            try {
                this.favoritesSubject.next(JSON.parse(stored));
            } catch (e) {
                this.favoritesSubject.next([]);
            }
        }
    }
}
