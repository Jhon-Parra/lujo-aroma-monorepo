import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
    rol: string;
    segmento?: string | null;
    creado_en: string;
}

import { API_CONFIG } from '../../config/api-config';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private apiUrl = `${API_CONFIG.baseUrl}/users`;

    constructor(private http: HttpClient) { }

    getUsers(): Observable<User[]> {
        return this.http.get<User[]>(this.apiUrl, { withCredentials: true });
    }

    updateUserRole(id: string, rol: string): Observable<any> {
        return this.http.put(`${this.apiUrl}/${id}/role`, { rol }, { withCredentials: true });
    }

    updateUserSegment(id: string, segmento: string | null): Observable<any> {
        return this.http.put(`${this.apiUrl}/${id}/segment`, { segmento }, { withCredentials: true });
    }
}
