import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CartService, CartItem } from '../../../core/services/cart/cart.service';
import { OrderService, CreateOrderDto } from '../../../core/services/order/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { WompiService, WompiPseBank } from '../../../core/services/payment/wompi.service';
import { SettingsService, Settings } from '../../../core/services/settings/settings.service';

@Component({
    selector: 'app-checkout',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './checkout.component.html',
    styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit, OnDestroy {

    private readonly checkoutDraftPrefix = 'perfumissimo_checkout_draft_v1';
    private readonly checkoutDraftTtlMs = 7 * 24 * 60 * 60 * 1000; // 7 dias
    private draftSaveTimer?: any;

    @HostListener('document:keydown', ['$event'])
    onDocumentKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Escape') return;
        if (this.isPlacingOrder) return;
        event.preventDefault();
        this.cancelPurchase();
    }

    cartItems: CartItem[] = [];
    cartTotal = 0;

    envioPrioritario = false;
    perfumeLujo = false;
    empaqueRegalo = false;
    envioPrioritarioPrecio = 0;
    perfumeLujoPrecio = 0;
    empaqueRegaloPrecio = 0;
    extrasTotal = 0;
    grandTotal = 0;

    private settingsSub: any;

    priorityShippingImg = '';
    luxuryPerfumeImg = '';
    giftWrapImg = '';

    shippingAddress = '';
    city = '';
    phone = '';
    isPlacingOrder = false;
    orderSuccess = false;
    createdOrderId = '';
    errorMsg = '';
    checkoutStep = 1; // 1: Info, 2: extras/Payment method, 3: Payment details
    private attemptedRefresh = false;

    cartRecoveryEnabled = false; // DESACTIVADO: Removed per user request
    cartRecoveryMessage = '¡Espera! No te vayas todavía. Completa tu compra ahora y obtén un 10% de descuento exclusivo por tiempo limitado.';
    cartRecoveryDiscountPct = 10;
    cartRecoveryCountdownSeconds = 120;
    cartRecoveryButtonText = 'Finalizar compra';
    showCartRecovery = false;
    cartRecoveryRemaining = 0;
    cartRecoveryApplied = false;
    cartRecoveryDiscountAmount = 0;
    showClearCartConfirm = false;
    private cartRecoveryTimer?: any;
    private exitIntentHandler?: (event: MouseEvent) => void;
    private cartRecoveryPendingAction: 'cancel' | 'clear' | null = null;
    private readonly cartRecoveryStoragePrefix = 'perfumissimo_cart_recovery';
    private readonly cartRecoveryTtlMs = 5 * 60 * 60 * 1000;
    private cartRecoveryExpiryTimer?: any;
    private cartRecoveryAppliedAt = 0;
    cartRecoveryExpiredNotice = false;
    cartRecoveryExpiredMessage = 'El descuento de recuperacion expiro.';
    private cartRecoveryExpiredNotified = false;
    private readonly cartRecoveryExpiredNoticeKey = 'perfumissimo_cart_recovery_expired_notice_shown';

    paymentMethod: 'WOMPI_PSE' | 'WOMPI_NEQUI' | 'WOMPI_CARD' = 'WOMPI_PSE';

    wompiAcceptanceToken = '';
    wompiTermsUrl = '';
    wompiMerchantName = '';
    wompiBanks: WompiPseBank[] = [];
    wompiLoading = false;
    wompiBaseUrl = '';
    wompiPublicKey = '';

    pseUserType: '0' | '1' = '0';
    pseLegalIdType = 'CC';
    pseLegalId = '';
    pseBankCode = '';
    pseAcceptedTerms = false;

    nequiPhone = '';

    cardHolderName = '';
    cardNumber = '';
    cardExpMonth = '';
    cardExpYear = '';
    cardCvc = '';
    cardInstallments = 1;

    // ── Real-time validation touch tracking ──────────────────────────────────
    touchedAddress = false;
    touchedCity = false;
    touchedPhone = false;

    /** Returns the numeric-only characters of the phone field, for template validation */
    get phoneDigits(): string { return this.phone.replace(/\D/g, ''); }
    touchedPseDoc = false;
    touchedPseBank = false;
    touchedNequi = false;
    touchedCardHolder = false;
    touchedCardNumber = false;

    constructor(
        public cartService: CartService,
        private orderService: OrderService,
        public authService: AuthService,
        private wompiService: WompiService,
        private settingsService: SettingsService,
        private router: Router
    ) {
        this.priorityShippingImg = this.svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f3d2e"/>
      <stop offset="1" stop-color="#c2a878"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="96" height="96" rx="18" fill="url(#g)"/>
  <path d="M24 58V41a5 5 0 0 1 5-5h32a5 5 0 0 1 5 5v17" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
  <path d="M66 45h7l7 9v4H66" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="35" cy="62" r="6" fill="#ffffff"/>
  <circle cx="67" cy="62" r="6" fill="#ffffff"/>
  <path d="M30 30h22" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
  <path d="M30 24h14" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
</svg>`);

        this.luxuryPerfumeImg = this.svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c2a878"/>
      <stop offset="1" stop-color="#0f3d2e"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="96" height="96" rx="18" fill="url(#g)"/>
  <path d="M40 20h16v9H40z" fill="#ffffff"/>
  <path d="M35 34h26v38a8 8 0 0 1-8 8H43a8 8 0 0 1-8-8V34z" fill="none" stroke="#ffffff" stroke-width="5" stroke-linejoin="round"/>
  <path d="M35 48h26" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
  <path d="M48 40l3 6 7 1-5 4 1 7-6-3-6 3 1-7-5-4 7-1z" fill="#ffffff" opacity="0.9"/>
</svg>`);

        this.giftWrapImg = this.svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e91e8c"/>
      <stop offset="1" stop-color="#c2a878"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="96" height="96" rx="18" fill="url(#g)"/>
  <!-- caja regalo -->
  <rect x="20" y="46" width="56" height="36" rx="5" fill="none" stroke="#fff" stroke-width="5"/>
  <!-- tapa -->
  <rect x="16" y="36" width="64" height="14" rx="4" fill="none" stroke="#fff" stroke-width="5"/>
  <!-- lazo vertical -->
  <line x1="48" y1="36" x2="48" y2="82" stroke="#fff" stroke-width="5"/>
  <!-- lazo horizontal -->
  <line x1="16" y1="46" x2="80" y2="46" stroke="#fff" stroke-width="5"/>
  <!-- moño izquierdo -->
  <path d="M48 36 C38 28, 26 30, 30 36 C34 42, 44 38, 48 36" fill="#fff" opacity="0.85"/>
  <!-- moño derecho -->
  <path d="M48 36 C58 28, 70 30, 66 36 C62 42, 52 38, 48 36" fill="#fff" opacity="0.85"/>
</svg>`);
    }

    ngOnInit(): void {
        // Restaurar borrador (direccion/paso/metodo/extras) antes de pintar
        this.loadCheckoutDraft();

        // Usar la suscripción correcta del CartService (items$)
        this.cartService.items$.subscribe((items: CartItem[]) => {
            this.cartItems = items;
            this.cartTotal = items.reduce(
                (sum: number, i: CartItem) => sum + (i.product.price * i.quantity), 0
            );
            this.recalcTotals();
        });

        // Escuchar cambios de settings (el servicio puede devolver cache primero y refrescar luego)
        this.settingsSub = this.settingsService.settings$.subscribe((s) => {
            if (!s) return;
            this.envioPrioritarioPrecio = Number((s as any).envio_prioritario_precio || 0) || 0;
            this.perfumeLujoPrecio = Number((s as any).perfume_lujo_precio || 0) || 0;
            this.empaqueRegaloPrecio = Number((s as any).empaque_regalo_precio || 0) || 0;

            this.applyCartRecoverySettings(s);

            const envioImg = String((s as any).envio_prioritario_image_url || '').trim();
            const lujoImg = String((s as any).perfume_lujo_image_url || '').trim();
            const regalImg = String((s as any).empaque_regalo_image_url || '').trim();
            if (envioImg) this.priorityShippingImg = envioImg;
            if (lujoImg) this.luxuryPerfumeImg = lujoImg;
            if (regalImg) this.giftWrapImg = regalImg;
            this.recalcTotals();
        });

        // Garantizar refresh al entrar a checkout
        this.settingsService.refreshSettings().subscribe({
            next: (s: Settings) => {
                this.envioPrioritarioPrecio = Number((s as any).envio_prioritario_precio || 0) || 0;
                this.perfumeLujoPrecio = Number((s as any).perfume_lujo_precio || 0) || 0;
                this.empaqueRegaloPrecio = Number((s as any).empaque_regalo_precio || 0) || 0;

                this.applyCartRecoverySettings(s);

                const envioImg = String((s as any).envio_prioritario_image_url || '').trim();
                const lujoImg = String((s as any).perfume_lujo_image_url || '').trim();
                const regalImg = String((s as any).empaque_regalo_image_url || '').trim();
                if (envioImg) this.priorityShippingImg = envioImg;
                if (lujoImg) this.luxuryPerfumeImg = lujoImg;
                if (regalImg) this.giftWrapImg = regalImg;
                this.recalcTotals();
            },
            error: () => {
                // Mantener defaults
            }
        });

        // Prefetch Wompi data segun metodo restaurado
        if (this.paymentMethod === 'WOMPI_PSE' || this.paymentMethod === 'WOMPI_NEQUI' || this.paymentMethod === 'WOMPI_CARD') {
            this.loadWompiData();
        }

        // this.setupExitIntent(); // REMOVED: No more popups on exit intent

        this.cartRecoveryApplied = this.getRecoveryApplied();
        this.scheduleRecoveryExpiryCheck();
        this.recalcTotals();

        // Guardar inmediatamente el estado restaurado
        this.scheduleDraftSave();
    }

    ngOnDestroy(): void {
        this.saveCheckoutDraft();
        if (this.draftSaveTimer) {
            clearTimeout(this.draftSaveTimer);
            this.draftSaveTimer = undefined;
        }

        try {
            this.settingsSub?.unsubscribe?.();
        } catch {
            // ignore
        }

        if (this.exitIntentHandler) {
            document.removeEventListener('mouseout', this.exitIntentHandler);
        }
        if (this.cartRecoveryTimer) {
            clearInterval(this.cartRecoveryTimer);
            this.cartRecoveryTimer = undefined;
        }
        if (this.cartRecoveryExpiryTimer) {
            clearTimeout(this.cartRecoveryExpiryTimer);
            this.cartRecoveryExpiryTimer = undefined;
        }
    }

    @HostListener('window:beforeunload')
    onBeforeUnload(): void {
        this.saveCheckoutDraft();
    }

    scheduleDraftSave(): void {
        if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
        this.draftSaveTimer = setTimeout(() => {
            this.saveCheckoutDraft();
        }, 450);
    }

    private getCheckoutDraftKey(): string {
        const userId = this.authService.getUserId();
        return `${this.checkoutDraftPrefix}_${userId || 'guest'}`;
    }

    private loadCheckoutDraft(): void {
        const key = this.getCheckoutDraftKey();
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const updatedAt = Number(parsed?.updatedAt || 0);
            if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
                localStorage.removeItem(key);
                return;
            }
            if (Date.now() - updatedAt > this.checkoutDraftTtlMs) {
                localStorage.removeItem(key);
                return;
            }

            const step = Math.max(1, Math.min(3, Math.trunc(Number(parsed?.step || 1))));
            this.checkoutStep = step;

            this.shippingAddress = String(parsed?.shippingAddress || this.shippingAddress);
            this.city = String(parsed?.city || this.city);
            this.phone = String(parsed?.phone || this.phone);

            this.envioPrioritario = !!parsed?.envioPrioritario;
            this.perfumeLujo = !!parsed?.perfumeLujo;
            this.empaqueRegalo = !!parsed?.empaqueRegalo;

            const pm = String(parsed?.paymentMethod || '').toUpperCase();
            if (pm === 'WOMPI_PSE' || pm === 'WOMPI_NEQUI' || pm === 'WOMPI_CARD') {
                this.paymentMethod = pm as any;
            }

            // Guardar solo datos no sensibles
            const userType = String(parsed?.pseUserType || this.pseUserType);
            if (userType === '0' || userType === '1') this.pseUserType = userType as any;
            this.pseLegalIdType = String(parsed?.pseLegalIdType || this.pseLegalIdType);
            this.pseLegalId = String(parsed?.pseLegalId || this.pseLegalId);
            this.pseBankCode = String(parsed?.pseBankCode || this.pseBankCode);
            this.pseAcceptedTerms = !!parsed?.pseAcceptedTerms;
            this.nequiPhone = String(parsed?.nequiPhone || this.nequiPhone);
            this.cardInstallments = Math.max(1, Math.min(36, Math.trunc(Number(parsed?.cardInstallments || this.cardInstallments || 1))));

            this.recalcTotals();
        } catch {
            // ignore
        }
    }

    private saveCheckoutDraft(): void {
        const key = this.getCheckoutDraftKey();
        try {
            const payload = {
                updatedAt: Date.now(),
                step: this.checkoutStep,
                shippingAddress: this.shippingAddress,
                city: this.city,
                phone: this.phone,
                envioPrioritario: this.envioPrioritario,
                perfumeLujo: this.perfumeLujo,
                empaqueRegalo: this.empaqueRegalo,
                paymentMethod: this.paymentMethod,
                pseUserType: this.pseUserType,
                pseLegalIdType: this.pseLegalIdType,
                pseLegalId: this.pseLegalId,
                pseBankCode: this.pseBankCode,
                pseAcceptedTerms: this.pseAcceptedTerms,
                nequiPhone: this.nequiPhone,
                cardInstallments: this.cardInstallments
            };
            localStorage.setItem(key, JSON.stringify(payload));
        } catch {
            // ignore
        }
    }

    private clearCheckoutDraft(): void {
        const key = this.getCheckoutDraftKey();
        try {
            localStorage.removeItem(key);
        } catch {
            // ignore
        }
    }

    private applyCartRecoverySettings(s: Settings): void {
        this.cartRecoveryEnabled = !!s.cart_recovery_enabled;
        this.cartRecoveryMessage = String(s.cart_recovery_message || this.cartRecoveryMessage);
        this.cartRecoveryDiscountPct = Number(s.cart_recovery_discount_pct ?? this.cartRecoveryDiscountPct) || this.cartRecoveryDiscountPct;
        this.cartRecoveryCountdownSeconds = Number(s.cart_recovery_countdown_seconds ?? this.cartRecoveryCountdownSeconds) || this.cartRecoveryCountdownSeconds;
        this.cartRecoveryButtonText = String(s.cart_recovery_button_text || this.cartRecoveryButtonText);
    }

    private setupExitIntent(): void {
        if (this.exitIntentHandler) return;
        this.exitIntentHandler = (event: MouseEvent) => {
            if (!this.cartRecoveryEnabled) return;
            if (this.showCartRecovery) return;
            if (this.orderSuccess) return;
        if (!this.cartItems || this.cartItems.length === 0) return;
        if (this.cartRecoveryApplied) return;
        const shown = this.getRecoveryShown();
        if (shown) return;

            const related = (event as any).relatedTarget;
            if (related) return;
            if (event.clientY > 0) return;

            this.openCartRecovery();
        };

        document.addEventListener('mouseout', this.exitIntentHandler);
    }

    private openCartRecovery(): void {
        this.showCartRecovery = true;
        this.cartRecoveryRemaining = Math.max(10, Math.floor(this.cartRecoveryCountdownSeconds || 0));
        this.setRecoveryShown();

        if (this.cartRecoveryTimer) {
            clearInterval(this.cartRecoveryTimer);
        }

        this.cartRecoveryTimer = setInterval(() => {
            this.cartRecoveryRemaining = Math.max(0, this.cartRecoveryRemaining - 1);
            if (this.cartRecoveryRemaining <= 0) {
                this.closeCartRecovery();
            }
        }, 1000);
    }

    closeCartRecovery(): void {
        // Cierra el modal sin ejecutar la accion pendiente.
        this.showCartRecovery = false;
        this.cartRecoveryPendingAction = null;
        if (this.cartRecoveryTimer) {
            clearInterval(this.cartRecoveryTimer);
            this.cartRecoveryTimer = undefined;
        }
    }

    dismissCartRecovery(): void {
        this.closeCartRecovery();
    }

    proceedCartRecoveryPendingAction(): void {
        const pending = this.cartRecoveryPendingAction;
        this.closeCartRecovery();
        if (pending === 'clear') {
            this.cartService.clearCart();
            return;
        }
        if (pending === 'cancel') {
            // Seguir comprando: volver al catalogo/categorias
            this.saveCheckoutDraft();
            this.router.navigate(['/catalog']);
        }
    }

    onCartRecoveryAction(): void {
        this.cartRecoveryApplied = true;
        this.setRecoveryApplied();
        this.cartRecoveryPendingAction = null;
        this.cartRecoveryExpiredNotice = false;
        this.recalcTotals();
        this.closeCartRecovery();

        // Mantener al usuario en el modal de pago: si ya tiene datos minimos,
        // llevarlo al paso 3 para que finalice la compra.
        const phoneClean = this.phone.trim().replace(/\D/g, '');
        const canGoToPayment = !!this.shippingAddress.trim() && !!this.city.trim() && phoneClean.length >= 7;
        if (canGoToPayment) {
            this.checkoutStep = 3;
            this.loadWompiData();
        }

        this.saveCheckoutDraft();
    }

    private getRecoveryStorageKey(suffix: 'applied' | 'shown'): string {
        const userId = this.authService.getUserId();
        return `${this.cartRecoveryStoragePrefix}_${suffix}_${userId || 'guest'}`;
    }

    private expireRecoveryDiscount(): void {
        this.clearRecoveryState();
        this.cartRecoveryApplied = false;
        if (!this.cartRecoveryExpiredNotified) {
            this.cartRecoveryExpiredNotice = true;
            this.cartRecoveryExpiredNotified = true;
            try {
                sessionStorage.setItem(this.cartRecoveryExpiredNoticeKey, '1');
            } catch {
                // ignore
            }
        }
        this.recalcTotals();
    }

    private scheduleRecoveryExpiryCheck(): void {
        if (this.cartRecoveryExpiryTimer) {
            clearTimeout(this.cartRecoveryExpiryTimer);
            this.cartRecoveryExpiryTimer = undefined;
        }

        if (!this.cartRecoveryApplied || !this.cartRecoveryAppliedAt) return;

        const remaining = (this.cartRecoveryAppliedAt + this.cartRecoveryTtlMs) - Date.now();
        if (remaining <= 0) {
            this.expireRecoveryDiscount();
            return;
        }

        this.cartRecoveryExpiryTimer = setTimeout(() => {
            this.expireRecoveryDiscount();
        }, remaining);
    }

    private getRecoveryApplied(): boolean {
        const key = this.getRecoveryStorageKey('applied');
        try {
            try {
                this.cartRecoveryExpiredNotified = sessionStorage.getItem(this.cartRecoveryExpiredNoticeKey) === '1';
            } catch {
                this.cartRecoveryExpiredNotified = false;
            }
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            const applied = parsed?.applied === true;
            const appliedAt = Number(parsed?.appliedAt || 0);
            if (!applied || !Number.isFinite(appliedAt) || appliedAt <= 0) {
                localStorage.removeItem(key);
                return false;
            }
            if (Date.now() - appliedAt > this.cartRecoveryTtlMs) {
                localStorage.removeItem(key);
                if (!this.cartRecoveryExpiredNotified) {
                    this.cartRecoveryExpiredNotice = true;
                    this.cartRecoveryExpiredNotified = true;
                    try {
                        sessionStorage.setItem(this.cartRecoveryExpiredNoticeKey, '1');
                    } catch {
                        // ignore
                    }
                }
                return false;
            }
            this.cartRecoveryAppliedAt = appliedAt;
            return true;
        } catch {
            return false;
        }
    }

    private setRecoveryApplied(): void {
        const key = this.getRecoveryStorageKey('applied');
        try {
            const appliedAt = Date.now();
            this.cartRecoveryAppliedAt = appliedAt;
            localStorage.setItem(key, JSON.stringify({ applied: true, appliedAt }));
            this.scheduleRecoveryExpiryCheck();
        } catch {
            // ignore
        }
    }

    private clearRecoveryState(): void {
        const appliedKey = this.getRecoveryStorageKey('applied');
        const shownKey = this.getRecoveryStorageKey('shown');
        try {
            localStorage.removeItem(appliedKey);
        } catch {
            // ignore
        }
        try {
            sessionStorage.removeItem(shownKey);
        } catch {
            // ignore
        }
        try {
            sessionStorage.removeItem(this.cartRecoveryExpiredNoticeKey);
        } catch {
            // ignore
        }
        this.cartRecoveryAppliedAt = 0;
        this.cartRecoveryExpiredNotified = false;
        if (this.cartRecoveryExpiryTimer) {
            clearTimeout(this.cartRecoveryExpiryTimer);
            this.cartRecoveryExpiryTimer = undefined;
        }
    }

    private getRecoveryShown(): boolean {
        const key = this.getRecoveryStorageKey('shown');
        try {
            return sessionStorage.getItem(key) === '1';
        } catch {
            return false;
        }
    }

    private setRecoveryShown(): void {
        const key = this.getRecoveryStorageKey('shown');
        try {
            sessionStorage.setItem(key, '1');
        } catch {
            // ignore
        }
    }

    removeItem(item: CartItem): void {
        if (!item?.product?.id) return;
        const name = item.product?.name || item.product?.nombre || 'este producto';
        const ok = window.confirm(`¿Eliminar ${name} del carrito?`);
        if (!ok) return;
        this.cartService.removeFromCart(item.product.id);
    }

    cancelPurchase(): void {
        if (this.isPlacingOrder) return;

        this.saveCheckoutDraft();

        if (this.cartRecoveryEnabled && this.cartItems.length > 0 && !this.cartRecoveryApplied) {
            this.cartRecoveryPendingAction = 'cancel';
            this.openCartRecovery();
            return;
        }

        this.router.navigate(['/catalog']);
    }

    clearCart(): void {
        if (this.cartRecoveryEnabled && this.cartItems.length > 0 && !this.cartRecoveryApplied) {
            this.cartRecoveryPendingAction = 'clear';
            this.openCartRecovery();
            return;
        }
        this.openClearCartConfirm();
    }

    private openClearCartConfirm(): void {
        this.showClearCartConfirm = true;
    }

    closeClearCartConfirm(): void {
        this.showClearCartConfirm = false;
    }

    confirmClearCart(): void {
        this.showClearCartConfirm = false;
        this.cartService.clearCart();
    }

    updateQuantity(item: CartItem, delta: number): void {
        if (!item?.product?.id) return;
        const next = Math.max(1, (item.quantity || 1) + delta);
        this.cartService.updateQuantity(item.product.id, next);
    }

    setQuantity(item: CartItem, value: string): void {
        if (!item?.product?.id) return;
        const n = Math.max(1, Math.trunc(Number(value || 1)));
        this.cartService.updateQuantity(item.product.id, n);
    }

    get cartRecoveryCountdownLabel(): string {
        const total = Math.max(0, this.cartRecoveryRemaining || 0);
        const min = Math.floor(total / 60).toString().padStart(2, '0');
        const sec = Math.floor(total % 60).toString().padStart(2, '0');
        return `${min}:${sec}`;
    }

    get cartRecoverySecondaryLabel(): string {
        if (this.cartRecoveryPendingAction === 'clear') return 'Vaciar carrito';
        if (this.cartRecoveryPendingAction === 'cancel') return 'Seguir comprando';
        return 'Salir';
    }

    onToggleExtras(): void {
        this.recalcTotals();
        this.scheduleDraftSave();
    }

    private recalcTotals(): void {
        const ep = this.envioPrioritario ? Math.max(0, Number(this.envioPrioritarioPrecio || 0)) : 0;
        const pl = this.perfumeLujo ? Math.max(0, Number(this.perfumeLujoPrecio || 0)) : 0;
        const er = this.empaqueRegalo ? Math.max(0, Number(this.empaqueRegaloPrecio || 0)) : 0;
        this.extrasTotal = ep + pl + er;
        const pct = Math.max(0, Math.min(80, Number(this.cartRecoveryDiscountPct || 0)));
        this.cartRecoveryDiscountAmount = this.cartRecoveryApplied
            ? Math.max(0, Math.round(this.cartTotal * (pct / 100)))
            : 0;
        this.grandTotal = Math.max(0, this.cartTotal - this.cartRecoveryDiscountAmount) + this.extrasTotal;
    }

    private svgToDataUrl(svg: string): string {
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    onPaymentMethodChange(): void {
        this.errorMsg = '';
        if (this.paymentMethod === 'WOMPI_PSE' || this.paymentMethod === 'WOMPI_NEQUI' || this.paymentMethod === 'WOMPI_CARD') {
            this.loadWompiData();
        }
        this.scheduleDraftSave();
    }

    private loadWompiData(): void {
        if (this.wompiLoading) return;
        const needsBanks = this.paymentMethod === 'WOMPI_PSE';
        const needsConfig = this.paymentMethod === 'WOMPI_CARD';

        const hasMerchant = !!this.wompiAcceptanceToken && !!this.wompiTermsUrl;
        const hasBanks = !needsBanks || this.wompiBanks.length > 0;
        const hasConfig = !needsConfig || (!!this.wompiBaseUrl && !!this.wompiPublicKey);

        if (hasMerchant && hasBanks && hasConfig) return;

        this.wompiLoading = true;

        this.wompiService.getMerchant().subscribe({
            next: (m) => {
                this.wompiAcceptanceToken = m?.presigned_acceptance?.acceptance_token || '';
                this.wompiTermsUrl = m?.presigned_acceptance?.permalink || '';
                this.wompiMerchantName = m?.name || '';

                if (needsConfig) {
                    this.wompiService.getConfig().subscribe({
                        next: (cfg) => {
                            this.wompiBaseUrl = String(cfg?.base_url || '').trim();
                            this.wompiPublicKey = String(cfg?.public_key || '').trim();

                            if (needsBanks) {
                                this.wompiService.getPseBanks().subscribe({
                                    next: (b) => {
                                        this.wompiBanks = Array.isArray(b?.data) ? b.data : [];
                                        this.wompiLoading = false;
                                    },
                                    error: (err) => {
                                        console.error('Error cargando bancos PSE:', err);
                                        this.wompiBanks = [];
                                        this.wompiLoading = false;
                                    }
                                });
                            } else {
                                this.wompiLoading = false;
                            }
                        },
                        error: (err) => {
                            console.error('Error cargando config Wompi:', err);
                            this.wompiBaseUrl = '';
                            this.wompiPublicKey = '';
                            this.wompiLoading = false;
                        }
                    });
                    return;
                }

                if (needsBanks) {
                    this.wompiService.getPseBanks().subscribe({
                        next: (b) => {
                            this.wompiBanks = Array.isArray(b?.data) ? b.data : [];
                            this.wompiLoading = false;
                        },
                        error: (err) => {
                            console.error('Error cargando bancos PSE:', err);
                            this.wompiBanks = [];
                            this.wompiLoading = false;
                        }
                    });
                } else {
                    this.wompiLoading = false;
                }
            },
            error: (err) => {
                console.error('Error cargando merchant Wompi:', err);
                this.wompiAcceptanceToken = '';
                this.wompiTermsUrl = '';
                this.wompiMerchantName = '';
                this.wompiBanks = [];
                this.wompiBaseUrl = '';
                this.wompiPublicKey = '';
                this.wompiLoading = false;
            }
        });
    }

    placeOrder(): void {
        if (this.cartItems.length === 0) {
            this.errorMsg = 'Tu carrito está vacío. Agrega productos antes de finalizar la compra.';
            return;
        }

        if (!this.shippingAddress.trim()) {
            this.touchedAddress = true;
            this.errorMsg = 'Por favor ingresa tu dirección de envío.';
            return;
        }

        const phoneClean = this.phone.trim().replace(/\D/g, '');
        if (!phoneClean || phoneClean.length < 7) {
            this.touchedPhone = true;
            this.errorMsg = 'Por favor ingresa un número de teléfono válido (mínimo 7 dígitos).';
            return;
        }

        const hasInvalid = this.cartItems.some((i) => !i?.product?.id || !Number.isFinite(Number(i.product.price)));
        if (hasInvalid) {
            this.errorMsg = 'Hay productos inválidos en el carrito. Vacía el carrito y vuelve a intentarlo.';
            return;
        }

        this.isPlacingOrder = true;
        this.errorMsg = '';

        if (this.paymentMethod === 'WOMPI_PSE') {
            this.submitWompiPse();
            return;
        }
        if (this.paymentMethod === 'WOMPI_NEQUI') {
            this.submitWompiNequi();
            return;
        }
        if (this.paymentMethod === 'WOMPI_CARD') {
            this.submitWompiCard();
            return;
        }

        this.errorMsg = 'Selecciona un método de pago válido.';
        this.isPlacingOrder = false;
    }

    nextStep(): void {
        this.errorMsg = '';
        if (this.checkoutStep === 1) {
            if (!this.shippingAddress.trim()) {
                this.touchedAddress = true;
                this.errorMsg = 'Ingresa la dirección de envío.';
                return;
            }
            if (!this.city.trim()) {
                this.touchedCity = true;
                this.errorMsg = 'Ingresa la ciudad.';
                return;
            }
            const phoneClean = this.phone.trim().replace(/\D/g, '');
            if (!phoneClean || phoneClean.length < 7) {
                this.touchedPhone = true;
                this.errorMsg = 'Ingresa un teléfono válido.';
                return;
            }
            this.checkoutStep = 2;
            this.saveCheckoutDraft();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (this.checkoutStep === 2) {
            // Step 2 is payment method selection
            if (!this.paymentMethod) {
                this.errorMsg = 'Selecciona un método de pago.';
                return;
            }
            this.checkoutStep = 3;
            this.loadWompiData(); // Ensure data is loaded for step 3
            this.saveCheckoutDraft();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
    }

    prevStep(): void {
        this.errorMsg = '';
        if (this.checkoutStep > 1) {
            this.checkoutStep--;
            this.saveCheckoutDraft();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    private submitWompiCard(): void {
        if (!this.wompiAcceptanceToken || !this.wompiTermsUrl || !this.wompiBaseUrl || !this.wompiPublicKey) {
            this.errorMsg = 'No se pudo cargar Wompi. Intenta de nuevo.';
            this.isPlacingOrder = false;
            return;
        }
        if (!this.pseAcceptedTerms) {
            this.errorMsg = 'Debes aceptar los términos de Wompi para continuar.';
            this.isPlacingOrder = false;
            return;
        }

        const holder = String(this.cardHolderName || '').trim();
        if (!holder) {
            this.errorMsg = 'Ingresa el nombre del titular.';
            this.isPlacingOrder = false;
            return;
        }

        const number = String(this.cardNumber || '').replace(/\s|-/g, '');
        if (!this.isValidCardNumber(number)) {
            this.errorMsg = 'Numero de tarjeta inválido.';
            this.isPlacingOrder = false;
            return;
        }

        const mm = String(this.cardExpMonth || '').replace(/\D/g, '');
        const yyRaw = String(this.cardExpYear || '').replace(/\D/g, '');
        const monthN = Number(mm);
        const yearN = Number(yyRaw);
        if (!Number.isFinite(monthN) || monthN < 1 || monthN > 12) {
            this.errorMsg = 'Mes de vencimiento inválido.';
            this.isPlacingOrder = false;
            return;
        }
        if (!Number.isFinite(yearN) || (yyRaw.length !== 2 && yyRaw.length !== 4)) {
            this.errorMsg = 'Ano de vencimiento invalido. Usa 2 digitos (ej: 26) o 4 (ej: 2026).';
            this.isPlacingOrder = false;
            return;
        }

        const yy = yyRaw.length === 4
            ? yyRaw.slice(-2)
            : yyRaw.padStart(2, '0').slice(-2);

        const cvc = String(this.cardCvc || '').replace(/\D/g, '');
        if (cvc.length < 3 || cvc.length > 4) {
            this.errorMsg = 'CVC inválido.';
            this.isPlacingOrder = false;
            return;
        }

        const inst = Math.max(1, Math.min(36, Math.trunc(Number(this.cardInstallments || 1))));

        this.tokenizeCard({
            number,
            exp_month: mm.padStart(2, '0'),
            // Wompi card tokenization expects exp_year as 2 digits (YY)
            exp_year: yy,
            cvc,
            card_holder: holder
        }).then((token) => {
            const payload = {
                ...this.buildOrderData(),
                acceptance_token: this.wompiAcceptanceToken,
                token,
                installments: inst
            };

            this.wompiService.createCardCheckout(payload as any).subscribe({
                next: (res) => {
                    this.isPlacingOrder = false;
                    this.clearRecoveryState();
                    this.clearCheckoutDraft();
                    this.cartService.clearCart();
                    this.router.navigate(['/order-success', res.orderId]);
                },
                error: (err) => {
                    console.error('Error creando checkout tarjeta:', err);
                    const status = err?.status;
                    if ((status === 401 || status === 403) && !this.attemptedRefresh) {
                        this.attemptedRefresh = true;
                        this.authService.refreshUser().subscribe({
                            next: () => this.submitWompiCard(),
                            error: () => {
                                this.isPlacingOrder = false;
                                this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
                            }
                        });
                        return;
                    }
                    const msg = err?.error?.message || err?.error?.error || err?.error?.detail || 'No se pudo iniciar el pago con tarjeta.';
                    this.errorMsg = msg;
                    this.isPlacingOrder = false;
                }
            });
        }).catch((e: any) => {
            console.error('Error tokenizando tarjeta:', e);
            const msg = e?.message || String(e);
            this.errorMsg = msg.includes('Http') ? 'No se pudo validar la tarjeta. Revisa los datos e intenta de nuevo.' : msg;
            this.isPlacingOrder = false;
        });
    }

    private async tokenizeCard(input: { number: string; exp_month: string; exp_year: string; cvc: string; card_holder: string }): Promise<string> {
        const url = `${this.wompiBaseUrl.replace(/\/+$/, '')}/tokens/cards`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.wompiPublicKey}`
            },
            body: JSON.stringify(input)
        });

        const json = await resp.json().catch(() => ({} as any));
        if (!resp.ok) {
            const err = (json as any)?.error;
            const type = String(err?.type || '').trim();

            // INPUT_VALIDATION_ERROR: extraer errores por campo
            if (type === 'INPUT_VALIDATION_ERROR' && err?.messages && typeof err.messages === 'object') {
                const translateMsg = (m: string): string => {
                    let msg = String(m || '');
                    if (msg.includes('debe coincidir con el patron "^\\d{2}$"')) return 'debe tener exactamente 2 digitos (ej: 26)';
                    if (msg.includes('debe coincidir con el patron "^\\d{4}$"')) return 'debe tener exactamente 4 digitos (ej: 2026)';
                    if (msg.includes('no debe contener menos de')) {
                        const num = msg.match(/\d+/);
                        return `debe tener al menos ${num ? num[0] : 'varios'} caracteres`;
                    }
                    if (msg.includes('no es una fecha valida')) return 'no es una fecha valida';
                    if (msg.includes('es obligatorio')) return 'es requerido';
                    return msg;
                };

                const FIELD_LABELS: Record<string, string> = {
                    number: 'Numero de tarjeta',
                    exp_month: 'Mes de vencimiento',
                    exp_year: 'Ano de vencimiento',
                    cvc: 'CVC/CVV',
                    card_holder: 'Nombre del titular'
                };
                const lines: string[] = [];
                for (const [field, msgs] of Object.entries(err.messages)) {
                    const label = FIELD_LABELS[field] || field.replace(/_/g, ' ');
                    const list = Array.isArray(msgs) ? msgs : [msgs];
                    list.forEach((m: any) => lines.push(`• ${label}: ${translateMsg(m)}`));
                }
                throw new Error(lines.length ? lines.join('\n') : type);
            }
            throw new Error(err?.reason || err?.message || type || `HTTP ${resp.status}`);
        }

        const token = String((json as any)?.data?.id || (json as any)?.data?.token || (json as any)?.id || '').trim();
        if (!token) throw new Error('Token de tarjeta no recibido');
        return token;
    }

    isValidCardNumber(num: string): boolean {
        if (!/^[0-9]{12,19}$/.test(num)) return false;
        let sum = 0;
        let shouldDouble = false;
        for (let i = num.length - 1; i >= 0; i--) {
            let digit = Number(num.charAt(i));
            if (shouldDouble) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            shouldDouble = !shouldDouble;
        }
        return sum % 10 === 0;
    }

    /** Template-safe: checks nequi phone length without regex in template */
    isValidNequiPhone(): boolean {
        return this.nequiPhone.replace(/\D/g, '').length >= 10;
    }

    /** Template-safe: checks current card number validity without regex in template */
    isValidCardNum(): boolean {
        return this.isValidCardNumber(this.cardNumber.replace(/[\s-]/g, ''));
    }

    private submitWompiNequi(): void {
        if (!this.wompiAcceptanceToken || !this.wompiTermsUrl) {
            this.errorMsg = 'No se pudo cargar Wompi. Intenta de nuevo.';
            this.isPlacingOrder = false;
            return;
        }
        if (!this.pseAcceptedTerms) {
            this.errorMsg = 'Debes aceptar los términos de Wompi para continuar.';
            this.isPlacingOrder = false;
            return;
        }
        const phone = String(this.nequiPhone || '').replace(/\D/g, '');
        if (!phone || phone.length < 10) {
            this.errorMsg = 'Ingresa tu número de Nequi.';
            this.isPlacingOrder = false;
            return;
        }

        const payload = {
            ...this.buildOrderData(),
            acceptance_token: this.wompiAcceptanceToken,
            phone_number: phone
        };

        this.wompiService.createNequiCheckout(payload as any).subscribe({
                next: (res) => {
                    this.isPlacingOrder = false;
                    this.clearRecoveryState();
                    this.clearCheckoutDraft();
                    this.cartService.clearCart();
                    // Nequi no requiere redireccion: queda en verificacion.
                    this.router.navigate(['/order-success', res.orderId]);
                },
            error: (err) => {
                console.error('Error creando checkout Nequi:', err);
                const status = err?.status;
                if ((status === 401 || status === 403) && !this.attemptedRefresh) {
                    this.attemptedRefresh = true;
                    this.authService.refreshUser().subscribe({
                        next: () => this.submitWompiNequi(),
                        error: () => {
                            this.isPlacingOrder = false;
                            this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
                        }
                    });
                    return;
                }
                const msg = err?.error?.message || err?.error?.error || err?.error?.detail || 'No se pudo iniciar el pago con Nequi.';
                this.errorMsg = msg;
                this.isPlacingOrder = false;
            }
        });
    }

    private submitWompiPse(): void {
        if (!this.wompiAcceptanceToken || !this.wompiTermsUrl) {
            this.errorMsg = 'No se pudo cargar Wompi. Intenta de nuevo.';
            this.isPlacingOrder = false;
            return;
        }
        if (!this.pseAcceptedTerms) {
            this.errorMsg = 'Debes aceptar los términos de Wompi para continuar.';
            this.isPlacingOrder = false;
            return;
        }
        if (!String(this.pseLegalId).trim()) {
            this.errorMsg = 'Ingresa tu número de documento para PSE.';
            this.isPlacingOrder = false;
            return;
        }
        if (!String(this.pseBankCode).trim()) {
            this.errorMsg = 'Selecciona un banco para PSE.';
            this.isPlacingOrder = false;
            return;
        }

        const payload = {
            ...this.buildOrderData(),
            acceptance_token: this.wompiAcceptanceToken,
            user_type: this.pseUserType,
            user_legal_id_type: this.pseLegalIdType,
            user_legal_id: String(this.pseLegalId).trim(),
            financial_institution_code: this.pseBankCode
        };

        this.wompiService.createPseCheckout(payload as any).subscribe({
                next: (res) => {
                    this.isPlacingOrder = false;
                    // La orden ya fue creada (y se reservo stock). Evitar duplicados en el carrito.
                    this.clearRecoveryState();
                    this.clearCheckoutDraft();
                    this.cartService.clearCart();
                    // Redirigir a PSE (Wompi)
                    window.location.href = res.asyncPaymentUrl;
                },
            error: (err) => {
                console.error('Error creando checkout PSE:', err);
                const status = err?.status;

                if ((status === 401 || status === 403) && !this.attemptedRefresh) {
                    this.attemptedRefresh = true;
                    this.authService.refreshUser().subscribe({
                        next: () => this.submitWompiPse(),
                        error: () => {
                            this.isPlacingOrder = false;
                            this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
                        }
                    });
                    return;
                }
                const msg = err?.error?.message || err?.error?.error || err?.error?.detail || 'No se pudo iniciar el pago con PSE.';
                this.errorMsg = msg;
                this.isPlacingOrder = false;
            }
        });
    }

    private buildOrderData(): CreateOrderDto {
        return {
            total: this.grandTotal,
            shipping_address: `${this.city.trim()}, ${this.shippingAddress.trim()}`,
            phone: this.phone.trim(),
            items: this.cartItems.map((item: CartItem) => ({
                product_id: item.product.id,
                quantity: item.quantity,
                price: Number(item.product.price)
            })),
            cart_session_id: this.cartService.getCartSessionId(),
            cart_recovery_applied: this.cartRecoveryApplied,
            cart_recovery_discount_pct: this.cartRecoveryApplied ? this.cartRecoveryDiscountPct : 0,
            envio_prioritario: this.envioPrioritario,
            perfume_lujo: this.perfumeLujo,
            empaque_regalo: this.empaqueRegalo,
            metodo_pago: this.paymentMethod,
            nombre_cliente: this.authService.getUserFullName(),
            canal_pago: 'Wompi'
        };
    }

    private submitOrder(): void {
        const orderData = this.buildOrderData();

        this.orderService.createOrder(orderData).subscribe({
            next: (response) => {
                this.createdOrderId = response.orderId;
                this.clearRecoveryState();
                this.clearCheckoutDraft();
                this.cartService.clearCart();
                this.isPlacingOrder = false;
                this.router.navigate(['/order-success', response.orderId]);
            },
            error: (err) => {
                console.error('Error al crear orden:', err);
                const status = err?.status;

                if ((status === 401 || status === 403) && !this.attemptedRefresh) {
                    this.attemptedRefresh = true;
                    this.authService.refreshUser().subscribe({
                        next: () => {
                            this.submitOrder();
                        },
                        error: () => {
                            this.isPlacingOrder = false;
                            this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
                        }
                    });
                    return;
                }

                if (status === 0) {
                    this.errorMsg = 'No se pudo conectar con el servidor. Revisa que el backend esté activo.';
                } else {
                    this.errorMsg = err?.error?.message || err?.error?.error || 'Error al procesar tu pedido. Inténtalo de nuevo.';
                }
                this.isPlacingOrder = false;
            }
        });
    }

    /** Shortcut helpers para el template */
    getItemPrice(item: CartItem): number {
        return item.product.price * item.quantity;
    }

    getItemImage(item: CartItem): string {
        return item.product.imageUrl || 'https://images.unsplash.com/photo-1594035910387-fea47714263f?q=80&w=100';
    }
}
