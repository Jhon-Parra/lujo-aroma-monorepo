import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, finalize, tap, shareReplay } from 'rxjs/operators';
import { API_CONFIG } from '../../config/api-config';

export interface Settings {
    hero_title: string;
    hero_subtitle: string;
    hero_media_type?: 'image' | 'gif' | 'video' | null;
    hero_media_url?: string | null;
    accent_color: string;
    show_banner: boolean;
    banner_text: string;
    banner_accent_color?: string | null;
    hero_image_url?: string;

    logo_url?: string | null;
    logo_height_mobile?: number | null;
    logo_height_desktop?: number | null;

    instagram_url?: string | null;
    show_instagram_section?: boolean | null;
    instagram_feed_configured?: boolean;
    facebook_url?: string | null;
    tiktok_url?: string | null;
    whatsapp_number?: string | null;
    whatsapp_message?: string | null;

    envio_prioritario_precio?: number | null;
    perfume_lujo_precio?: number | null;
    perfume_lujo_nombre?: string | null;
    empaque_regalo_precio?: number | null;

    envio_prioritario_image_url?: string | null;
    perfume_lujo_image_url?: string | null;
    empaque_regalo_image_url?: string | null;

    email_from_name?: string | null;
    email_from_address?: string | null;
    email_reply_to?: string | null;
    email_bcc_orders?: string | null;

    smtp_host?: string | null;
    smtp_port?: number | null;
    smtp_secure?: boolean | null;
    smtp_user?: string | null;
    smtp_from?: string | null;
    smtp_pass?: string | null;
    smtp_configured?: boolean;

    boutique_title?: string | null;
    boutique_address_line1?: string | null;
    boutique_address_line2?: string | null;
    boutique_phone?: string | null;
    boutique_email?: string | null;

    seller_bank_name?: string | null;
    seller_bank_account_type?: string | null;
    seller_bank_account_number?: string | null;
    seller_bank_account_holder?: string | null;
    seller_bank_account_id?: string | null;
    seller_nequi_number?: string | null;
    seller_payment_notes?: string | null;

    wompi_env?: 'sandbox' | 'production' | null;
    // Nota: la llave publica no se expone por /settings (solo por /payments/wompi/config),
    // pero se deja en el tipo para uso del admin.
    wompi_public_key?: string | null;

    alert_sales_delta_pct?: number | null;
    alert_abandoned_delta_pct?: number | null;
    alert_abandoned_value_threshold?: number | null;
    alert_negative_reviews_threshold?: number | null;
    alert_trend_growth_pct?: number | null;
    alert_trend_min_units?: number | null;
    alert_failed_login_threshold?: number | null;
    alert_abandoned_hours?: number | null;

    cart_recovery_enabled?: boolean | null;
    cart_recovery_message?: string | null;
    cart_recovery_discount_pct?: number | null;
    cart_recovery_countdown_seconds?: number | null;
    cart_recovery_button_text?: string | null;
}

@Injectable({
    providedIn: 'root'
})
export class SettingsService {
    private apiUrl = `${API_CONFIG.baseUrl}/settings`;

    private readonly CACHE_KEY = 'lujo_aroma_settings_cache_v1';
    private settingsSubject = new BehaviorSubject<Settings | null>(null);
    public settings$ = this.settingsSubject.asObservable();
    private inflight$?: Observable<Settings>;

    constructor(private http: HttpClient) { }

    getSettings(): Observable<Settings> {
        const cached = this.settingsSubject.value;
        if (cached) return of(cached);

        const fromStorage = this.loadFromLocal();
        if (fromStorage) {
            this.settingsSubject.next(fromStorage);
            // refrescar en background sin bloquear
            this.refreshSettings().subscribe({ error: () => {} });
            return of(fromStorage);
        }

        return this.refreshSettings();
    }

    refreshSettings(): Observable<Settings> {
        if (this.inflight$) return this.inflight$;

        this.inflight$ = this.http.get<Settings>(this.apiUrl).pipe(
            tap((s) => {
                this.settingsSubject.next(s);
                this.saveToLocal(s);
            }),
            finalize(() => {
                this.inflight$ = undefined;
            }),
            catchError((err) => {
                // si falla, dejar cache (si existe) y propagar error
                return throwError(() => err);
            }),
            shareReplay(1)
        );

        return this.inflight$;
    }

    updateSettings(settings: Settings | FormData): Observable<any> {
        return this.http.put(this.apiUrl, settings, { withCredentials: true }).pipe(
            tap(() => {
                // refrescar cache despues de guardar
                this.refreshSettings().subscribe({ error: () => {} });
            })
        );
    }

    private loadFromLocal(): Settings | null {
        try {
            const raw = localStorage.getItem(this.CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed as Settings;
        } catch {
            return null;
        }
    }

    private saveToLocal(settings: Settings): void {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(settings));
        } catch {
            // ignore
        }
    }
}
