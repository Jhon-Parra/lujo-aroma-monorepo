import { Request, Response } from 'express';
import { pool } from '../config/database';
import { generateSlug } from '../utils/slug.util';

export const getSitemap = async (req: Request, res: Response): Promise<void> => {
    try {
        const baseUrl = 'https://perfumesbogota.com';
        
        // 1. Páginas principales (estáticas)
        const staticPages = [
            '/',
            '/catalog',
            '/contact',
            '/login'
        ];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        const defaultDate = new Date().toISOString().split('T')[0];

        // Añadir páginas estáticas
        staticPages.forEach(page => {
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}${page === '/' ? '' : page}</loc>\n`;
            xml += `    <lastmod>${defaultDate}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>${page === '/' ? '1.0' : '0.8'}</priority>\n`;
            xml += `  </url>\n`;
        });

        // 2. Obtener productos (dinámicos)
        let products: any[] = [];
        try {
            const [rows] = await pool.query<any[]>(`SELECT nombre, creado_en FROM productos WHERE activo = 1`);
            products = rows;
        } catch {
            // Fallback si la columna 'activo' no existe
            const [rows] = await pool.query<any[]>(`SELECT nombre, creado_en FROM productos`);
            products = rows;
        }

        if (Array.isArray(products)) {
            products.forEach((p: any) => {
                if (!p.nombre) return;
                const slug = generateSlug(p.nombre);
                let lastmod = defaultDate;
                if (p.creado_en) {
                    try {
                        const d = new Date(p.creado_en);
                        if (!isNaN(d.getTime())) {
                            lastmod = d.toISOString().split('T')[0];
                        }
                    } catch (e) {}
                }
                
                xml += `  <url>\n`;
                xml += `    <loc>${baseUrl}/perfume/${slug}</loc>\n`;
                xml += `    <lastmod>${lastmod}</lastmod>\n`;
                xml += `    <changefreq>daily</changefreq>\n`;
                xml += `    <priority>0.9</priority>\n`;
                xml += `  </url>\n`;
            });
        }

        // 3. Obtener categorías (si existen)
        try {
            const [categories] = await pool.query<any[]>(`SELECT nombre FROM categorias`);
            if (Array.isArray(categories)) {
                categories.forEach((c: any) => {
                    if (!c.nombre) return;
                    const slug = generateSlug(c.nombre);
                    xml += `  <url>\n`;
                    xml += `    <loc>${baseUrl}/categoria/${slug}</loc>\n`;
                    xml += `    <lastmod>${defaultDate}</lastmod>\n`;
                    xml += `    <changefreq>weekly</changefreq>\n`;
                    xml += `    <priority>0.7</priority>\n`;
                    xml += `  </url>\n`;
                });
            }
        } catch (catError) {
            // Ignorar si la tabla de categorías no existe
        }

        xml += `</urlset>`;

        // Responder con tipo de contenido XML
        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (error) {
        console.error('Error generating sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
};
