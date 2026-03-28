import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://lujo_aromacol.com').replace(/\/$/, '');

/**
 * GET /api/seo/sitemap
 * Genera un sitemap XML dinámico con base en los productos de la base de datos
 */
router.get('/sitemap', async (req: Request, res: Response) => {
    try {
        // Detect current schema
        const [tableCheck] = await pool.query<any[]>(
            `SELECT 
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND lower(table_name) = 'categorias') > 0 AS has_categories,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'productos' AND column_name = 'slug') > 0 AS has_product_slug`
        );
        const hasCategories = !!tableCheck?.[0]?.has_categories;
        const hasProductSlug = !!tableCheck?.[0]?.has_product_slug;

        let products: any[] = [];
        if (hasProductSlug) {
            const [pRows] = await pool.query<any[]>(
                'SELECT slug, actualizado_en FROM Productos WHERE slug IS NOT NULL'
            );
            products = pRows;
        } else {
            const [pRows] = await pool.query<any[]>(
                'SELECT id, actualizado_en FROM Productos'
            );
            products = pRows.map(p => ({ slug: p.id, actualizado_en: p.actualizado_en }));
        }

        let categories: any[] = [];
        if (hasCategories) {
            const [cRows] = await pool.query<any[]>('SELECT slug FROM Categorias');
            categories = cRows;
        }

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        // Rutas estáticas principales
        const staticRoutes = [
            { path: '/', priority: '1.0', changefreq: 'daily' },
            { path: '/catalog', priority: '0.9', changefreq: 'weekly' },
            { path: '/contact', priority: '0.7', changefreq: 'monthly' },
        ];

        const now = new Date().toISOString().split('T')[0];

        staticRoutes.forEach(route => {
            xml += `  <url>\n`;
            xml += `    <loc>${FRONTEND_URL}${route.path}</loc>\n`;
            xml += `    <lastmod>${now}</lastmod>\n`;
            xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
            xml += `    <priority>${route.priority}</priority>\n`;
            xml += `  </url>\n`;
        });

        // Rutas de categorías
        categories.forEach(c => {
            xml += `  <url>\n`;
            xml += `    <loc>${FRONTEND_URL}/catalog?category=${c.slug}</loc>\n`;
            xml += `    <lastmod>${now}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>0.7</priority>\n`;
            xml += `  </url>\n`;
        });

        // Rutas dinámicas de productos
        products.forEach(p => {
            const lastMod = p.actualizado_en ? new Date(p.actualizado_en).toISOString().split('T')[0] : now;
            xml += `  <url>\n`;
            xml += `    <loc>${FRONTEND_URL}/product/${p.slug}</loc>\n`;
            xml += `    <lastmod>${lastMod}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            xml += `  </url>\n`;
        });

        xml += '</urlset>';

        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (error) {
        console.error('Error generating sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
});

export default router;
