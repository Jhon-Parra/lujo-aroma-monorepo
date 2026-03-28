import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Promotion, PromotionService } from '../../../core/services/promotion/promotion.service';
import { SeoService } from '../../../core/services/seo/seo.service';

@Component({
  selector: 'app-promotions-store',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './promotions.component.html',
  styleUrls: ['./promotions.component.css']
})
export class PromotionsStoreComponent implements OnInit {
  loading = true;
  error = '';
  promotions: Promotion[] = [];

  constructor(
    private promotionService: PromotionService,
    private seo: SeoService
  ) {}

  ngOnInit(): void {
    this.seo.set({
      title: 'Promociones | Lujo & Aroma',
      description: 'Explora todas las promociones activas y compra con descuento.'
    });

    this.promotionService.getPromotions().subscribe({
      next: (rows) => {
        const list = rows || [];
        this.promotions = list.filter((p) => this.isActiveNow(p));
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando promociones:', err);
        this.error = err?.error?.error || 'No se pudieron cargar las promociones.';
        this.promotions = [];
        this.loading = false;
      }
    });
  }

  isAmountPromotion(p: Promotion): boolean {
    const dtype = String((p as any)?.discount_type || 'PERCENT').toUpperCase();
    return dtype === 'AMOUNT' && Number((p as any)?.amount_discount || 0) > 0;
  }

  getAmountOff(p: Promotion): number {
    const n = Number((p as any)?.amount_discount || 0);
    return Number.isFinite(n) ? n : 0;
  }

  getPercentOff(p: Promotion): number {
    const n = Number((p as any)?.porcentaje_descuento || 0);
    return Number.isFinite(n) ? n : 0;
  }

  private isActiveNow(p: Promotion): boolean {
    const now = Date.now();
    const start = new Date(p.fecha_inicio).getTime();
    const end = new Date(p.fecha_fin).getTime();
    return !!p.activo && Number.isFinite(start) && Number.isFinite(end) && start <= now && end >= now;
  }
}
