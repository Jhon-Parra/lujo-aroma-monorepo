import { Request, Response } from 'express';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

import { supabase } from '../config/supabase';
import { sanitizeFilename } from '../middleware/upload.middleware';

/**
 * Helper to upload a file to Supabase perfumissimo_bucket/products/
 */
async function uploadToSupabase(file: Express.Multer.File): Promise<string> {
    const uniqueFilename = sanitizeFilename(file.originalname);
    const { data, error } = await supabase.storage
        .from('perfumissimo_bucket')
        .upload(`products/${uniqueFilename}`, file.buffer, {
            contentType: file.mimetype,
            upsert: true
        });

    if (error) throw new Error('Error subiendo imagen de producto a Supabase: ' + error.message);

    const { data: publicData } = supabase.storage
        .from('perfumissimo_bucket')
        .getPublicUrl(`products/${uniqueFilename}`);

    return publicData.publicUrl;
}

let promotionAssignmentReady: boolean | null = null;
let promotionGenderReady: boolean | null = null;
let promotionAdvancedReady: boolean | null = null;

let categoriesReady: boolean | null = null;
const detectCategoriesSchema = async (): Promise<boolean> => {
    if (categoriesReady !== null) return categoriesReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) AS ok 
             FROM information_schema.tables 
             WHERE table_schema = DATABASE() 
               AND lower(table_name) = 'categorias'`
        );
        categoriesReady = Number(rows?.[0]?.ok || 0) > 0;
        return categoriesReady;
    } catch {
        categoriesReady = false;
        return false;
    }
};

const normalizeCategorySlug = (raw: any): string | null => {
    if (raw === undefined || raw === null) return null;
    const v = String(raw).trim().toLowerCase();
    if (!v) return null;
    return v.length > 120 ? v.slice(0, 120) : v;
};

const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .trim()
        .normalize('NFD') // Quitar acentos
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '') // Quitar caracteres especiales
        .replace(/\s+/g, '-') // Espacios por guiones
        .replace(/-+/g, '-') // Evitar guiones dobles
        .replace(/^-+|-+$/g, ''); // Quitar guiones al inicio/final
};

type CategorySqlParts = { categorySelect: string; categoryJoin: string };
const getCategorySqlParts = async (): Promise<CategorySqlParts> => {
    const ok = await detectCategoriesSchema();
    if (!ok) return { categorySelect: '', categoryJoin: '' };
    return {
        categorySelect: ', c.nombre AS categoria_nombre, c.slug AS categoria_slug',
        categoryJoin: 'LEFT JOIN categorias c ON c.slug = p.genero'
    };
};

const ensureCategoryExists = async (slug: string): Promise<boolean> => {
    try {
        const [rows] = await pool.query<any[]>(
            'SELECT 1 AS ok FROM categorias WHERE slug = ? LIMIT 1',
            [slug]
        );
        return !!rows?.[0]?.ok;
    } catch {
        return false;
    }
};

let productSlugReady: boolean | null = null;
const detectSlugSchema = async (): Promise<boolean> => {
    if (productSlugReady !== null) return productSlugReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) AS ok
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'productos'
               AND column_name = 'slug'
             LIMIT 1`
        );
        productSlugReady = !!rows?.[0]?.ok;
        return productSlugReady;
    } catch {
        productSlugReady = false;
        return false;
    }
};

let productNewUntilReady: boolean | null = null;
const detectProductNewUntilSchema = async (): Promise<boolean> => {
    if (productNewUntilReady !== null) return productNewUntilReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) AS ok
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'productos'
               AND column_name = 'nuevo_hasta'
             LIMIT 1`
        );
        productNewUntilReady = !!rows?.[0]?.ok;
        return productNewUntilReady;
    } catch {
        productNewUntilReady = false;
        return false;
    }
};

const parseNuevoHastaInput = (raw: any): string | null | undefined => {
    if (raw === undefined || raw === null) return undefined;
    const v = String(raw).trim();
    if (!v) return null;
    // Aceptar formatos comunes (datetime-local o ISO); Postgres parsea.
    return v;
};

const detectPromotionAssignmentSchema = async (): Promise<boolean> => {
    if (promotionAssignmentReady !== null) return promotionAssignmentReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND lower(table_name) = 'promocionproductos') > 0 AS has_pp,
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND lower(table_name) = 'promocionusuarios') > 0 AS has_pu,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'promociones' AND column_name = 'product_scope') > 0 AS has_product_scope,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'promociones' AND column_name = 'audience_scope') > 0 AS has_audience_scope
            `
        );

        const r = rows?.[0] || {};
        promotionAssignmentReady = !!(r.has_pp && r.has_pu && r.has_product_scope && r.has_audience_scope);
        return promotionAssignmentReady;
    } catch {
        promotionAssignmentReady = false;
        return false;
    }
};

const detectPromotionGenderSchema = async (): Promise<boolean> => {
    if (promotionGenderReady !== null) return promotionGenderReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT
                COUNT(*) > 0 AS has_product_gender
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'promociones'
               AND column_name = 'product_gender'
            `
        );
        const r = rows?.[0] || {};
        promotionGenderReady = !!r.has_product_gender;
        return promotionGenderReady;
    } catch {
        promotionGenderReady = false;
        return false;
    }
};

const detectPromotionAdvancedSchema = async (): Promise<boolean> => {
    if (promotionAdvancedReady !== null) return promotionAdvancedReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'promociones' AND column_name = 'discount_type') > 0 AS has_discount_type,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'promociones' AND column_name = 'amount_discount') > 0 AS has_amount_discount,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'promociones' AND column_name = 'priority') > 0 AS has_priority
            `
        );
        const r = rows?.[0] || {};
        promotionAdvancedReady = !!(r.has_discount_type && r.has_amount_discount && r.has_priority);
        return promotionAdvancedReady;
    } catch {
        promotionAdvancedReady = false;
        return false;
    }
};

type PromotionAdvancedSqlParts = {
    advancedReady: boolean;
    discountAmountExpr: string;
    orderByPromo: string;
};

const getPromotionAdvancedSqlParts = async (): Promise<PromotionAdvancedSqlParts> => {
    const advancedReady = await detectPromotionAdvancedSchema();
    const discountAmountExpr = advancedReady
        ? "CASE WHEN pr.discount_type = 'AMOUNT' THEN LEAST(COALESCE(pr.amount_discount, 0), p.precio) ELSE (p.precio * (pr.porcentaje_descuento / 100.0)) END"
        : '(p.precio * (pr.porcentaje_descuento / 100.0))';
    const orderByPromo = advancedReady
        ? `pr.priority DESC, (${discountAmountExpr}) DESC, pr.porcentaje_descuento DESC`
        : 'pr.porcentaje_descuento DESC';
    return { advancedReady, discountAmountExpr, orderByPromo };
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, genero, descripcion, notas_olfativas, notas, precio, stock, unidades_vendidas, es_nuevo, nuevo_hasta } = req.body;
        const notasFinal = notas_olfativas || notas;

        const categoriesOk = await detectCategoriesSchema();
        const newUntilOk = await detectProductNewUntilSchema();
        const generoNormalized = normalizeCategorySlug(genero) || 'unisex';
        if (categoriesOk) {
            const exists = await ensureCategoryExists(generoNormalized);
            if (!exists) {
                res.status(400).json({ error: 'Categoria invalida. Crea la categoria primero en Admin > Categorias.' });
                return;
            }
        }

        const nuevoHastaParsed = parseNuevoHastaInput(nuevo_hasta);
        if (nuevoHastaParsed !== undefined && !newUntilOk) {
            res.status(400).json({
                error: 'Tu base de datos no soporta expiración de etiqueta NUEVO. Ejecuta las migraciones de base de datos y vuelve a intentar.'
            });
            return;
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        let imagen_url = null;
        let imagen_url_2 = null;
        let imagen_url_3 = null;

        if (files?.['imagen']?.[0]) {
            imagen_url = await uploadToSupabase(files['imagen'][0]);
        }
        if (files?.['imagen2']?.[0]) {
            imagen_url_2 = await uploadToSupabase(files['imagen2'][0]);
        }
        if (files?.['imagen3']?.[0]) {
            imagen_url_3 = await uploadToSupabase(files['imagen3'][0]);
        }

        const id = uuidv4();
        const slug = generateSlug(nombre);
        const slugOk = await detectSlugSchema();

        // Convert UUID to BINARY(16) in MySQL logic
        const cols: string[] = ['id', 'nombre', 'genero', 'descripcion', 'notas_olfativas', 'precio', 'stock', 'unidades_vendidas', 'imagen_url', 'imagen_url_2', 'imagen_url_3', 'es_nuevo'];
        const vals: any[] = [
            id,
            nombre,
            generoNormalized,
            descripcion,
            notasFinal,
            precio,
            stock || 0,
            unidades_vendidas || 0,
            imagen_url,
            imagen_url_2,
            imagen_url_3,
            !!es_nuevo
        ];

        if (slugOk) {
            cols.push('slug');
            vals.push(slug);
        }

        if (newUntilOk) {
            cols.push('nuevo_hasta');
            vals.push(nuevoHastaParsed === undefined ? null : nuevoHastaParsed);
        }

        const placeholders = cols.map(() => '?').join(', ');
        const query = `INSERT INTO productos (${cols.join(', ')}) VALUES (${placeholders})`;

        await pool.query(query, vals);

        res.status(201).json({
            message: 'Producto creado exitosamente',
            product: { id, nombre, precio, imagen_url }
        });
    } catch (error: any) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Error del servidor al crear producto' });
    }
};

// 2. Obtener todos los productos
export const getProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { categorySelect, categoryJoin } = await getCategorySqlParts();
        const newUntilOk = await detectProductNewUntilSchema();
        const esNuevoExpr = newUntilOk
            ? `CASE
                WHEN COALESCE(p.es_nuevo, false) = false THEN false
                WHEN p.nuevo_hasta IS NULL THEN true
                WHEN p.nuevo_hasta >= NOW() THEN true
                ELSE false
               END AS es_nuevo`
            : 'COALESCE(p.es_nuevo, false) AS es_nuevo';

        const slugOk = await detectSlugSchema();
        const slugSelect = slugOk ? 'p.slug, ' : '';
        const extraSelect = newUntilOk ? ', p.nuevo_hasta' : '';

        const [rows] = await pool.query<any[]>(
            `SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.descripcion AS description, p.descripcion,
                    p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                    p.unidades_vendidas AS soldCount, p.unidades_vendidas, p.imagen_url AS imageUrl, p.imagen_url,
                    p.imagen_url_2 AS imageUrl2, p.imagen_url_2, p.imagen_url_3 AS imageUrl3, p.imagen_url_3,
                    ${esNuevoExpr}${extraSelect}, p.creado_en
             FROM productos p
             ${categoryJoin}
             ORDER BY p.creado_en DESC`
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
};

// 2.b Obtener catálogo público con promociones activas
export const getPublicCatalog = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as any;
        const userId: string | null = authReq?.user?.id || null;

        let userSegment: string | null = null;
        if (userId) {
            try {
                const [uRows] = await pool.query<any[]>(
                    'SELECT segmento FROM usuarios WHERE id = ?',
                    [userId]
                );
                userSegment = uRows?.[0]?.segmento || null;
            } catch {
                userSegment = null;
            }
        }

        const assignmentReady = await detectPromotionAssignmentSchema();
        const genderReady = await detectPromotionGenderSchema();
        const newUntilOk = await detectProductNewUntilSchema();

        const esNuevoExpr = newUntilOk
            ? `CASE
                WHEN COALESCE(p.es_nuevo, false) = false THEN false
                WHEN p.nuevo_hasta IS NULL THEN true
                WHEN p.nuevo_hasta >= NOW() THEN true
                ELSE false
               END AS es_nuevo`
            : 'COALESCE(p.es_nuevo, false) AS es_nuevo';

        const { categorySelect, categoryJoin } = await getCategorySqlParts();
        const { advancedReady } = await getPromotionAdvancedSqlParts();
        const slugOk = await detectSlugSchema();
        const slugSelect = slugOk ? 'p.slug, ' : '';

        // 1. Fetch all products
        const [pRows] = await pool.query<any[]>(
            `SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.descripcion AS description, p.descripcion,
                    p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                    p.unidades_vendidas AS soldCount, p.unidades_vendidas, p.imagen_url AS imageUrl, p.imagen_url, p.promocion_id,
                    ${esNuevoExpr}, p.creado_en
             FROM productos p
             ${categoryJoin}
             WHERE p.stock > 0
             ORDER BY p.creado_en DESC`
        );

        // 2. Fetch all active promotions for the current date
        const [promoRows] = await pool.query<any[]>(
            `SELECT pr.id, pr.nombre, pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : "'PERCENT' AS discount_type, 0 AS amount_discount, 0 AS priority,"}
                    pr.product_scope, pr.product_gender, pr.audience_scope, pr.audience_segment
             FROM promociones pr
             WHERE pr.activo = true
               AND pr.fecha_inicio <= NOW()
               AND pr.fecha_fin >= NOW()
               AND (
                 ${advancedReady 
                    ? "(pr.discount_type = 'AMOUNT' AND pr.amount_discount > 0) OR (pr.discount_type <> 'AMOUNT' AND pr.porcentaje_descuento > 0)"
                    : 'pr.porcentaje_descuento > 0'}
               )`
        );

        // 3. Fetch specific mappings if needed
        const [ppRows] = await pool.query<any[]>('SELECT promocion_id, producto_id FROM promocionproductos');
        const [puRows] = userId ? await pool.query<any[]>('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];

        const ppMap: Record<string, Set<string>> = {};
        ppRows.forEach(r => {
            if (!ppMap[r.promocion_id]) ppMap[r.promocion_id] = new Set();
            ppMap[r.promocion_id].add(r.producto_id);
        });
        const userPromos = new Set(puRows.map(r => r.promocion_id));

        // 4. Match and apply logic in JS (Robust across MySQL versions)
        const products = pRows.map(p => {
            let bestPromo: any = null;
            let maxMontoDescuento = 0;

            promoRows.forEach(pr => {
                // Product Scope check
                let productMatch = false;
                if (pr.product_scope === 'GLOBAL') productMatch = true;
                else if (pr.product_scope === 'SPECIFIC' && ppMap[pr.id]?.has(p.id)) productMatch = true;
                else if (pr.product_scope === 'GENDER' && pr.product_gender && p.genero === pr.product_gender) productMatch = true;
                else if (pr.id === p.promocion_id) productMatch = true;

                if (!productMatch) return;

                // Audience Scope check
                let audienceMatch = false;
                if (pr.audience_scope === 'ALL') audienceMatch = true;
                else if (pr.audience_scope === 'SEGMENT' && userSegment && pr.audience_segment === userSegment) audienceMatch = true;
                else if (pr.audience_scope === 'CUSTOMERS' && userPromos.has(pr.id)) audienceMatch = true;

                if (!audienceMatch) return;

                // Calculate discount
                let monto = 0;
                if (pr.discount_type === 'AMOUNT') {
                    monto = Math.min(Number(pr.amount_discount || 0), p.precio);
                } else {
                    monto = p.precio * (Number(pr.porcentaje_descuento || 0) / 100);
                }

                // Pick best (Priority > Amount > Percentage)
                if (!bestPromo || 
                    pr.priority > bestPromo.priority || 
                    (pr.priority === bestPromo.priority && monto > maxMontoDescuento) ||
                    (pr.priority === bestPromo.priority && monto === maxMontoDescuento && pr.porcentaje_descuento > bestPromo.porcentaje_descuento)) {
                    bestPromo = pr;
                    maxMontoDescuento = monto;
                }
            });

            const hasOffer = bestPromo !== null && maxMontoDescuento > 0;
            return {
                ...p,
                promo_id: hasOffer ? bestPromo.id : null,
                promo_nombre: hasOffer ? bestPromo.nombre : null,
                porcentaje_descuento: hasOffer ? bestPromo.porcentaje_descuento : null,
                discount_type: hasOffer ? bestPromo.discount_type : null,
                amount_discount: hasOffer ? bestPromo.amount_discount : null,
                priority: hasOffer ? bestPromo.priority : null,
                monto_descuento: hasOffer ? maxMontoDescuento : 0,
                precio_con_descuento: hasOffer ? Math.round((p.precio - maxMontoDescuento) * 100) / 100 : null,
                precio_original: p.precio,
                tiene_promocion: hasOffer
            };
        });

        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching public catalog:', error);
        res.status(500).json({ error: 'Error al cargar el catálogo de productos' });
    }
};

// 2.c Obtener productos mas nuevos (home)
export const getNewestProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as any;
        const userId: string | null = authReq?.user?.id || null;

        let userSegment: string | null = null;
        if (userId) {
            try {
                const [uRows] = await pool.query<any[]>(
                    'SELECT segmento FROM usuarios WHERE id = ?',
                    [userId]
                );
                userSegment = uRows?.[0]?.segmento || null;
            } catch {
                userSegment = null;
            }
        }

        const limitRaw = req.query['limit'];
        const limit = Math.min(Math.max(Number(limitRaw || 8) || 8, 1), 50);

        const { advancedReady } = await getPromotionAdvancedSqlParts();
        const newUntilOk = await detectProductNewUntilSchema();

        const esNuevoExpr = newUntilOk
            ? `CASE
                WHEN COALESCE(p.es_nuevo, false) = false THEN false
                WHEN p.nuevo_hasta IS NULL THEN true
                WHEN p.nuevo_hasta >= NOW() THEN true
                ELSE false
               END AS es_nuevo`
            : 'COALESCE(p.es_nuevo, false) AS es_nuevo';

        const { categorySelect, categoryJoin } = await getCategorySqlParts();

        let rows: any[] = [];

        // 1. Fetch newest products
        const [pRows] = await pool.query<any[]>(
            `SELECT p.id, p.nombre AS name, p.nombre, p.slug, p.genero${categorySelect}, p.notas_olfativas AS notes, p.notas_olfativas, 
                    p.precio AS price, p.precio, p.stock, p.unidades_vendidas AS soldCount, p.unidades_vendidas,
                    p.imagen_url AS imageUrl, p.imagen_url, p.promocion_id,
                    ${esNuevoExpr}, p.creado_en
             FROM productos p
             ${categoryJoin}
             WHERE p.stock > 0
             ORDER BY p.creado_en DESC
             LIMIT ?`,
            [limit * 2]
        );

        // 2. Fetch all active promotions
        const [promoRows] = await pool.query<any[]>(
            `SELECT pr.id, pr.nombre, pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : "'PERCENT' AS discount_type, 0 AS amount_discount, 0 AS priority,"}
                    pr.product_scope, pr.product_gender, pr.audience_scope, pr.audience_segment
             FROM promociones pr
             WHERE pr.activo = true
               AND pr.fecha_inicio <= NOW()
               AND pr.fecha_fin >= NOW()`
        );

        const [ppRows] = await pool.query<any[]>('SELECT promocion_id, producto_id FROM promocionproductos');
        const [puRows] = userId ? await pool.query<any[]>('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];

        const ppMap: Record<string, Set<string>> = {};
        ppRows.forEach(r => {
            if (!ppMap[r.promocion_id]) ppMap[r.promocion_id] = new Set();
            ppMap[r.promocion_id].add(r.producto_id);
        });
        const userPromos = new Set(puRows.map((r: any) => r.promocion_id));

        // 3. Match logic in JS
        rows = pRows.map(p => {
            let bestPromo: any = null;
            let maxMontoDescuento = 0;

            promoRows.forEach(pr => {
                let productMatch = false;
                if (pr.product_scope === 'GLOBAL') productMatch = true;
                else if (pr.product_scope === 'SPECIFIC' && ppMap[pr.id]?.has(p.id)) productMatch = true;
                else if (pr.product_scope === 'GENDER' && pr.product_gender && p.genero === pr.product_gender) productMatch = true;
                else if (pr.id === p.promocion_id) productMatch = true;

                if (!productMatch) return;

                let audienceMatch = false;
                if (pr.audience_scope === 'ALL') audienceMatch = true;
                else if (pr.audience_scope === 'SEGMENT' && userSegment && pr.audience_segment === userSegment) audienceMatch = true;
                else if (pr.audience_scope === 'CUSTOMERS' && userPromos.has(pr.id)) audienceMatch = true;

                if (!audienceMatch) return;

                let monto = 0;
                if (pr.discount_type === 'AMOUNT') {
                    monto = Math.min(Number(pr.amount_discount || 0), p.precio);
                } else {
                    monto = p.precio * (Number(pr.porcentaje_descuento || 0) / 100);
                }

                if (!bestPromo || 
                    pr.priority > bestPromo.priority || 
                    (pr.priority === bestPromo.priority && monto > maxMontoDescuento)) {
                    bestPromo = pr;
                    maxMontoDescuento = monto;
                }
            });

            const hasOffer = bestPromo !== null && maxMontoDescuento > 0;
            return {
                ...p,
                promo_id: hasOffer ? bestPromo.id : null,
                promo_nombre: hasOffer ? bestPromo.nombre : null,
                porcentaje_descuento: hasOffer ? bestPromo.porcentaje_descuento : null,
                discount_type: hasOffer ? bestPromo.discount_type : null,
                amount_discount: hasOffer ? bestPromo.amount_discount : null,
                priority: hasOffer ? bestPromo.priority : null,
                monto_descuento: hasOffer ? maxMontoDescuento : 0,
                precio_con_descuento: hasOffer ? Math.round((p.precio - maxMontoDescuento) * 100) / 100 : null,
                precio_original: p.precio,
                tiene_promocion: hasOffer
            };
        }).slice(0, limit);

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching newest products:', error);
        res.status(500).json({ error: 'Error al cargar productos nuevos' });
    }
};

// 3. Obtener un producto por ID
export const getProductById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const authReq = req as any;
        const userId: string | null = authReq?.user?.id || null;

        let userSegment: string | null = null;
        if (userId) {
            try {
                const [uRows] = await pool.query<any[]>(
                    'SELECT segmento FROM usuarios WHERE id = ?',
                    [userId]
                );
                userSegment = uRows?.[0]?.segmento || null;
            } catch {
                userSegment = null;
            }
        }

        const advancedParts = await getPromotionAdvancedSqlParts();
        const advancedReady = advancedParts.advancedReady;
        const newUntilOk = await detectProductNewUntilSchema();

        const esNuevoExpr = newUntilOk
            ? `CASE
                WHEN COALESCE(p.es_nuevo, false) = false THEN false
                WHEN p.nuevo_hasta IS NULL THEN true
                WHEN p.nuevo_hasta >= NOW() THEN true
                ELSE false
               END AS es_nuevo`
            : 'COALESCE(p.es_nuevo, false) AS es_nuevo';
        const { categorySelect, categoryJoin } = await getCategorySqlParts();

        const slugOk = await detectSlugSchema();
        const slugSelect = slugOk ? 'p.slug, ' : '';
        const whereClause = slugOk ? 'WHERE p.id = ? OR p.slug = ?' : 'WHERE p.id = ?';
        const queryParams = slugOk ? [id, id] : [id];

        // 1. Fetch product
        const [pRows] = await pool.query<any[]>(
            `SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.descripcion AS description, p.descripcion,
                    p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                    p.unidades_vendidas AS soldCount, p.unidades_vendidas, p.imagen_url AS imageUrl, p.imagen_url,
                    p.imagen_url_2 AS imageUrl2, p.imagen_url_2, p.imagen_url_3 AS imageUrl3, p.imagen_url_3,
                    p.promocion_id, ${esNuevoExpr}, p.creado_en
             FROM productos p
             ${categoryJoin}
             ${whereClause}`,
            queryParams
        );

        if (!pRows || pRows.length === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }

        const p = pRows[0];

        // 2. Fetch all active promotions
        const [promoRows] = await pool.query<any[]>(
            `SELECT pr.id, pr.nombre, pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : "'PERCENT' AS discount_type, 0 AS amount_discount, 0 AS priority,"}
                    pr.product_scope, pr.product_gender, pr.audience_scope, pr.audience_segment
             FROM promociones pr
             WHERE pr.activo = true
               AND pr.fecha_inicio <= NOW()
               AND pr.fecha_fin >= NOW()`
        );

        const [ppRows] = await pool.query<any[]>('SELECT promocion_id, producto_id FROM promocionproductos WHERE producto_id = ?', [id]);
        const [puRows] = userId ? await pool.query<any[]>('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];

        const hasSpecificPromo = ppRows.some(r => r.producto_id === id);
        const userPromos = new Set(puRows.map(r => r.promocion_id));

        // 3. Match logic in JS
        let bestPromo: any = null;
        let maxMontoDescuento = 0;

        promoRows.forEach(pr => {
            let productMatch = false;
            if (pr.product_scope === 'GLOBAL') productMatch = true;
            else if (pr.product_scope === 'SPECIFIC' && hasSpecificPromo && ppRows.some(r => r.promocion_id === pr.id)) productMatch = true;
            else if (pr.product_scope === 'GENDER' && pr.product_gender && p.genero === pr.product_gender) productMatch = true;
            else if (pr.id === p.promocion_id) productMatch = true;

            if (!productMatch) return;

            let audienceMatch = false;
            if (pr.audience_scope === 'ALL') audienceMatch = true;
            else if (pr.audience_scope === 'SEGMENT' && userSegment && pr.audience_segment === userSegment) audienceMatch = true;
            else if (pr.audience_scope === 'CUSTOMERS' && userPromos.has(pr.id)) audienceMatch = true;

            if (!audienceMatch) return;

            let monto = 0;
            if (pr.discount_type === 'AMOUNT') {
                monto = Math.min(Number(pr.amount_discount || 0), p.precio);
            } else {
                monto = p.precio * (Number(pr.porcentaje_descuento || 0) / 100);
            }

            if (!bestPromo || 
                pr.priority > bestPromo.priority || 
                (pr.priority === bestPromo.priority && monto > maxMontoDescuento)) {
                bestPromo = pr;
                maxMontoDescuento = monto;
            }
        });

        const hasOffer = bestPromo !== null && maxMontoDescuento > 0;
        res.status(200).json({
            ...p,
            promo_id: hasOffer ? bestPromo.id : null,
            promo_nombre: hasOffer ? bestPromo.nombre : null,
            porcentaje_descuento: hasOffer ? bestPromo.porcentaje_descuento : null,
            discount_type: hasOffer ? bestPromo.discount_type : null,
            amount_discount: hasOffer ? bestPromo.amount_discount : null,
            priority: hasOffer ? bestPromo.priority : null,
            monto_descuento: hasOffer ? maxMontoDescuento : 0,
            precio_con_descuento: hasOffer ? Math.round((p.precio - maxMontoDescuento) * 100) / 100 : null,
            precio_original: p.precio,
            tiene_promocion: hasOffer
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Error al obtener producto' });
    }
};

export const getRelatedProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const authReq = req as any;
        const userId: string | null = authReq?.user?.id || null;

        let userSegment: string | null = null;
        if (userId) {
            try {
                const [uRows] = await pool.query<any[]>(
                    'SELECT segmento FROM usuarios WHERE id = ?',
                    [userId]
                );
                userSegment = uRows?.[0]?.segmento || null;
            } catch {
                userSegment = null;
            }
        }

        const limitRaw = (req.query as any)?.limit;
        const limitNum = Number(limitRaw ?? 4);
        const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(12, Math.trunc(limitNum))) : 4;

        const advancedParts = await getPromotionAdvancedSqlParts();
        const advancedReady = advancedParts.advancedReady;
        const newUntilOk = await detectProductNewUntilSchema();

        const esNuevoExpr = newUntilOk
            ? `CASE
                WHEN COALESCE(p.es_nuevo, false) = false THEN false
                WHEN p.nuevo_hasta IS NULL THEN true
                WHEN p.nuevo_hasta >= NOW() THEN true
                ELSE false
               END AS es_nuevo`
            : 'COALESCE(p.es_nuevo, false) AS es_nuevo';

        const { categorySelect, categoryJoin } = await getCategorySqlParts();

        // 1. Base genero
        const [gRows] = await pool.query<any[]>(
            'SELECT genero FROM productos WHERE id = ? LIMIT 1',
            [id]
        );
        const genero = gRows?.[0]?.genero;
        if (!genero) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }

        // 2. Fetch related products
        const [pRows] = await pool.query<any[]>(
            `SELECT p.id, p.nombre AS name, p.nombre, p.slug, p.genero${categorySelect}, p.notas_olfativas AS notes, p.notas_olfativas, 
                    p.precio AS price, p.precio, p.stock, p.imagen_url AS imageUrl, p.imagen_url, p.promocion_id,
                    ${esNuevoExpr}, p.creado_en, p.unidades_vendidas AS soldCount, p.unidades_vendidas
             FROM productos p
             ${categoryJoin}
             WHERE p.id <> ?
               AND p.genero = ?
               AND p.stock > 0
             ORDER BY p.unidades_vendidas DESC, p.creado_en DESC
             LIMIT ?`,
            [id, genero, limit]
        );

        if (!pRows || pRows.length === 0) {
            res.status(200).json([]);
            return;
        }

        // 3. Fetch all active promotions
        const [promoRows] = await pool.query<any[]>(
            `SELECT pr.id, pr.nombre, pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : "'PERCENT' AS discount_type, 0 AS amount_discount, 0 AS priority,"}
                    pr.product_scope, pr.product_gender, pr.audience_scope, pr.audience_segment
             FROM promociones pr
             WHERE pr.activo = true
               AND pr.fecha_inicio <= NOW()
               AND pr.fecha_fin >= NOW()`
        );

        const [ppRows] = await pool.query<any[]>('SELECT promocion_id, producto_id FROM promocionproductos');
        const [puRows] = userId ? await pool.query<any[]>('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];

        const ppMap: Record<string, Set<string>> = {};
        ppRows.forEach(r => {
            if (!ppMap[r.promocion_id]) ppMap[r.promocion_id] = new Set();
            ppMap[r.promocion_id].add(r.producto_id);
        });

        const userPromos = new Set(puRows.map(r => r.promocion_id));

        // 4. Match in JS
        const products = pRows.map(p => {
            let bestPromo: any = null;
            let maxMontoDescuento = 0;

            promoRows.forEach(pr => {
                let productMatch = false;
                if (pr.product_scope === 'GLOBAL') productMatch = true;
                else if (pr.product_scope === 'SPECIFIC' && ppMap[pr.id]?.has(p.id)) productMatch = true;
                else if (pr.product_scope === 'GENDER' && pr.product_gender && p.genero === pr.product_gender) productMatch = true;
                else if (pr.id === p.promocion_id) productMatch = true;

                if (!productMatch) return;

                let audienceMatch = false;
                if (pr.audience_scope === 'ALL') audienceMatch = true;
                else if (pr.audience_scope === 'SEGMENT' && userSegment && pr.audience_segment === userSegment) audienceMatch = true;
                else if (pr.audience_scope === 'CUSTOMERS' && userPromos.has(pr.id)) audienceMatch = true;

                if (!audienceMatch) return;

                let monto = 0;
                if (pr.discount_type === 'AMOUNT') {
                    monto = Math.min(Number(pr.amount_discount || 0), p.precio);
                } else {
                    monto = p.precio * (Number(pr.porcentaje_descuento || 0) / 100);
                }

                if (!bestPromo || 
                    pr.priority > bestPromo.priority || 
                    (pr.priority === bestPromo.priority && monto > maxMontoDescuento)) {
                    bestPromo = pr;
                    maxMontoDescuento = monto;
                }
            });

            const hasOffer = bestPromo !== null && maxMontoDescuento > 0;
            return {
                ...p,
                promo_id: hasOffer ? bestPromo.id : null,
                promo_nombre: hasOffer ? bestPromo.nombre : null,
                porcentaje_descuento: hasOffer ? bestPromo.porcentaje_descuento : null,
                discount_type: hasOffer ? bestPromo.discount_type : null,
                amount_discount: hasOffer ? bestPromo.amount_discount : null,
                priority: hasOffer ? bestPromo.priority : null,
                monto_descuento: hasOffer ? maxMontoDescuento : 0,
                precio_con_descuento: hasOffer ? Math.round((p.precio - maxMontoDescuento) * 100) / 100 : null,
                precio_original: p.precio,
                tiene_promocion: hasOffer
            };
        });

        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching related products:', error);
        res.status(500).json({ error: 'Error al obtener productos relacionados' });
    }
};

// 4. Actualizar producto (y manejar posible nueva imagen)
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { nombre, genero, descripcion, notas_olfativas, notas, precio, stock, es_nuevo, nuevo_hasta } = req.body;

        const hasValue = (val: any) => val !== undefined && val !== null && val !== '';
        const notasFinal = hasValue(notas_olfativas) ? notas_olfativas : (hasValue(notas) ? notas : undefined);

        let imagen_url: string | undefined;

        if (req.file) {
            const uniqueFilename = sanitizeFilename(req.file.originalname);
            const { data, error } = await supabase.storage
                .from('perfumissimo_bucket')
                .upload(`products/${uniqueFilename}`, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: true
                });

            if (error) throw new Error('Error subiendo imagen de producto a Supabase: ' + error.message);

            const { data: publicData } = supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(`products/${uniqueFilename}`);

            imagen_url = publicData.publicUrl;
        }

        const updates: string[] = [];
        const params: any[] = [];

        const categoriesOk = await detectCategoriesSchema();
        const newUntilOk = await detectProductNewUntilSchema();

        if (hasValue(nombre)) { 
            updates.push('nombre = ?'); 
            params.push(nombre); 
            updates.push('slug = ?');
            params.push(generateSlug(nombre));
        }
        if (hasValue(genero)) {
            const generoNormalized = normalizeCategorySlug(genero);
            if (!generoNormalized) {
                res.status(400).json({ error: 'Categoria invalida' });
                return;
            }
            if (categoriesOk) {
                const exists = await ensureCategoryExists(generoNormalized);
                if (!exists) {
                    res.status(400).json({ error: 'Categoria invalida. Crea la categoria primero en Admin > Categorias.' });
                    return;
                }
            }
            updates.push('genero = ?');
            params.push(generoNormalized);
        }
        if (hasValue(descripcion)) { updates.push('descripcion = ?'); params.push(descripcion); }
        if (notasFinal !== undefined) { updates.push('notas_olfativas = ?'); params.push(notasFinal); }
        if (precio !== undefined && precio !== '') { updates.push('precio = ?'); params.push(Number(precio)); }
        if (stock !== undefined && stock !== '') { updates.push('stock = ?'); params.push(Number(stock)); }
        if (es_nuevo !== undefined) { updates.push('es_nuevo = ?'); params.push(!!es_nuevo); }

        const nuevoHastaParsed = parseNuevoHastaInput(nuevo_hasta);
        if (nuevoHastaParsed !== undefined) {
            if (!newUntilOk) {
                res.status(400).json({
                    error: 'Tu base de datos no soporta expiración de etiqueta NUEVO. Ejecuta database/migrations/20260312_products_new_badge_expiration.sql en Supabase y vuelve a intentar.'
                });
                return;
            }
            updates.push('nuevo_hasta = ?');
            params.push(nuevoHastaParsed);
        }
        if (imagen_url) { updates.push('imagen_url = ?'); params.push(imagen_url); }

        if (updates.length === 0) {
            res.status(400).json({ error: 'No hay campos para actualizar' });
            return;
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        if (files?.['imagen']?.[0]) {
            const url = await uploadToSupabase(files['imagen'][0]);
            updates.push('imagen_url = ?');
            params.push(url);
        }
        if (files?.['imagen2']?.[0]) {
            const url = await uploadToSupabase(files['imagen2'][0]);
            updates.push('imagen_url_2 = ?');
            params.push(url);
        }
        if (files?.['imagen3']?.[0]) {
            const url = await uploadToSupabase(files['imagen3'][0]);
            updates.push('imagen_url_3 = ?');
            params.push(url);
        }
        
        if (updates.length === 0) {
            res.status(200).json({ message: 'Sin cambios aplicados' });
            return;
        }

        const query = `UPDATE productos SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);

        const [result] = await pool.query<any>(query, params);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }

        res.status(200).json({ message: 'Producto actualizado exitosamente' });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Error del servidor al actualizar' });
    }
};

// 5. Eliminar producto
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const [result] = await pool.query<any>(`
            DELETE FROM productos WHERE id = ?
        `, [id]);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }

        res.status(200).json({ message: 'Producto eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
};

const normalizeHeader = (value: unknown): string => {
    const s = String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return s
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
};

const parseGenero = (raw: unknown): 'mujer' | 'hombre' | 'unisex' => {
    const v = normalizeHeader(raw);
    if (!v) return 'unisex';
    if (['mujer', 'female', 'f', 'para_mujer', 'woman', 'women'].includes(v)) return 'mujer';
    if (['hombre', 'male', 'm', 'para_hombre', 'man', 'men'].includes(v)) return 'hombre';
    if (['unisex', 'u', 'uni'].includes(v)) return 'unisex';
    return 'unisex';
};

const slugifyCategory = (name: string): string => {
    return String(name || '')
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120);
};

const parseCategorySlugFromImport = (
    raw: unknown,
    categoriesOk: boolean,
    validCategorySlugs: Set<string>
): { slug: string | null; error?: string } => {
    const rawStr = String(raw ?? '').trim();

    if (!rawStr) {
        if (categoriesOk && validCategorySlugs.size > 0 && !validCategorySlugs.has('unisex')) {
            return { slug: null, error: 'Categoria es requerida (no existe categoria "unisex")' };
        }
        return { slug: 'unisex' };
    }

    // 1) Si ya viene un slug
    const normalized = normalizeCategorySlug(rawStr);
    if (normalized && (!categoriesOk || validCategorySlugs.has(normalized))) {
        return { slug: normalized };
    }

    // 2) Intentar mapear "genero" clasico
    const gender = parseGenero(rawStr);
    if (!categoriesOk || validCategorySlugs.has(gender)) {
        return { slug: gender };
    }

    // 3) Intentar slugify de nombre
    const slug = slugifyCategory(rawStr);
    if (slug && validCategorySlugs.has(slug)) {
        return { slug };
    }

    return { slug: null, error: `Categoria no existe: ${rawStr}` };
};

const parseNumberFlexible = (raw: unknown): number | null => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

    const s0 = String(raw).trim();
    if (!s0) return null;

    // Remove currency symbols and spaces
    let s = s0.replace(/[^0-9,.-]/g, '');

    // Decide decimal separator when both are present
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');
        if (lastComma > lastDot) {
            // 1.234,56 -> 1234.56
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            // 1,234.56 -> 1234.56
            s = s.replace(/,/g, '');
        }
    } else if (hasComma && !hasDot) {
        // 1234,56 -> 1234.56
        s = s.replace(',', '.');
    } else {
        // Keep dots as decimal separator
    }

    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
};

const getRowValue = (row: Record<string, any>, keys: string[]): any => {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
    }
    return undefined;
};

export const downloadProductImportTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const header = [
            'nombre',
            // slug de categoria (ej: mujer, hombre, unisex)
            'categoria',
            'notas_olfativas',
            'descripcion',
            'precio',
            'stock',
            'imagen_url',
            'unidades_vendidas',
            'es_nuevo'
        ];
        const example = [
            'Aqua di Roma',
            'unisex',
            'Bergamota, Cedro, Ambar',
            'Fragancia fresca y elegante. Notas: Bergamota, Cedro, Ambar',
            159900,
            25,
            'https://tusitio.com/imagen.jpg',
            0,
            'TRUE'
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([header, example]);
        XLSX.utils.book_append_sheet(wb, ws, 'Productos');

        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="plantilla_productos.xlsx"');
        res.status(200).send(buffer);
    } catch (error) {
        console.error('Error generating import template:', error);
        res.status(500).json({ error: 'Error al generar la plantilla' });
    }
};

export const importProductsFromSpreadsheet = async (req: Request, res: Response): Promise<void> => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
        res.status(400).json({ error: 'Debes subir un archivo en el campo "archivo" (.xlsx o .csv)' });
        return;
    }

    const dryRun = String((req.query as any)?.dry_run || '').toLowerCase() === 'true';

    try {
        const categoriesSchemaOk = await detectCategoriesSchema();
        const validSlugs = new Set<string>();
        if (categoriesSchemaOk) {
            try {
                const [cRows] = await pool.query<any[]>('SELECT slug FROM categorias');
                for (const r of (cRows || [])) {
                    const s = String(r?.slug || '').trim().toLowerCase();
                    if (s) validSlugs.add(s);
                }
            } catch {
                // ignore
            }
        }

        if (categoriesSchemaOk && validSlugs.size === 0) {
            res.status(400).json({
                error: 'Tu base de datos soporta categorias, pero no hay categorias creadas. Crea al menos una categoria en Admin > Categorias antes de importar.'
            });
            return;
        }

        const categoriesOk = categoriesSchemaOk && validSlugs.size > 0;

        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            res.status(400).json({ error: 'El archivo no tiene hojas para importar' });
            return;
        }

        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
            res.status(400).json({ error: 'La hoja está vacía' });
            return;
        }

        // Normalize headers
        const rows = rawRows.map((r) => {
            const out: Record<string, any> = {};
            for (const [k, v] of Object.entries(r)) {
                out[normalizeHeader(k)] = v;
            }
            return out;
        });

        if (rows.length > 2000) {
            res.status(400).json({ error: 'El archivo tiene demasiadas filas (max 2000)' });
            return;
        }

        const errors: Array<{ row: number; field?: string; message: string }> = [];
        const toInsert: Array<{
            id: string;
            nombre: string;
            genero: string;
            descripcion: string;
            notas_olfativas: string | null;
            precio: number;
            stock: number;
            unidades_vendidas: number;
            imagen_url: string | null;
            es_nuevo: boolean;
        }> = [];

        let skipped = 0;

        for (let i = 0; i < rows.length; i++) {
            const excelRow = i + 2; // header row is 1
            const r = rows[i];

            const nombreRaw = getRowValue(r, ['nombre', 'name', 'producto', 'producto_nombre']);
            const precioRaw = getRowValue(r, ['precio', 'price', 'valor']);
            const descripcionRaw = getRowValue(r, ['descripcion', 'description', 'desc', 'descrip']);
            const notasRaw = getRowValue(r, ['notas_olfativas', 'notas', 'notes', 'notasolfativas']);
            const generoRaw = getRowValue(r, ['genero', 'gender']);
            const categoriaRaw = getRowValue(r, ['categoria', 'category', 'categoria_slug']);
            const stockRaw = getRowValue(r, ['stock', 'inventario', 'cantidad']);
            const imagenRaw = getRowValue(r, ['imagen_url', 'image_url', 'imagen', 'image', 'url_imagen', 'imageurl']);
            const vendidasRaw = getRowValue(r, ['unidades_vendidas', 'vendidas', 'ventas', 'unidades']);
            const nuevoRaw = getRowValue(r, ['es_nuevo', 'nuevo', 'is_new', 'new']);

            const nombre = String(nombreRaw ?? '').trim();
            const precioN = parseNumberFlexible(precioRaw);

            const allEmpty = !nombre && (precioN === null) && !String(descripcionRaw ?? '').trim() && !String(notasRaw ?? '').trim() && !String(imagenRaw ?? '').trim();
            if (allEmpty) {
                skipped++;
                continue;
            }

            if (!nombre || nombre.length < 2) {
                errors.push({ row: excelRow, field: 'nombre', message: 'Nombre es requerido (min 2 caracteres)' });
                continue;
            }

            if (precioN === null || precioN < 0) {
                errors.push({ row: excelRow, field: 'precio', message: 'Precio es requerido y debe ser un numero >= 0' });
                continue;
            }

            const notas = String(notasRaw ?? '').trim();
            let descripcion = String(descripcionRaw ?? '').trim();
            if (!descripcion && notas) {
                descripcion = `Notas: ${notas}`;
            }
            if (!descripcion || descripcion.length < 10) {
                errors.push({ row: excelRow, field: 'descripcion', message: 'Descripcion es requerida (min 10 caracteres)' });
                continue;
            }

            const parsed = parseCategorySlugFromImport(
                categoriaRaw !== undefined ? categoriaRaw : generoRaw,
                categoriesOk,
                validSlugs
            );
            if (!parsed.slug) {
                errors.push({ row: excelRow, field: 'categoria', message: parsed.error || 'Categoria invalida' });
                continue;
            }
            const genero = parsed.slug;
            const stockN = parseNumberFlexible(stockRaw);
            const vendidasN = parseNumberFlexible(vendidasRaw);

            const stock = stockN === null ? 0 : Math.max(0, Math.trunc(stockN));
            const unidades_vendidas = vendidasN === null ? 0 : Math.max(0, Math.trunc(vendidasN));
            const imagen_url = String(imagenRaw ?? '').trim() || null;
            const es_nuevo = String(nuevoRaw ?? '').toLowerCase() === 'true' || nuevoRaw === 1 || nuevoRaw === true;

            toInsert.push({
                id: uuidv4(),
                nombre,
                genero,
                descripcion,
                notas_olfativas: notas || null,
                precio: precioN,
                stock,
                unidades_vendidas,
                imagen_url,
                es_nuevo
            });
        }

        if (toInsert.length === 0) {
            res.status(400).json({ error: 'No se encontraron filas validas para importar', skipped, failed: errors.length, errors });
            return;
        }

        if (dryRun) {
            res.status(200).json({ dry_run: true, total_rows: rows.length, to_create: toInsert.length, skipped, failed: errors.length, errors });
            return;
        }

        const connection = await pool.getConnection();
        try {
            await connection.query('BEGIN');
            for (const p of toInsert) {
                await connection.query(
                    `INSERT INTO productos (id, nombre, genero, descripcion, notas_olfativas, precio, stock, unidades_vendidas, imagen_url, es_nuevo)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [p.id, p.nombre, p.genero, p.descripcion, p.notas_olfativas, p.precio, p.stock, p.unidades_vendidas, p.imagen_url, p.es_nuevo]
                );
            }
            await connection.query('COMMIT');
        } catch (e) {
            await connection.query('ROLLBACK');
            throw e;
        } finally {
            connection.release();
        }

        res.status(201).json({ created: toInsert.length, skipped, failed: errors.length, errors });
    } catch (error: any) {
        console.error('Error importing products from spreadsheet:', error);
        res.status(500).json({ error: 'Error al importar productos', details: error?.message || String(error) });
    }
};

export const getLowStockProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const thresholdRaw = (req.query as any)?.threshold;
        const thresholdNum = Number(thresholdRaw ?? 5);
        const threshold = Number.isFinite(thresholdNum) ? Math.max(0, Math.min(1000, Math.trunc(thresholdNum))) : 5;
        const limitRaw = (req.query as any)?.limit;
        const limitNum = Number(limitRaw ?? 20);
        const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(100, Math.trunc(limitNum))) : 20;

        const [countRows] = await pool.query<any[]>(
            `SELECT CAST(COUNT(*) AS SIGNED) AS count
             FROM productos
             WHERE COALESCE(stock, 0) <= ?`,
            [threshold]
        );

        const [rows] = await pool.query<any[]>(
            `SELECT id, nombre, stock, imagen_url
             FROM productos
             WHERE COALESCE(stock, 0) <= ?
             ORDER BY COALESCE(stock, 0) ASC, nombre ASC
             LIMIT ?`,
            [threshold, limit]
        );

        res.status(200).json({
            threshold,
            count: Number(countRows?.[0]?.count || 0),
            items: rows || []
        });
    } catch (error) {
        console.error('Error fetching low stock products:', error);
        res.status(500).json({ error: 'Error al obtener productos con bajo stock' });
    }
};
