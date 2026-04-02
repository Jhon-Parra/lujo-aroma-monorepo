import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  credentials = { email: '', password: '' };
  registerData = { nombre: '', apellido: '', telefono: '', email: '', password: '' };
  isLoginMode = true;
  isLoading = false;
  errorMsg = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {}

  onGoogleLogin() {
    this.isLoading = true;
    this.errorMsg = '';
    
    this.authService.loginWithGoogle().subscribe({
      next: (res) => {
        this.isLoading = false;
        this.handleNavigation(res);
      },
      error: (err) => {
        console.error('Google login error:', err);
        this.isLoading = false;
        this.errorMsg = 'No se pudo iniciar sesión con Google. Intenta de nuevo.';
      }
    });
  }

  private handleNavigation(res: any) {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
    } else if (res.user && ['ADMIN', 'SUPERADMIN', 'VENTAS', 'PRODUCTOS'].includes(res.user.rol)) {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/catalog']);
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
      next: (res) => {
        this.isLoading = false;
        this.handleNavigation(res);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error?.error || 'Credenciales inválidas o el servidor está apagado.';
      }
    });
  }
}
