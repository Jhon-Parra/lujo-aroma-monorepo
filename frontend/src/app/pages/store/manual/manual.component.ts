import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SeoService } from '../../../core/services/seo/seo.service';

type ManualItem = {
  title: string;
  body: string;
};

@Component({
  selector: 'app-manual',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './manual.component.html',
  styleUrls: ['./manual.component.css']
})
export class ManualComponent {
  manual: ManualItem[] = [
    {
      title: 'Explorar el catalogo',
      body: 'Entra a Catalogo, usa el buscador y filtra por categoria (Mujer/Hombre/Unisex). Toca un producto para ver su detalle.'
    },
    {
      title: 'Promociones y ofertas',
      body: 'Si un producto tiene descuento activo veras la etiqueta OFERTA y el precio con descuento. El descuento puede ser porcentaje o monto fijo.'
    },
    {
      title: 'Favoritos',
      body: 'Inicia sesion y marca productos con el icono de corazon. Tus favoritos quedan guardados en tu cuenta.'
    },
    {
      title: 'Carrito y checkout',
      body: 'Agrega productos al carrito desde el catalogo o el detalle. En Checkout ajusta cantidades, confirma tu direccion y finaliza el pedido.'
    },
    {
      title: 'Mis pedidos',
      body: 'Desde tu cuenta puedes ver el historial y el estado de tus pedidos, con detalle de items y total.'
    },
    {
      title: 'Resenas',
      body: 'En el detalle del producto puedes ver el promedio y la lista de resenas verificadas (si existen).'
    }
  ];

  tools: ManualItem[] = [
    {
      title: 'Dashboard (ventas y actividad)',
      body: 'Metricas de ingresos, pedidos por estado, ventas por mes, top productos y vista rapida de pedidos pendientes.'
    },
    {
      title: 'Gestion de pedidos',
      body: 'Listado, filtros por estado/busqueda, detalle por pedido, cambio de estado y exportacion a CSV.'
    },
    {
      title: 'Catalogo de productos',
      body: 'Administracion de productos, actualizacion de stock y herramienta de importacion masiva desde Excel/CSV (con validacion).'
    },
    {
      title: 'IA para descripcion de productos',
      body: 'Genera descripciones para productos desde el panel de productos (segun permisos).'
    },
    {
      title: 'Promociones avanzadas',
      body: 'Crear promos con reglas (GLOBAL/ESPECIFICO/GENERO) y audiencia; soporta porcentaje o monto fijo y prioridad cuando hay varias promos.'
    },
    {
      title: 'Personalizacion de la tienda',
      body: 'Logo configurable (tamano desktop/mobile), imagen/hero, textos y enlaces a redes sociales (Instagram/Facebook/WhatsApp).'
    },
    {
      title: 'Alertas de stock bajo',
      body: 'Campana de stock bajo (<= 5) para roles autorizados, visible en pantallas admin.'
    }
  ];

  constructor(private seo: SeoService) {
    this.seo.set({
      title: 'Manual de uso | Perfumissimo',
      description: 'Guia rapida para comprar en Perfumissimo y conocer las herramientas disponibles para administrar la tienda.'
    });
  }
}
