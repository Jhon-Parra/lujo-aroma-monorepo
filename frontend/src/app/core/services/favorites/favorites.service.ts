import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Product } from '../../../shared/components/product-card/product-card.component';

import { API_CONFIG } from '../../config/api-config';

@Injectable({
    providedIn: 'root'
})
export class FavoritesService {
    private apiUrl = `${API_CONFIG.baseUrl}/favorites`;
    private favoritesSubject = new BehaviorSubject<Product[]>([]);
    public favorites$: Observable<Product[]> = this.favoritesSubject.asObservable();

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
        this.loadFavoritesFromAPI();
    }

    get favorites(): Product[] {
        return this.favoritesSubject.value;
    }

    private loadFavoritesFromAPI(): void {
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
        const currentFavorites = [...this.favorites];
        const index = currentFavorites.findIndex(p => p.id === product.id);

        if (index !== -1) {
            this.removeFromAPI(product.id);
            currentFavorites.splice(index, 1);
        } else {
            this.addToAPI(product.id);
            currentFavorites.push(product);
        }

        this.updateFavorites(currentFavorites);
    }

    private addToAPI(productId: string): void {
        this.http.post(this.apiUrl, { producto_id: productId }, { withCredentials: true }).subscribe({
            error: (err) => console.error('Error adding favorite:', err)
        });
    }

    private removeFromAPI(productId: string): void {
        this.http.delete(`${this.apiUrl}/${productId}`, { withCredentials: true }).subscribe({
            error: (err) => console.error('Error removing favorite:', err)
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
