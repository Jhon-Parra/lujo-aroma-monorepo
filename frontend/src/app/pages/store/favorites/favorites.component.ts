import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { ProductCardComponent, Product } from '../../../shared/components/product-card/product-card.component';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-favorites',
    standalone: true,
    imports: [CommonModule, NavbarComponent, FooterComponent, ProductCardComponent, RouterModule],
    templateUrl: './favorites.component.html'
})
export class FavoritesComponent implements OnInit {
    favoriteProducts: Product[] = [];

    constructor(private favoritesService: FavoritesService) { }

    ngOnInit(): void {
        this.favoritesService.favorites$.subscribe(favs => {
            this.favoriteProducts = favs;
        });
    }
}
