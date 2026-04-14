import { Component, OnInit } from '@angular/core';
import { API_CONFIG } from '../../../core/config/api-config';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsService, Settings } from '../../../core/services/settings/settings.service';
import { LowStockBellComponent } from '../../../shared/components/low-stock-bell/low-stock-bell.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LowStockBellComponent],
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {

  private parseJsonMaybe(raw: any): any {
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'object') return raw;
    const s = String(raw || '').trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  }

  isVideoType(typeRaw: any, urlRaw?: any): boolean {
    const t = String(typeRaw || '').trim().toLowerCase();
    if (t === 'video') return true;
    const url = String(urlRaw || '').trim().toLowerCase();
    return url.endsWith('.mp4') || url.endsWith('.webm');
  }

  settings: Settings = {
    hero_title: 'Cargando...',
    hero_subtitle: 'Cargando...',
    hero_media_type: 'image',
    hero_media_url: '',
    accent_color: '#C2A878',
    show_banner: false,
    banner_text: '',
    banner_accent_color: '#C2A878',
    hero_image_url: '',

    logo_url: '',
    logo_height_mobile: 96,
    logo_height_desktop: 112,

    instagram_url: '',
    show_instagram_section: true,
    facebook_url: '',
    tiktok_url: '',
    whatsapp_number: '',
    whatsapp_message: ''
    ,
    envio_prioritario_precio: 0,
    perfume_lujo_precio: 0,
    perfume_lujo_nombre: 'Perfumero de lujo (5ml)',
    empaque_regalo_precio: 0,

    boutique_title: 'Nuestra Boutique',
    boutique_address_line1: 'Calle 12 #13-85',
    boutique_address_line2: 'Bogotá, Colombia',
    boutique_phone: '+57 (300) 123-4567',
    boutique_email: 'contacto@lujo_aroma.com',

    alert_sales_delta_pct: 20,
    alert_abandoned_delta_pct: 20,
    alert_abandoned_value_threshold: 1000000,
    alert_negative_reviews_threshold: 3,
    alert_trend_growth_pct: 30,
    alert_trend_min_units: 5,
    alert_failed_login_threshold: 5,
    alert_abandoned_hours: 24,

    // Home premium
    home_carousel: [
      {
        headline: 'Descubre la esencia del lujo',
        subhead: 'Perfumes originales seleccionados para marcar presencia.',
        ctaText: 'Explorar coleccion',
        ctaLink: '/catalog',
        mediaType: 'video',
        mediaUrl: ''
      },
      {
        headline: 'Fragancias originales que definen tu estilo',
        subhead: 'Bestsellers y lanzamientos: elige tu firma olfativa.',
        ctaText: 'Comprar ahora',
        ctaLink: '/catalog',
        mediaType: 'image',
        mediaUrl: ''
      },
      {
        headline: 'Hasta 20% OFF por tiempo limitado',
        subhead: 'Aprovecha ofertas activas antes de que terminen.',
        ctaText: 'Aprovechar oferta',
        ctaLink: '/catalog?promo=true',
        mediaType: 'image',
        mediaUrl: ''
      }
    ],
    home_categories: [
      {
        title: 'Para El',
        subtitle: 'Fresco. Intenso. Memorables.',
        emotion: 'Define tu presencia',
        link: '/catalog?gender=hombre',
        mediaType: 'image',
        mediaUrl: ''
      },
      {
        title: 'Para Ella',
        subtitle: 'Elegancia que se siente cerca.',
        emotion: 'Elegancia femenina',
        link: '/catalog?gender=mujer',
        mediaType: 'image',
        mediaUrl: ''
      },
      {
        title: 'Exclusivos / Nicho',
        subtitle: 'Oud, arabes, raros.',
        emotion: 'Fragancias unicas',
        link: '/catalog?category=arabe',
        mediaType: 'video',
        mediaUrl: ''
      },
      {
        title: 'Ofertas',
        subtitle: 'Descuentos activos hoy.',
        emotion: 'Compra inteligente',
        link: '/catalog?promo=true',
        mediaType: 'image',
        mediaUrl: ''
      }
    ]
  };

  selectedFile: File | null = null;
  selectedLogoFile: File | null = null;
  selectedEnvioPrioritarioImageFile: File | null = null;
  selectedPerfumeLujoImageFile: File | null = null;
  selectedEmpaqueRegalorImageFile: File | null = null;

  homeSlideFiles: Array<File | null> = [null, null, null];
  homeCategoryFiles: Array<File | null> = [null, null, null, null];
  homeCategoryPosterFiles: Array<File | null> = [null, null, null, null];
  saving = false;
  logoError: string | null = null;

  instagramTokenInput = '';

  constructor(private authService: AuthService, private settingsService: SettingsService) { }

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings() {
    this.settingsService.getSettings().subscribe({
      next: (data) => {
        const parsedCarousel = this.parseJsonMaybe((data as any)?.home_carousel);
        const parsedCategories = this.parseJsonMaybe((data as any)?.home_categories);

        this.settings = {
          ...this.settings,
          ...data,
          logo_height_mobile: (data as any)?.logo_height_mobile ?? 96,
          logo_height_desktop: (data as any)?.logo_height_desktop ?? 112,
          logo_url: (data as any)?.logo_url ?? '',
          show_instagram_section: (data as any)?.show_instagram_section ?? true,
          home_carousel: Array.isArray(parsedCarousel) ? parsedCarousel : (this.settings as any).home_carousel,
          home_categories: Array.isArray(parsedCategories) ? parsedCategories : (this.settings as any).home_categories
        };

        if (!(this.settings as any).banner_accent_color) {
          (this.settings as any).banner_accent_color = (this.settings as any).accent_color || '#C2A878';
        }

        // Backward compat: si no viene hero_media_url, usar hero_image_url
        if (!(this.settings as any).hero_media_url && (this.settings as any).hero_image_url) {
          (this.settings as any).hero_media_url = (this.settings as any).hero_image_url;
        }
        if (!(this.settings as any).hero_media_type) {
          (this.settings as any).hero_media_type = 'image';
        }
        this.instagramTokenInput = '';
      },
      error: (err) => console.error('Error al cargar configuración', err)
    });
  }

  getHomeMediaUrl(raw: any): string {
    const url = String(raw || '').trim();
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    if (url.startsWith('assets/') || url.startsWith('/assets/')) return url.replace(/^\/+/, '');
    return `${API_CONFIG.serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  getHomeSlide(i: number): any {
    const arr = (this.settings as any).home_carousel;
    if (!Array.isArray(arr)) return null;
    return arr[i] || null;
  }

  getHomeCategory(i: number): any {
    const arr = (this.settings as any).home_categories;
    if (!Array.isArray(arr)) return null;
    return arr[i] || null;
  }

  getHomeAccept(type: string): string {
    const t = String(type || 'image').toLowerCase();
    return t === 'video' ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp,image/gif';
  }

  onHomeSlideMediaSelected(index: number, event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    this.homeSlideFiles[index] = file;

    const slide = this.getHomeSlide(index) || {};
    const mime = String(file.type || '').toLowerCase();
    const isVideo = mime.startsWith('video/');

    if (isVideo) {
      slide.mediaType = 'video';
      slide.mediaUrl = URL.createObjectURL(file);
    } else {
      slide.mediaType = 'image';
      const reader = new FileReader();
      reader.onload = (e: any) => {
        slide.mediaUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    const arr = (this.settings as any).home_carousel;
    if (Array.isArray(arr)) arr[index] = slide;
  }

  onHomeCategoryMediaSelected(index: number, event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    this.homeCategoryFiles[index] = file;

    const card = this.getHomeCategory(index) || {};
    const mime = String(file.type || '').toLowerCase();
    const isVideo = mime.startsWith('video/');
    if (isVideo) {
      card.mediaType = 'video';
      card.mediaUrl = URL.createObjectURL(file);
    } else {
      card.mediaType = 'image';
      const reader = new FileReader();
      reader.onload = (e: any) => {
        card.mediaUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    const arr = (this.settings as any).home_categories;
    if (Array.isArray(arr)) arr[index] = card;
  }

  onHomeCategoryPosterSelected(index: number, event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const mime = String(file.type || '').toLowerCase();
    if (!mime.startsWith('image/')) {
      alert('El poster debe ser una imagen (JPEG/PNG/WebP/GIF).');
      event.target.value = '';
      return;
    }

    this.homeCategoryPosterFiles[index] = file;

    // Preview in UI
    const card = this.getHomeCategory(index) || {};
    const reader = new FileReader();
    reader.onload = (e: any) => {
      (card as any).posterUrl = e.target.result;
    };
    reader.readAsDataURL(file);

    const arr = (this.settings as any).home_categories;
    if (Array.isArray(arr)) arr[index] = card;
  }

  getHeroMediaUrl(): string {
    const url = (this.settings.hero_media_url || this.settings.hero_image_url || '').trim();
    if (!url) return '';
    // Si es una imagen base64 (recién seleccionada) o una URL HTTP completa (Supabase)
    if (url.startsWith('data:') || url.startsWith('http')) {
      return url;
    }
    // Fallback: Si por alguna razón es relativa, forzamos un dominio (aunque Supabase devuelve URLs absolutas)
    return `${API_CONFIG.serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  getHeroMediaType(): 'image' | 'gif' | 'video' {
    const t = String((this.settings as any).hero_media_type || 'image').trim().toLowerCase();
    if (t === 'video' || t === 'gif') return t;
    return 'image';
  }

  getHeroAccept(): string {
    return this.getHeroMediaType() === 'video'
      ? 'video/mp4,video/webm'
      : 'image/jpeg,image/png,image/webp,image/gif';
  }

  onHeroMediaSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const type = this.getHeroMediaType();
      const mime = String(file.type || '').toLowerCase();
      const isVideo = mime.startsWith('video/');
      const isGif = mime === 'image/gif';
      const isImage = mime.startsWith('image/');

      const maxBytes = type === 'video' ? (30 * 1024 * 1024) : (10 * 1024 * 1024);
      if (file.size > maxBytes) {
        alert(type === 'video' ? 'El video es demasiado grande. Limite: 30MB.' : 'La imagen es demasiado grande. Limite: 10MB.');
        event.target.value = '';
        return;
      }

      if (type === 'video' && !isVideo) {
        alert('Seleccionaste "Video" pero el archivo no es un video.');
        event.target.value = '';
        return;
      }
      if (type === 'gif' && !isGif) {
        alert('Seleccionaste "GIF" pero el archivo no es GIF.');
        event.target.value = '';
        return;
      }
      if (type === 'image' && !isImage) {
        alert('Seleccionaste "Imagen" pero el archivo no es una imagen.');
        event.target.value = '';
        return;
      }

      this.selectedFile = file;

      if (isVideo) {
        const url = URL.createObjectURL(file);
        (this.settings as any).hero_media_url = url;
      } else {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          (this.settings as any).hero_media_url = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    }
  }

  getLogoUrl(): string {
    const url = (this.settings.logo_url || '').trim();
    if (!url) return 'assets/images/logo.png';

    if (url.startsWith('assets/') || url.startsWith('/assets/')) return url.replace(/^\/+/, '');
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `${API_CONFIG.serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Validación de dimensiones
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const ratio = img.width / img.height;
        if (ratio > 5 || ratio < 0.2) {
          this.logoError = 'El logo tiene dimensiones inusuales. Se recomienda un ratio de 1:1 o 2:1 para mejor visualización.';
        } else {
          this.logoError = null;
        }
        URL.revokeObjectURL(img.src);
      };

      this.selectedLogoFile = file;

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.settings.logo_url = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  getAccentPreviewStyle() {
    return {
      'background-color': this.settings.accent_color || '#C2A878',
      'color': 'white',
      'padding': '8px 16px',
      'border-radius': '6px',
      'text-transform': 'uppercase',
      'font-size': '12px',
      'font-weight': 'bold',
      'letter-spacing': '0.1em',
      'display': 'inline-block'
    };
  }

  getEnvioPrioritarioImageUrl(): string {
    const url = String((this.settings as any).envio_prioritario_image_url || '').trim();
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `${API_CONFIG.serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  onEnvioPrioritarioImageSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.selectedEnvioPrioritarioImageFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      (this.settings as any).envio_prioritario_image_url = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  getPerfumeLujoImageUrl(): string {
    const url = String((this.settings as any).perfume_lujo_image_url || '').trim();
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `${API_CONFIG.serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  onPerfumeLujoImageSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.selectedPerfumeLujoImageFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      (this.settings as any).perfume_lujo_image_url = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  onEmpaqueRegalorImageSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.selectedEmpaqueRegalorImageFile = file;
  }

  saveSettings() {
    this.saving = true;

    // Crear FormData y adjuntar archivos
    const formData = new FormData();
    formData.append('hero_title', this.settings.hero_title);
    formData.append('hero_subtitle', this.settings.hero_subtitle);
    formData.append('hero_media_type', this.getHeroMediaType());
    formData.append('accent_color', this.settings.accent_color);
    formData.append('show_banner', this.settings.show_banner ? 'true' : 'false');
    formData.append('banner_text', this.settings.banner_text);
    formData.append('banner_accent_color', String((this.settings as any).banner_accent_color || this.settings.accent_color || '#C2A878'));

    formData.append('logo_height_mobile', String(this.settings.logo_height_mobile ?? 96));
    formData.append('logo_height_desktop', String(this.settings.logo_height_desktop ?? 112));

    formData.append('instagram_url', this.settings.instagram_url || '');
    formData.append('show_instagram_section', this.settings.show_instagram_section ? 'true' : 'false');
    formData.append('facebook_url', this.settings.facebook_url || '');
    formData.append('tiktok_url', this.settings.tiktok_url || '');
    formData.append('whatsapp_number', this.settings.whatsapp_number || '');
    formData.append('whatsapp_message', this.settings.whatsapp_message || '');

    formData.append('envio_prioritario_precio', String((this.settings as any).envio_prioritario_precio ?? 0));
    formData.append('perfume_lujo_precio', String((this.settings as any).perfume_lujo_precio ?? 0));
    formData.append('perfume_lujo_nombre', String((this.settings as any).perfume_lujo_nombre ?? 'Perfumero de lujo (5ml)'));
    formData.append('empaque_regalo_precio', String((this.settings as any).empaque_regalo_precio ?? 0));

    formData.append('boutique_title', this.settings.boutique_title || '');
    formData.append('boutique_address_line1', this.settings.boutique_address_line1 || '');
    formData.append('boutique_address_line2', this.settings.boutique_address_line2 || '');
    formData.append('boutique_phone', this.settings.boutique_phone || '');
    formData.append('boutique_email', this.settings.boutique_email || '');

    // Email sender (used by automatic order emails)
    formData.append('email_from_name', (this.settings as any).email_from_name || '');
    formData.append('email_from_address', (this.settings as any).email_from_address || '');
    formData.append('email_reply_to', (this.settings as any).email_reply_to || '');
    formData.append('email_bcc_orders', (this.settings as any).email_bcc_orders || '');

    formData.append('alert_sales_delta_pct', String(this.settings.alert_sales_delta_pct ?? ''));
    formData.append('alert_abandoned_delta_pct', String(this.settings.alert_abandoned_delta_pct ?? ''));
    formData.append('alert_abandoned_value_threshold', String(this.settings.alert_abandoned_value_threshold ?? ''));
    formData.append('alert_negative_reviews_threshold', String(this.settings.alert_negative_reviews_threshold ?? ''));
    formData.append('alert_trend_growth_pct', String(this.settings.alert_trend_growth_pct ?? ''));
    formData.append('alert_trend_min_units', String(this.settings.alert_trend_min_units ?? ''));
    formData.append('alert_failed_login_threshold', String(this.settings.alert_failed_login_threshold ?? ''));
    formData.append('alert_abandoned_hours', String(this.settings.alert_abandoned_hours ?? ''));

    // Token IG: solo enviar si el admin lo escribe (no sobreescribir si queda vacio)
    if (this.instagramTokenInput.trim()) {
      formData.append('instagram_access_token', this.instagramTokenInput.trim());
    }

    // Home premium JSON
    try {
      formData.append('home_carousel', JSON.stringify((this.settings as any).home_carousel || []));
      formData.append('home_categories', JSON.stringify((this.settings as any).home_categories || []));
    } catch {
      // ignore
    }

    if (this.selectedFile) {
      formData.append('hero_media', this.selectedFile);
    }

    if (this.selectedLogoFile) {
      formData.append('logo_image', this.selectedLogoFile);
    }

    if (this.selectedEnvioPrioritarioImageFile) {
      formData.append('envio_prioritario_image', this.selectedEnvioPrioritarioImageFile);
    }

    if (this.selectedPerfumeLujoImageFile) {
      formData.append('perfume_lujo_image', this.selectedPerfumeLujoImageFile);
    }

    if (this.selectedEmpaqueRegalorImageFile) {
      formData.append('empaque_regalo_image', this.selectedEmpaqueRegalorImageFile);
    }

    // Home premium uploads
    for (let i = 0; i < this.homeSlideFiles.length; i++) {
      const f = this.homeSlideFiles[i];
      if (f) formData.append(`home_slide_${i + 1}_media`, f);
    }
    for (let i = 0; i < this.homeCategoryFiles.length; i++) {
      const f = this.homeCategoryFiles[i];
      if (f) formData.append(`home_category_${i + 1}_media`, f);
    }

    for (let i = 0; i < this.homeCategoryPosterFiles.length; i++) {
      const f = this.homeCategoryPosterFiles[i];
      if (f) formData.append(`home_category_${i + 1}_poster`, f);
    }

    this.settingsService.updateSettings(formData).subscribe({
      next: (res) => {
        this.saving = false;
        if (res && res.hero_media_url) {
          (this.settings as any).hero_media_url = res.hero_media_url;
        }
        if (res && res.hero_media_type) {
          (this.settings as any).hero_media_type = res.hero_media_type;
        }
        if (res && res.hero_image_url) {
          this.settings.hero_image_url = res.hero_image_url;
        }
        if (res && res.logo_url) {
          this.settings.logo_url = res.logo_url;
        }
        if (res && res.envio_prioritario_image_url) {
          (this.settings as any).envio_prioritario_image_url = res.envio_prioritario_image_url;
        }
        if (res && res.perfume_lujo_image_url) {
          (this.settings as any).perfume_lujo_image_url = res.perfume_lujo_image_url;
        }
        if (res && res.empaque_regalo_image_url) {
          (this.settings as any).empaque_regalo_image_url = res.empaque_regalo_image_url;
        }
        if (res && (res as any).home_carousel) {
          (this.settings as any).home_carousel = (res as any).home_carousel;
        }
        if (res && (res as any).home_categories) {
          (this.settings as any).home_categories = (res as any).home_categories;
        }
        this.instagramTokenInput = '';
        this.selectedEnvioPrioritarioImageFile = null;
        this.selectedPerfumeLujoImageFile = null;
        this.selectedEmpaqueRegalorImageFile = null;
        this.homeSlideFiles = [null, null, null];
        this.homeCategoryFiles = [null, null, null, null];
        this.homeCategoryPosterFiles = [null, null, null, null];
        alert('Configuración actualizada exitosamente');
      },
      error: (err) => {
        this.saving = false;
        console.error('Error:', err);
        const details = err?.error?.details;
        let msg = err?.error?.error || err?.error?.message || err?.message || 'Hubo un error al guardar';
        if (Array.isArray(details) && details.length) {
          msg = details
            .map((d: any) => `${String(d?.field || 'campo')}: ${String(d?.message || '').trim()}`)
            .filter((line: string) => line.trim().length > 0)
            .join('\n');
        }
        alert(msg);
      }
    });
  }

  resetToDefault() {
    if (confirm('¿Estás seguro de restablecer los valores originales? Esto sobrescribirá la configuración actual en pantalla.')) {
      this.settings = {
        hero_title: 'La Esencia del Lujo',
        hero_subtitle: 'Descubre colecciones exclusivas creadas por maestros perfumistas de todo el mundo.',
        hero_media_type: 'image',
        hero_media_url: '/assets/images/hero_bg.webp',
        accent_color: '#C379AC',
        show_banner: true,
        banner_text: 'ENVÍO GRATIS EN PEDIDOS SUPERIORES 5000',
        banner_accent_color: '#C2A878',
        hero_image_url: '/assets/images/hero_bg.webp',
        logo_url: '',
        logo_height_mobile: 96,
        logo_height_desktop: 112,
        instagram_url: '',
        show_instagram_section: true,
        facebook_url: '',
        tiktok_url: '',
        whatsapp_number: '',
        whatsapp_message: '',
        boutique_title: 'Nuestra Boutique',
        boutique_address_line1: 'Calle 12 #13-85',
        boutique_address_line2: 'Bogotá, Colombia',
        boutique_phone: '+57 (300) 123-4567',
        boutique_email: 'contacto@lujo_aroma.com',

        alert_sales_delta_pct: 20,
        alert_abandoned_delta_pct: 20,
        alert_abandoned_value_threshold: 1000000,
        alert_negative_reviews_threshold: 3,
        alert_trend_growth_pct: 30,
        alert_trend_min_units: 5,
        alert_failed_login_threshold: 5,
        alert_abandoned_hours: 24,

        home_carousel: (this.settings as any).home_carousel,
        home_categories: (this.settings as any).home_categories
      };
      this.selectedFile = null;
      this.selectedLogoFile = null;
    }
  }

  logout() {
    this.authService.logout();
  }

  getAdminLogoUrl(): string {
    const s = String(localStorage.getItem('lujo_aroma_settings_cache_v1') || '');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        const url = parsed.logo_url;
        if (url) {
          if (url.startsWith('http') || url.startsWith('data:')) return url;
          if (url.startsWith('assets/')) return '/' + url;
          return url;
        }
      } catch (e) {}
    }
    return '/assets/images/logo.png';
  }
}
