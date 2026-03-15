import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export type ToastMessage = {
  id: string;
  message: string;
  tone: ToastTone;
};

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  toasts$ = this.toastsSubject.asObservable();

  show(message: string, tone: ToastTone = 'info', duration = 3200): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = [...this.toastsSubject.value, { id, message, tone }];
    this.toastsSubject.next(next);

    window.setTimeout(() => this.dismiss(id), duration);
  }

  success(message: string, duration = 3200): void {
    this.show(message, 'success', duration);
  }

  warning(message: string, duration = 3800): void {
    this.show(message, 'warning', duration);
  }

  error(message: string, duration = 4200): void {
    this.show(message, 'error', duration);
  }

  dismiss(id: string): void {
    const next = this.toastsSubject.value.filter((t) => t.id !== id);
    this.toastsSubject.next(next);
  }
}
