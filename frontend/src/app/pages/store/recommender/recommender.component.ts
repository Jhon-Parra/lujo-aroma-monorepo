import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { RecommendationService, QuizAnswers, RecommendationItem } from '../../../core/services/recommendation/recommendation.service';

@Component({
  selector: 'app-recommender',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './recommender.component.html',
  styleUrls: ['./recommender.component.css']
})
export class RecommenderComponent implements OnInit {
  tab: 'quiz' | 'free' = 'quiz';

  step = 0;
  answers: QuizAnswers = {
    for_who: 'unisex',
    aroma: undefined,
    occasion: undefined,
    intensity: undefined,
    climate: undefined
  };

  freeText = '';

  loading = false;
  error = '';
  results: RecommendationItem[] = [];

  constructor(
    private reco: RecommendationService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.reco.recordEvent('view_recommender', { tab: this.tab }).subscribe({ error: () => {} });

    this.route.queryParams.subscribe((p) => {
      const q = String(p['q'] || '').trim();
      const mode = String(p['mode'] || '').trim().toLowerCase();
      if (mode === 'free') this.tab = 'free';
      if (q) {
        this.tab = 'free';
        this.freeText = q;
        this.submitFree();
      }
    });
  }

  setTab(t: 'quiz' | 'free'): void {
    this.tab = t;
    this.error = '';
    this.results = [];
    this.reco.recordEvent('switch_tab', { tab: t }).subscribe({ error: () => {} });
  }

  next(): void {
    this.step = Math.min(this.step + 1, 4);
  }

  back(): void {
    this.step = Math.max(this.step - 1, 0);
  }

  restartQuiz(): void {
    this.step = 0;
    this.answers = { for_who: 'unisex' };
    this.results = [];
    this.error = '';
    this.reco.recordEvent('quiz_restart').subscribe({ error: () => {} });
  }

  submitQuiz(): void {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    this.results = [];

    this.reco.recordEvent('quiz_submit_ui', { answers: this.answers }).subscribe({ error: () => {} });
    this.reco.recommendFromQuiz(this.answers).subscribe({
      next: (resp) => {
        this.results = resp?.recommendations || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.error?.message || 'No se pudo generar la recomendación.';
      }
    });
  }

  submitFree(): void {
    const q = String(this.freeText || '').trim();
    if (q.length < 3) {
      this.error = 'Escribe al menos 3 caracteres.';
      return;
    }
    if (this.loading) return;

    this.loading = true;
    this.error = '';
    this.results = [];

    this.reco.recordEvent('free_submit_ui', { query: q }).subscribe({ error: () => {} });
    this.reco.recommendFromFreeText(q).subscribe({
      next: (resp) => {
        this.results = resp?.recommendations || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.error?.message || 'No se pudo generar la recomendación.';
      }
    });
  }

  openProduct(id: string): void {
    this.reco.recordEvent('click_recommendation', { product_id: id, tab: this.tab }).subscribe({ error: () => {} });
    this.router.navigate(['/product', id]);
  }
}
