import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { ProductService, LowStockProduct } from '../../../core/services/product/product.service';

@Component({
  selector: 'app-low-stock-bell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './low-stock-bell.component.html',
  styleUrls: ['./low-stock-bell.component.css']
})
export class LowStockBellComponent {
  @Input() threshold = 5;
  @Input() limit = 10;
  @Input() adminRoute = '/admin/products';

  count = 0;
  items: LowStockProduct[] = [];
  loading = false;
  error = '';
  open = false;

  private authSub?: Subscription;

  constructor(
    public authService: AuthService,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.authSub = this.authService.currentUser$.subscribe(() => {
      this.refresh();
    });
    this.refresh();
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }

  canSee(): boolean {
    if (!this.authService.isAuthenticated()) return false;
    const role = String(this.authService.getUserRole() || '').trim().toUpperCase();
    return ['SUPERADMIN', 'ADMIN', 'VENTAS', 'PRODUCTOS'].includes(role);
  }

  toggle(): void {
    if (!this.canSee()) return;
    this.open = !this.open;
    if (this.open) this.refresh();
  }

  close(): void {
    this.open = false;
  }

  refresh(): void {
    if (!this.canSee()) {
      this.count = 0;
      this.items = [];
      this.error = '';
      this.loading = false;
      this.open = false;
      return;
    }

    this.loading = true;
    this.error = '';
    this.productService.getLowStock(this.threshold, this.limit).subscribe({
      next: (res) => {
        this.count = Number(res?.count || 0);
        this.items = res?.items || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Low stock error:', err);
        this.count = 0;
        this.items = [];
        this.error = err?.error?.error || 'No se pudo cargar el inventario.';
        this.loading = false;
      }
    });
  }
}
