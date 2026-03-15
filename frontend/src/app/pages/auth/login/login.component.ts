import { Component, OnInit, NgZone, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { API_CONFIG } from '../../../core/config/api-config';

declare var google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  private static gsiInitialized = false;
  private static gsiRendered = false;
  private gsiRetryTimer?: any;
  private gsiInitAttempts = 0;
  credentials = { email: '', password: '' };
  registerData = { nombre: '', apellido: '', telefono: '', email: '', password: '' };
  isLoginMode = true;
  isLoading = false;
  errorMsg = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.ensureGoogleButton();
  }

  ngOnDestroy(): void {
    if (this.gsiRetryTimer) {
      clearTimeout(this.gsiRetryTimer);
      this.gsiRetryTimer = undefined;
    }
  }

  private ensureGoogleButton(): void {
    this.gsiInitAttempts += 1;

    if (typeof google === 'undefined') {
      this.loadGoogleScript().then(() => this.ensureGoogleButton());
      this.scheduleRetry();
      return;
    }

    if (!LoginComponent.gsiInitialized) {
      google.accounts.id.initialize({
        client_id: API_CONFIG.googleClientId,
        callback: this.handleGoogleResponse.bind(this)
      });
      LoginComponent.gsiInitialized = true;
    }

    const buttonHost = document.getElementById('google-btn');
    if (!buttonHost) {
      this.scheduleRetry();
      return;
    }

    if (!LoginComponent.gsiRendered || !buttonHost.hasChildNodes()) {
      google.accounts.id.renderButton(
        buttonHost,
        {
          theme: 'outline',
          size: 'large',
          width: 320,
          type: 'standard'
        }
      );
      LoginComponent.gsiRendered = true;
    }
  }

  private scheduleRetry(): void {
    if (this.gsiInitAttempts >= 20) return;
    if (this.gsiRetryTimer) return;
    this.gsiRetryTimer = setTimeout(() => {
      this.gsiRetryTimer = undefined;
      this.ensureGoogleButton();
    }, 150);
  }

  private loadGoogleScript(): Promise<void> {
    return new Promise((resolve) => {
      if (document.getElementById('google-gsi')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-gsi';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  handleGoogleResponse(response: any) {
    if (response.credential) {
      this.ngZone.run(() => {
        this.isLoading = true;
        this.authService.loginWithGoogle(response.credential).subscribe({
          next: (res) => {
            this.isLoading = false;

            // Obtener returnUrl de los parámetros de la ruta, o por defecto ir al catálogo
            const returnUrl = this.route.snapshot.queryParams['returnUrl'];

            if (returnUrl) {
              this.router.navigateByUrl(returnUrl);
            } else if (res.user && ['ADMIN', 'SUPERADMIN', 'VENTAS', 'PRODUCTOS'].includes(res.user.rol)) {
              this.router.navigate(['/admin']);
            } else {
              this.router.navigate(['/catalog']); // A la tienda por defecto
            }
          },
          error: (err) => {
            console.error(err);
            this.isLoading = false;
            this.errorMsg = 'Error al iniciar sesión con Google.';
          }
        });
      });
    }
  }

  switchMode() {
    this.isLoginMode = !this.isLoginMode;
    this.errorMsg = '';
  }

  onSubmit() {
    if (this.isLoginMode) {
      if (!this.credentials.email || !this.credentials.password) return;
    } else {
      if (!this.registerData.nombre || !this.registerData.apellido || !this.registerData.telefono || !this.registerData.email || !this.registerData.password) return;
    }

    this.isLoading = true;
    this.errorMsg = '';

    const authObservable = this.isLoginMode
      ? this.authService.login(this.credentials.email, this.credentials.password)
      : this.authService.register(this.registerData);

    authObservable.subscribe({
      next: () => {
        this.isLoading = false;

        const returnUrl = this.route.snapshot.queryParams['returnUrl'];
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
        } else {
          this.router.navigate(['/admin']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error?.error || 'Credenciales inválidas o el servidor está apagado.';
      }
    });
  }
}
