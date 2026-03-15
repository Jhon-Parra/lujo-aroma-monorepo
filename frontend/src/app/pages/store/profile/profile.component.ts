import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit {
  user = {
    nombre: '',
    apellido: '',
    email: '',
    telefono: ''
  };

  editing = false;
  saving = false;
  message = '';

  constructor(public authService: AuthService) { }

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.user = {
        nombre: currentUser.nombre || '',
        apellido: currentUser.apellido || '',
        email: currentUser.email || '',
        telefono: ''
      };
    }
  }

  getUserPhoto(): string | null {
    return this.authService.getUserPhoto();
  }

  getUserInitials(): string {
    return this.authService.getUserInitials();
  }

  toggleEdit() {
    this.editing = !this.editing;
    if (!this.editing) {
      this.message = '';
    }
  }

  saveProfile() {
    this.saving = true;
    this.message = '';

    setTimeout(() => {
      this.saving = false;
      this.editing = false;
      this.message = 'Perfil actualizado correctamente';
    }, 1000);
  }
}
