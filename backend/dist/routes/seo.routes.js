"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router = (0, express_1.Router)();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://lujo_aromacol.com').replace(/\/$/, '');
/**
 * GET /api/seo/sitemap
 * Genera un sitemap XML dinámico con base en los productos de la base de datos
 */
router.get('/sitemap', async (req, res) => {
    try {
        // Detect current schema
        const [tableCheck] = await database_1.pool.query(`SELECT 
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND lower(table_name) = 'categorias') > 0 AS has_categories,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'productos' AND column_name = 'slug') > 0 AS has_product_slug`);
        const hasCategories = !!tableCheck?.[0]?.has_categories;
        const hasProductSlug = !!tableCheck?.[0]?.has_product_slug;
        let products = [];
        if (hasProductSlug) {
            const [pRows] = await database_1.pool.query('SELECT slug, actualizado_en FROM Productos WHERE slug IS NOT NULL');
            products = pRows;
        }
        else {
            const [pRows] = await database_1.pool.query('SELECT id, actualizado_en FROM Productos');
            products = pRows.map(p => ({ slug: p.id, actualizado_en: p.actualizado_en }));
        }
        let categories = [];
        if (hasCategories) {
            const [cRows] = await database_1.pool.query('SELECT slug FROM Categorias');
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
    }
    catch (error) {
        console.error('Error generating sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
});
exports.default = router;
