import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrderService, Order } from '../../../core/services/order/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { ReviewService, MyReview } from '../../../core/services/review/review.service';

@Component({
    selector: 'app-my-orders',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './my-orders.component.html'
})
export class MyOrdersComponent implements OnInit {
    orders: Order[] = [];
    loading = true;
    error = '';
    private attemptedRefresh = false;

    myReviews: MyReview[] = [];
    reviewedProductIds = new Set<string>();

    reviewOpen = false;
    reviewOrderId = '';
    reviewProductId = '';
    reviewProductName = '';
    reviewRating = 0;
    reviewComment = '';
    reviewSaving = false;
    reviewError = '';

    reviewPromptOpen = false;
    reviewPromptOrderId = '';
    reviewPromptProductId = '';
    reviewPromptProductName = '';
    private reviewPromptShown = false;
    private promptedProductIds = new Set<string>();

    constructor(
        public orderService: OrderService,
        private authService: AuthService,
        private reviewService: ReviewService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.loadPromptedProducts();
        this.loadOrders();
    }

    private getPromptStorageKey(): string {
        const userId = this.authService.getUserId() || 'guest';
        return `perfumissimo_review_prompted_v1_${userId}`;
    }

    private loadPromptedProducts(): void {
        try {
            const raw = localStorage.getItem(this.getPromptStorageKey());
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                this.promptedProductIds = new Set(parsed.map(String));
            }
        } catch {
            this.promptedProductIds = new Set();
        }
    }

    private savePromptedProducts(): void {
        try {
            localStorage.setItem(this.getPromptStorageKey(), JSON.stringify(Array.from(this.promptedProductIds)));
        } catch {
            // ignore
        }
    }

    private loadOrders(): void {
        this.loading = true;
        this.error = '';

        this.orderService.getMyOrders().subscribe({
            next: (data) => {
                this.orders = data;
                this.loading = false;
                this.loadMyReviews();
            },
            error: (err) => {
                const status = err?.status;

                if ((status === 401 || status === 403) && !this.attemptedRefresh) {
                    this.attemptedRefresh = true;
                    this.authService.refreshUser().subscribe({
                        next: () => this.loadOrders(),
                        error: () => {
                            this.loading = false;
                            this.router.navigate(['/login'], { queryParams: { returnUrl: '/my-orders' } });
                        }
                    });
                    return;
                }

                console.error('Error al cargar órdenes:', err);
                this.error = 'No se pudieron cargar tus pedidos.';
                this.loading = false;
            }
        });
    }

    private loadMyReviews(): void {
        this.reviewService.getMyReviews().subscribe({
            next: (reviews) => {
                this.myReviews = reviews || [];
                this.reviewedProductIds = new Set((reviews || []).map(r => r.producto_id));
                this.maybeShowReviewPrompt();
            },
            error: (err) => {
                console.error('Error cargando reseñas:', err);
                this.myReviews = [];
                this.reviewedProductIds = new Set();
                this.maybeShowReviewPrompt();
            }
        });
    }

    private maybeShowReviewPrompt(): void {
        if (this.reviewPromptShown || this.reviewOpen || this.reviewPromptOpen) return;

        const target = this.findFirstReviewTarget();
        if (!target) return;

        this.reviewPromptShown = true;
        this.reviewPromptOrderId = target.orderId;
        this.reviewPromptProductId = target.productId;
        this.reviewPromptProductName = target.productName;
        this.promptedProductIds.add(target.productId);
        this.savePromptedProducts();
        this.reviewPromptOpen = true;
    }

    private findFirstReviewTarget(): { orderId: string; productId: string; productName: string } | null {
        for (const order of this.orders || []) {
            if (!order || order.estado !== 'ENTREGADO') continue;
            const items = Array.isArray(order.items) ? order.items : [];
            for (const item of items) {
                if (!item?.producto_id) continue;
                if (this.reviewedProductIds.has(item.producto_id)) continue;
                if (this.promptedProductIds.has(item.producto_id)) continue;
                {
                    return {
                        orderId: order.id,
                        productId: item.producto_id,
                        productName: item.nombre || 'Producto'
                    };
                }
            }
        }
        return null;
    }

    closeReviewPrompt(): void {
        this.reviewPromptOpen = false;
    }

    acceptReviewPrompt(): void {
        if (!this.reviewPromptOrderId || !this.reviewPromptProductId) {
            this.closeReviewPrompt();
            return;
        }
        const orderId = this.reviewPromptOrderId;
        const productId = this.reviewPromptProductId;
        const productName = this.reviewPromptProductName;
        this.closeReviewPrompt();
        this.openReview(orderId, productId, productName);
    }

    canReview(order: Order, productId: string): boolean {
        if (!order || order.estado !== 'ENTREGADO') return false;
        return !this.reviewedProductIds.has(productId);
    }

    openReview(orderId: string, productId: string, productName: string): void {
        this.reviewOrderId = orderId;
        this.reviewProductId = productId;
        this.reviewProductName = productName;
        this.reviewRating = 0;
        this.reviewComment = '';
        this.reviewError = '';
        this.reviewOpen = true;
    }

    closeReview(): void {
        this.reviewOpen = false;
        this.reviewOrderId = '';
        this.reviewProductId = '';
        this.reviewProductName = '';
        this.reviewRating = 0;
        this.reviewComment = '';
        this.reviewError = '';
    }

    setRating(value: number): void {
        this.reviewRating = value;
    }

    saveReview(): void {
        if (!this.reviewProductId || !this.reviewOrderId) {
            this.reviewError = 'Falta informacion del producto/pedido.';
            return;
        }
        if (this.reviewRating < 1 || this.reviewRating > 5) {
            this.reviewError = 'Selecciona una calificacion (1 a 5).';
            return;
        }

        this.reviewSaving = true;
        this.reviewError = '';

        this.reviewService.createReview({
            product_id: this.reviewProductId,
            order_id: this.reviewOrderId,
            rating: this.reviewRating,
            comment: this.reviewComment.trim() || undefined
        }).subscribe({
            next: () => {
                this.reviewSaving = false;
                this.reviewedProductIds.add(this.reviewProductId);
                this.closeReview();
            },
            error: (err) => {
                const msg = err?.error?.error || 'No se pudo guardar la reseña.';
                this.reviewError = msg;
                this.reviewSaving = false;
                if (err?.status === 409) {
                    // Ya existe: reflejar en UI
                    this.reviewedProductIds.add(this.reviewProductId);
                }
            }
        });
    }

    getStatusClass(estado: string): string {
        const classes: Record<string, string> = {
            'PENDIENTE': 'bg-yellow-100 text-yellow-800',
            'PAGADO': 'bg-green-100 text-green-800',
            'PROCESANDO': 'bg-sky-100 text-sky-800',
            'ENVIADO': 'bg-blue-100 text-blue-800',
            'CANCELADO': 'bg-red-100 text-red-800',
            'ENTREGADO': 'bg-purple-100 text-purple-800'
        };
        return classes[estado] || 'bg-gray-100 text-gray-600';
    }
}
