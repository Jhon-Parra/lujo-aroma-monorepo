import { Request, Response } from 'express';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { refineSearchQuery } from './ai.controller';
import * as XLSX from 'xlsx';

import { appCache, CACHE_KEYS } from '../utils/cache.util';
import { uploadFile, deleteFile } from '../utils/storage.util';


/**
 * Helper to upload a file to Firebase Storage /products/
 */
async function uploadToFirebase(file: Express.Multer.File): Promise<string> {
    return await uploadFile(file, { folder: 'products' });
}

let promotionAssignmentReady: boolean | null = null;
let promotionGenderReady: boolean | null = null;
let promotionAdvancedReady: boolean | null = null;

// Detecta si productos.id es BINARY (UUID) o VARCHAR
let productIdIsBinary: boolean | null = null;
const detectProductIdType = async (): Promise<boolean> => {
    if (productIdIsBinary !== null) return productIdIsBinary;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT DATA_TYPE FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND LOWER(table_name) = 'productos'
               AND LOWER(column_name) = 'id'
             LIMIT 1`
        );
        const dtype = String(rows?.[0]?.DATA_TYPE || '').toLowerCase();
        productIdIsBinary = dtype === 'binary' || dtype === 'varbinary';
    } catch {
        productIdIsBinary = false;
    }
    return productIdIsBinary;
};

const productIdWhereExpr = async (): Promise<string> => {
    const binary = await detectProductIdType();
    return binary ? 'UUID_TO_BIN(?)' : '?';
};

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

    // Evitar JOIN si la columna casa no existe (migración pendiente)
    const casaOk = await detectProductCasaSchema();
    if (!casaOk) return { categorySelect: '', categoryJoin: '' };
    return {
        categorySelect: ', c.nombre AS categoria_nombre, c.slug AS categoria_slug',
        // categorias ahora se usan como "Casa" (marca)
        categoryJoin: 'LEFT JOIN categorias c ON c.slug = p.casa'
    };
};

const normalizeGeneroInput = (raw: any): 'mujer' | 'hombre' | 'unisex' => {
    const v = String(raw ?? '').trim().toLowerCase();
    if (!v) return 'unisex';
    if (['mujer', 'ella', 'dama', 'female', 'woman', 'women'].includes(v)) return 'mujer';
    if (['hombre', 'el', 'caballero', 'male', 'man', 'men'].includes(v)) return 'hombre';
    if (['unisex', 'mix', 'mixto', 'uni'].includes(v)) return 'unisex';
    // fallback seguro
    if (v.includes('muj')) return 'mujer';
    if (v.includes('hom') || v.includes('cab')) return 'hombre';
    return 'unisex';
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

const getProductImagesSql = async (alias: string = 'p'): Promise<string> => {
    const img2 = await detectImage2Schema();
    const img3 = await detectImage3Schema();
    let sql = `${alias}.imagen_url AS imageUrl, ${alias}.imagen_url`;
    if (img2) sql += `, ${alias}.imagen_url_2 AS imageUrl2, ${alias}.imagen_url_2`;
    if (img3) sql += `, ${alias}.imagen_url_3 AS imageUrl3, ${alias}.imagen_url_3`;
    return sql;
};


let productCasaReady: boolean | null = null;
const detectProductCasaSchema = async (): Promise<boolean> => {
    if (productCasaReady === true) return true;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) AS ok
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'productos'
               AND column_name = 'casa'
             LIMIT 1`
        );
        productCasaReady = !!rows?.[0]?.ok;
        return productCasaReady;
    } catch {
        productCasaReady = false;
        return false;
    }
};

let productImg2Ready: boolean | null = null;
const detectImage2Schema = async (): Promise<boolean> => {
    if (productImg2Ready !== null) return productImg2Ready;
    productImg2Ready = await pool.hasColumn('productos', 'imagen_url_2');
    return productImg2Ready;
};

let productImg3Ready: boolean | null = null;
const detectImage3Schema = async (): Promise<boolean> => {
    if (productImg3Ready !== null) return productImg3Ready;
    productImg3Ready = await pool.hasColumn('productos', 'imagen_url_3');
    return productImg3Ready;
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
        const { nombre, genero, casa, descripcion, notas_olfativas, notas, precio, stock, unidades_vendidas, es_nuevo, nuevo_hasta } = req.body;
        const notasFinal = notas_olfativas || notas;

        const newUntilOk = await detectProductNewUntilSchema();
        const casaOk = await detectProductCasaSchema();
        const generoNormalized = normalizeGeneroInput(genero);

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

        const img2Ok = await detectImage2Schema();
        const img3Ok = await detectImage3Schema();
        const slugOk = await detectSlugSchema();

        // 3. Procesar Imágenes (Solo si se subieron archivos nuevos y de forma resiliente)
        try {
            if (files?.['imagen']?.[0]) {
                imagen_url = await uploadToFirebase(files['imagen'][0]);
            }
            if (img2Ok && files?.['imagen2']?.[0]) {
                imagen_url_2 = await uploadToFirebase(files['imagen2'][0]);
            }
            if (img3Ok && files?.['imagen3']?.[0]) {
                imagen_url_3 = await uploadToFirebase(files['imagen3'][0]);
            }
        } catch (fbError: any) {
            console.error('❌ Error crítico en Firebase Storage durante creación:', fbError.message);
            res.status(500).json({ 
                error: 'Error al procesar las imágenes. Firebase Storage no está configurado correctamente.',
                details: [fbError.message]
            });
            return;
        }

        const id = uuidv4();
        const slug = generateSlug(nombre);
        const casaNormalized = normalizeCategorySlug(casa);

        // Convert UUID to BINARY(16) in MySQL logic
        const idExpr = await productIdWhereExpr();
        const cols: string[] = ['id', 'nombre', 'genero', 'descripcion', 'notas_olfativas', 'precio', 'stock', 'unidades_vendidas', 'imagen_url', 'es_nuevo'];
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
            !!es_nuevo
        ];

        if (img2Ok) {
            cols.push('imagen_url_2');
            vals.push(imagen_url_2);
        }
        if (img3Ok) {
            cols.push('imagen_url_3');
            vals.push(imagen_url_3);
        }
        if (casaOk) {
            cols.push('casa');
            vals.push(casaNormalized ? casaNormalized : null);
        }
        if (slugOk) {
            cols.push('slug');
            vals.push(slug);
        }
        if (newUntilOk) {
            cols.push('nuevo_hasta');
            vals.push(nuevoHastaParsed === undefined ? null : nuevoHastaParsed);
        }

        const placeholders = cols.map((c) => c === 'id' ? idExpr : '?').join(', ');
        const query = `INSERT INTO productos (${cols.join(', ')}) VALUES (${placeholders})`;

        await pool.query(query, vals);

        // Bust catalog cache so the new product is visible immediately
        appCache.invalidateByPrefix('catalog:');

        res.status(201).json({
            message: 'Producto creado exitosamente',
            product: { id, nombre, precio, imagen_url }
        });
    } catch (error: any) {
        console.error('Error creating product:', error);
        res.status(500).json({ 
            error: 'Error del servidor al crear producto',
            details: [error.message],
            code: error.code
        });
    }

};

// 2. Obtener todos los productos
export const getProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { categorySelect, categoryJoin } = await getCategorySqlParts();
        const newUntilOk = await detectProductNewUntilSchema();
        const casaOk = await detectProductCasaSchema();
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
        const casaSelect = casaOk ? ', p.casa AS casa, p.casa AS house' : '';
        const imagesSelect = await getProductImagesSql('p');


        const [rows] = await pool.query<any[]>(
            `SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.descripcion AS description, p.descripcion,
                    p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                    p.unidades_vendidas AS soldCount, p.unidades_vendidas, ${imagesSelect},
                    ${esNuevoExpr}${extraSelect}${casaSelect}, p.creado_en
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

        const normalizeSearch = (raw: any): string => {
            const s = String(raw ?? '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            return s.replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
        };

        const normalizeSlug = (raw: any): string | null => {
            const v = String(raw ?? '').trim().toLowerCase();
            if (!v || v === 'todos' || v === 'all' || v === 'null' || v === 'undefined') return null;
            return v;
        };

        const parseGenderFilter = (raw: any): 'mujer' | 'hombre' | 'unisex' | null => {
            const v = String(raw ?? '').trim().toLowerCase();
            if (!v || v === 'all' || v === 'todos') return null;
            if (v === 'mujer' || v === 'hombre' || v === 'unisex') return v;
            return null;
        };

        const qRaw = String(req.query['q'] || '').trim();
        const q = normalizeSearch(qRaw);
        const smart = String(req.query.smart || '').trim() === 'true';

        const tokenizeSearch = (raw: string): string[] => {
            return normalizeSearch(raw)
                .split(' ')
                .map((t) => t.trim())
                .filter((t) => t.length > 1);
        };

        const baseSearchTokens = q ? tokenizeSearch(q) : [];
        let refinedTokens: string[] = [];
        if (smart && q && q.length > 2) {
            try {
                refinedTokens = await refineSearchQuery(qRaw);
            } catch (err) {
                console.error('Error in smart search refinement:', err);
            }
        }
        const refinedSearchTokens = refinedTokens.flatMap((t) => tokenizeSearch(t));
        const searchTokens = Array.from(new Set([...(smart ? baseSearchTokens.concat(refinedSearchTokens) : baseSearchTokens)]))
            .slice(0, 12);

        // Filtros
        const categoryRaw = req.query['category'] ?? req.query['house'];
        const categorySlug = normalizeSlug(categoryRaw);
        let gender = parseGenderFilter(req.query['gender']);
        // Compat: links antiguos usaban category=mujer|hombre|unisex
        if (!gender && (categorySlug === 'mujer' || categorySlug === 'hombre' || categorySlug === 'unisex')) {
            gender = categorySlug;
        }
        const limitRaw = Number(req.query['limit'] || req.query['pageSize'] || 12);
        // En el catálogo por categoría (house) o género, mantenemos el máximo en 12 items por página.
        // Sin filtros (usado por tareas internas como refresh de carrito), permitimos más.
        const maxLimit = (categorySlug || gender) ? 12 : 100;
        const limit = Number.isFinite(limitRaw)
            ? Math.max(1, Math.min(maxLimit, Math.trunc(limitRaw)))
            : 12;
        const targetSmartResults = Math.max(6, limit);
        const pageRaw = Number(req.query['page'] || 1);
        const page = Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(pageRaw)) : 1;
        const offset = (page - 1) * limit;

        // ── Cache: serve anonymous requests from cache (TTL 5 min) ───────────
        let anonCacheKey: string | null = null;
        if (!userId) {
            const houseForKey = categorySlug && categorySlug !== 'mujer' && categorySlug !== 'hombre' && categorySlug !== 'unisex'
                ? categorySlug
                : '';
            anonCacheKey = `${CACHE_KEYS.CATALOG_ANON}:q=${encodeURIComponent(q)}:house=${encodeURIComponent(houseForKey)}:gender=${encodeURIComponent(gender || '')}:page=${page}:limit=${limit}:smart=${smart ? '1' : '0'}`;
            const cached = appCache.get<any>(anonCacheKey);
            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                res.status(200).json(cached);
                return;
            }
        }

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
        const casaOk = await detectProductCasaSchema();

        const house = (categorySlug && categorySlug !== 'mujer' && categorySlug !== 'hombre' && categorySlug !== 'unisex')
            ? categorySlug
            : null;

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
        const casaSelect = casaOk ? ', p.casa AS casa, p.casa AS house' : '';
        const imagesSelect = await getProductImagesSql('p');


        // 1. Fetch total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM productos p WHERE p.stock >= 0';
        const queryParams: any[] = [];

        if (gender) {
            countQuery += ' AND p.genero = ?';
            queryParams.push(gender);
        }
        if (house && casaOk) {
            countQuery += ' AND LOWER(p.casa) = ?';
            queryParams.push(house);
        }
        if (searchTokens.length > 0) {
            const separator = smart ? ' OR ' : ' AND ';
            const searchClauses = searchTokens.map(() => {
                // Incluimos casa en busqueda standard porque el usuario suele escribir Marca + Nombre
                if (!smart) {
                    return casaOk 
                        ? '(p.nombre LIKE ? OR p.casa LIKE ?)'
                        : '(p.nombre LIKE ?)';
                }
                
                return casaOk 
                    ? '(p.nombre LIKE ? OR p.descripcion LIKE ? OR p.casa LIKE ? OR p.notas_olfativas LIKE ?)'
                    : '(p.nombre LIKE ? OR p.descripcion LIKE ? OR p.notas_olfativas LIKE ?)';
            });
            const searchSql = ` AND (${searchClauses.join(separator)})`;
            countQuery += searchSql;
            searchTokens.forEach(t => {
                const tLike = `%${t}%`;
                queryParams.push(tLike); // p.nombre
                if (!smart) {
                    if (casaOk) queryParams.push(tLike); // p.casa
                } else {
                    queryParams.push(tLike, tLike); // descripcion, notas_olfativas
                    if (casaOk) queryParams.push(tLike); // casa
                }
            });
        }
        
        // Debug: Log final query
        if (q) {
            console.log(`[CATALOG SEARCH] SQL Count Query: ${countQuery}`);
            console.log(`[CATALOG SEARCH] Params:`, queryParams);
        }

        const [countRows] = await pool.query<any[]>(countQuery, queryParams);
        let total = countRows?.[0]?.total || 0;

        // 2. Fetch products for the current page
        let productsQuery = `
             SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.descripcion AS description, p.descripcion,
                    p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                    p.unidades_vendidas AS soldCount, p.unidades_vendidas, ${imagesSelect}, p.promocion_id,
                    ${esNuevoExpr}${casaSelect}, p.creado_en
             FROM productos p

             ${categoryJoin}
              WHERE p.stock >= 0
        `;
        const productsParams: any[] = [];

        if (gender) {
            productsQuery += ' AND p.genero = ?';
            productsParams.push(gender);
        }
        if (house && casaOk) {
            productsQuery += ' AND LOWER(p.casa) = ?';
            productsParams.push(house);
        }
        if (searchTokens.length > 0) {
            const separator = smart ? ' OR ' : ' AND ';
            const searchClauses = searchTokens.map(() => {
                if (!smart) {
                    return casaOk 
                        ? '(p.nombre LIKE ? OR p.casa LIKE ?)'
                        : '(p.nombre LIKE ?)';
                }
                
                return casaOk 
                    ? '(p.nombre LIKE ? OR p.descripcion LIKE ? OR p.casa LIKE ? OR p.notas_olfativas LIKE ?)'
                    : '(p.nombre LIKE ? OR p.descripcion LIKE ? OR p.notas_olfativas LIKE ?)';
            });
            productsQuery += ` AND (${searchClauses.join(separator)})`;
            searchTokens.forEach(t => {
                const tLike = `%${t}%`;
                productsParams.push(tLike); // p.nombre
                if (!smart) {
                    if (casaOk) productsParams.push(tLike); // p.casa
                } else {
                    productsParams.push(tLike, tLike); // descripcion, notas_olfativas
                    if (casaOk) productsParams.push(tLike); // casa
                }
            });
        }

        // Debug: Log final query
        if (q) {
            console.log(`[CATALOG SEARCH] SQL Products Query: ${productsQuery}`);
            console.log(`[CATALOG SEARCH] Params:`, productsParams);
        }
        // Stable ordering avoids duplicates/missing items across pages when creado_en ties.
        const finalLimit = limit || 12;
        // Si hay búsqueda, pedimos más para poder rankear y filtrar mejor en JS
        const sqlLimit = q ? 200 : finalLimit;
        
        productsQuery += ` ORDER BY p.creado_en DESC, p.id DESC LIMIT ? OFFSET ?`;
        productsParams.push(sqlLimit, offset || 0);

        const [pRows] = await pool.query<any[]>(productsQuery, productsParams);

        // 3. Fetch ONLY promotions related to the fetched products or global ones
        // This is a big optimization: instead of matching ALL promotions to ALL products,
        // we only match to the current page.
        const [promoRows] = await pool.query<any[]>(
            `SELECT pr.id, pr.nombre, pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : "'PERCENT' AS discount_type, 0 AS amount_discount, 0 AS priority,"}
                    pr.product_scope, pr.product_gender, pr.audience_scope, pr.audience_segment
             FROM promociones pr
             WHERE pr.activo = true
               AND pr.fecha_inicio <= NOW()
               AND pr.fecha_fin >= NOW()
            `
        );

        // 3. Fetch specific mappings if needed
        const [ppRows] = assignmentReady ? await pool.query<any[]>('SELECT promocion_id, producto_id FROM promocionproductos') : [[]];
        const [puRows] = (userId && assignmentReady) ? await pool.query<any[]>('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];

        const ppMap: Record<string, Set<string>> = {};
        ppRows.forEach(r => {
            if (!ppMap[r.promocion_id]) ppMap[r.promocion_id] = new Set();
            ppMap[r.promocion_id].add(r.producto_id);
        });
        const userPromos = new Set(puRows.map(r => r.promocion_id));

        // 4. Match and apply logic in JS (Robust across MySQL versions)
        let products = pRows.map(p => {
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

        if (smart && q) {
            const baseTokenSet = new Set(baseSearchTokens);
            const refinedTokenSet = new Set(refinedSearchTokens.filter((t) => !baseTokenSet.has(t)));

            const scoreSmartIntent = (p: any): number => {
                const name = normalizeSearch(`${p?.nombre || ''} ${p?.name || ''}`);
                const notes = normalizeSearch(`${p?.notas_olfativas || ''} ${p?.notes || ''}`);
                const houseText = normalizeSearch(`${p?.casa || ''} ${p?.house || ''} ${p?.categoria_nombre || ''}`);
                const desc = normalizeSearch(`${p?.descripcion || ''} ${p?.description || ''}`);
                const full = normalizeSearch(`${name} ${notes} ${houseText} ${desc} ${p?.genero || ''}`);

                let score = 0;
                if (q && full.includes(q)) score += 60;

                baseTokenSet.forEach((t) => {
                    if (name.includes(t)) score += 24;
                    else if (notes.includes(t)) score += 16;
                    else if (houseText.includes(t)) score += 14;
                    else if (desc.includes(t)) score += 10;
                });

                refinedTokenSet.forEach((t) => {
                    if (name.includes(t)) score += 14;
                    else if (notes.includes(t)) score += 11;
                    else if (houseText.includes(t)) score += 9;
                    else if (desc.includes(t)) score += 7;
                });

                if (gender && p?.genero === gender) score += 6;
                if (house && normalizeSearch(p?.casa || '') === house) score += 6;

                if (Number(p?.stock || 0) > 0) score += 2;
                if (Number(p?.unidades_vendidas || 0) > 20) score += 2;

                return score;
            };

            const ranked = products
                .map((p) => ({ p, score: scoreSmartIntent(p) }))
                .sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    const soldA = Number(a.p?.unidades_vendidas || 0);
                    const soldB = Number(b.p?.unidades_vendidas || 0);
                    if (soldB !== soldA) return soldB - soldA;
                    return String(b.p?.creado_en || '').localeCompare(String(a.p?.creado_en || ''));
                });

            const strict = ranked.filter((r) => r.score > 0).map((r) => r.p);
            const fallback = ranked.filter((r) => r.score <= 0).map((r) => r.p);
            const smartTake = Math.max(targetSmartResults, 6);
            products = strict.concat(fallback).slice(0, smartTake);
            total = products.length;
        } else {
            if (q) {
                const tokens = q.split(' ').filter(t => t.length > 0);
                const finalTokens = tokens.map(t => t.toLowerCase());

                products = products.filter((p: any) => {
                    // Incluimos nombre y casa en el blob de comparacion
                    const blob = normalizeSearch(`${p?.nombre || ''} ${p?.name || ''} ${p?.casa || ''} ${p?.house || ''}`);
                    if (!blob) return false;
                    return finalTokens.every(t => blob.includes(t));
                });

                // Rankear resultados para que el nombre exacto o mas parecido vaya primero
                products.sort((a: any, b: any) => {
                    const normA = normalizeSearch(a.nombre || '');
                    const normB = normalizeSearch(b.nombre || '');
                    const normQ = q; // q ya viene normalizada

                    // Prioridad 1: Coincidencia exacta del nombre (normalizado)
                    if (normA === normQ) return -1;
                    if (normB === normQ) return 1;

                    // Prioridad 2: El nombre empieza con la query (normalizado)
                    if (normA.startsWith(normQ)) return -1;
                    if (normB.startsWith(normQ)) return 1;

                    // Prioridad 3: Coincidencia de Marca (exacta)
                    const casaA = normalizeSearch(a.casa || '');
                    const casaB = normalizeSearch(b.casa || '');
                    if (casaA === normQ) return -1;
                    if (casaB === normQ) return 1;

                    // Prioridad 4: Mayor numero de unidades vendidas (popularidad)
                    const soldA = Number(a.unidades_vendidas || 0);
                    const soldB = Number(b.unidades_vendidas || 0);
                    if (soldB !== soldA) return soldB - soldA;

                    return String(b.creado_en || '').localeCompare(String(a.creado_en || ''));
                });

                // Aplicar el limite real despues del filtrado y ranking
                products = products.slice(0, finalLimit);
            }
            if (limit && limit > 0) {
                products = products.slice(0, limit);
            }
        }

        const response = {
            total: smart && q ? products.length : total,
            page: smart && q ? 1 : page,
            pageSize: smart && q ? products.length : limit,
            totalPages: smart && q ? 1 : Math.ceil(total / limit),
            items: products
        };

        // ── Cache: store result for anonymous requests ────────────────────────
        if (anonCacheKey) {
            appCache.set(anonCacheKey, response);
            res.setHeader('X-Cache', 'MISS');
        }

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching public catalog:', error);
        res.status(500).json({ error: 'Error al cargar el catálogo de productos' });
    }
};

export const getPublicHouses = async (_req: Request, res: Response): Promise<void> => {
    try {
        const casaOk = await detectProductCasaSchema();
        if (!casaOk) {
            res.status(200).json([]);
            return;
        }

        const [rows] = await pool.query<any[]>(
            `SELECT
                LOWER(TRIM(p.casa)) AS slug,
                MIN(TRIM(p.casa)) AS nombre,
                COUNT(*) AS total_productos
             FROM productos p
             WHERE p.casa IS NOT NULL
               AND TRIM(p.casa) <> ''
             GROUP BY LOWER(TRIM(p.casa))
             ORDER BY nombre ASC`
        );

        res.status(200).json(rows || []);
    } catch (error) {
        console.error('Error fetching public houses:', error);
        res.status(500).json({ error: 'Error al cargar las casas perfumistas' });
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

        // ── Cache: serve anonymous requests from cache (TTL 5 min) ───────────
        const cacheKey = `${CACHE_KEYS.NEWEST}${limit}:${userId || 'anon'}`;
        const cached = appCache.get<any[]>(cacheKey);
        if (cached) {
            res.setHeader('X-Cache', 'HIT');
            res.status(200).json(cached);
            return;
        }

        const { advancedReady } = await getPromotionAdvancedSqlParts();
        const newUntilOk = await detectProductNewUntilSchema();
        const casaOk = await detectProductCasaSchema();

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
        const casaSelect = casaOk ? ', p.casa AS casa, p.casa AS house' : '';

        let rows: any[] = [];

        // 1. Fetch newest products
        const [pRows] = await pool.query<any[]>(
            `SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.notas_olfativas AS notes, p.notas_olfativas, 
                    p.precio AS price, p.precio, p.stock, p.unidades_vendidas AS soldCount, p.unidades_vendidas,
                    p.imagen_url AS imageUrl, p.imagen_url, p.promocion_id,
                    ${esNuevoExpr}${casaSelect}, p.creado_en
             FROM productos p
             ${categoryJoin}
             WHERE p.stock >= 0
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

        const assignmentReady = await detectPromotionAssignmentSchema();
        const [ppRows] = assignmentReady ? await pool.query<any[]>('SELECT promocion_id, producto_id FROM promocionproductos') : [[]];
        const [puRows] = (userId && assignmentReady) ? await pool.query<any[]>('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];

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

        const response = {
            total: rows.length,
            page: 1,
            pageSize: limit,
            totalPages: 1,
            items: rows
        };

        appCache.set(cacheKey, response);
        res.setHeader('X-Cache', 'MISS');
        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching newest products:', error);
        res.status(500).json({ error: 'Error al cargar productos nuevos' });
    }
};

// 2.d Obtener productos más vendidos (home)
export const getBestsellers = async (req: Request, res: Response): Promise<void> => {
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
        const limit = Math.min(Math.max(Number(limitRaw || 4) || 4, 1), 50);

        // ── Cache: serve anonymous requests from cache (TTL 5 min) ───────────
        const cacheKey = `catalog:bestsellers:${limit}:${userId || 'anon'}`;
        const cached = appCache.get<any[]>(cacheKey);
        if (cached) {
            res.setHeader('X-Cache', 'HIT');
            res.status(200).json(cached);
            return;
        }

        const { advancedReady } = await getPromotionAdvancedSqlParts();
        const newUntilOk = await detectProductNewUntilSchema();
        const casaOk = await detectProductCasaSchema();

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
        const casaSelect = casaOk ? ', p.casa AS casa, p.casa AS house' : '';

        // 1. Fetch bestsellers (ordered by unidades_vendidas)
        const [pRows] = await pool.query<any[]>(
            `SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.notas_olfativas AS notes, p.notas_olfativas, 
                    p.precio AS price, p.precio, p.stock, p.unidades_vendidas AS soldCount, p.unidades_vendidas,
                    p.imagen_url AS imageUrl, p.imagen_url, p.promocion_id,
                    ${esNuevoExpr}${casaSelect}, p.creado_en
             FROM productos p
             ${categoryJoin}
             WHERE p.stock >= 0
             ORDER BY p.unidades_vendidas DESC
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

        const assignmentReady = await detectPromotionAssignmentSchema();
        const [ppRows] = assignmentReady ? await pool.query<any[]>('SELECT promocion_id, producto_id FROM promocionproductos') : [[]];
        const [puRows] = (userId && assignmentReady) ? await pool.query<any[]>('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];

        const ppMap: Record<string, Set<string>> = {};
        ppRows.forEach(r => {
            if (!ppMap[r.promocion_id]) ppMap[r.promocion_id] = new Set();
            ppMap[r.promocion_id].add(r.producto_id);
        });
        const userPromos = new Set(puRows.map((r: any) => r.promocion_id));

        // 3. Match logic in JS
        const rows = pRows.map(p => {
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

        const response = {
            total: rows.length,
            page: 1,
            pageSize: limit,
            totalPages: 1,
            items: rows
        };

        appCache.set(cacheKey, response);
        res.setHeader('X-Cache', 'MISS');
        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching bestsellers:', error);
        res.status(500).json({ error: 'Error al cargar productos más vendidos' });
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
        const casaOk = await detectProductCasaSchema();

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
        const casaSelect = casaOk ? ', p.casa AS casa, p.casa AS house' : '';
        const imagesSelect = await getProductImagesSql('p');


        // 1. Fetch product
        const [pRows] = await pool.query<any[]>(
            `SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.descripcion AS description, p.descripcion,
                    p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                    p.unidades_vendidas AS soldCount, p.unidades_vendidas, ${imagesSelect},
                    p.promocion_id, ${esNuevoExpr}${casaSelect}, p.creado_en
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

        const assignmentReady = await detectPromotionAssignmentSchema();
        const [ppRows] = assignmentReady ? await pool.query<any[]>('SELECT promocion_id, producto_id FROM promocionproductos WHERE producto_id = ?', [id]) : [[]];
        const [puRows] = (userId && assignmentReady) ? await pool.query<any[]>('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];

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
        const casaOk = await detectProductCasaSchema();

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

        const slugOk = await detectSlugSchema();
        const slugSelect = slugOk ? 'p.slug, ' : '';
        const casaSelect = casaOk ? ', p.casa AS casa, p.casa AS house' : '';
        const imagesSelect = await getProductImagesSql('p');

        // 2. Fetch related products
        const [pRows] = await pool.query<any[]>(
            `SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.notas_olfativas AS notes, p.notas_olfativas, 
                    p.precio AS price, p.precio, p.stock, ${imagesSelect}, p.promocion_id,
                    ${esNuevoExpr}${casaSelect}, p.creado_en, p.unidades_vendidas AS soldCount, p.unidades_vendidas
             FROM productos p
             ${categoryJoin}
             WHERE p.id <> ?
               AND p.genero = ?
               AND p.stock >= 0
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

        const assignmentReady = await detectPromotionAssignmentSchema();
        const [ppRows] = assignmentReady ? await pool.query<any[]>('SELECT promocion_id, producto_id FROM promocionproductos') : [[]];
        const [puRows] = (userId && assignmentReady) ? await pool.query<any[]>('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];

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

// 4. Actualizar producto (y manejar posible nueva imagen de forma resiliente)
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { nombre, genero, casa, descripcion, notas_olfativas, notas, precio, stock, es_nuevo, nuevo_hasta } = req.body;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

        // 1. Verificar si el producto existe antes de hacer nada costoso
        const idExpr = await productIdWhereExpr();
        const [existing] = await pool.query<any[]>(
            `SELECT id, imagen_url, imagen_url_2, imagen_url_3 FROM productos WHERE id = ${idExpr}`, 
            [id]
        );

        if (existing.length === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }

        const oldProduct = existing[0];
        const updates: string[] = [];
        const params: any[] = [];

        // 2. Detectar capacidades del esquema dinámicamente
        const img2Ok = await detectImage2Schema();
        const img3Ok = await detectImage3Schema();
        const newUntilOk = await detectProductNewUntilSchema();
        const casaOk = await detectProductCasaSchema();
        const slugOk = await detectSlugSchema();

        // 3. Procesar campos de texto (independiente de Firebase)
        const hasValue = (val: any) => val !== undefined && val !== null && val !== '';
        
        if (hasValue(nombre)) { 
            updates.push('nombre = ?'); 
            params.push(nombre); 
            if (slugOk) {
                updates.push('slug = ?');
                params.push(generateSlug(nombre));
            }
        }
        
        if (hasValue(genero)) {
            updates.push('genero = ?');
            params.push(normalizeGeneroInput(genero));
        }

        if (casaOk && casa !== undefined) {
            updates.push('casa = ?');
            params.push(normalizeCategorySlug(casa) || null);
        }

        if (hasValue(descripcion)) { updates.push('descripcion = ?'); params.push(descripcion); }
        
        const notasFinal = hasValue(notas_olfativas) ? notas_olfativas : (hasValue(notas) ? notas : undefined);
        if (notasFinal !== undefined) { updates.push('notas_olfativas = ?'); params.push(notasFinal); }
        
        if (precio !== undefined && precio !== '') { updates.push('precio = ?'); params.push(Number(precio)); }
        if (stock !== undefined && stock !== '') { updates.push('stock = ?'); params.push(Number(stock)); }
        if (es_nuevo !== undefined) { updates.push('es_nuevo = ?'); params.push(!!es_nuevo); }

        const nuevoHastaParsed = parseNuevoHastaInput(nuevo_hasta);
        if (nuevoHastaParsed !== undefined) {
            if (!newUntilOk) {
                res.status(400).json({ error: 'La base de datos no soporta la fecha de expiración de etiqueta NUEVO.' });
                return;
            }
            updates.push('nuevo_hasta = ?');
            params.push(nuevoHastaParsed);
        }

        // 4. Procesar Imágenes (Solo si se subieron archivos nuevos)
        // Usamos un bloque try-catch específico para Firebase para no tumbar toda la petición
        const newImages: Record<string, string> = {};
        
        try {
            // Imagen principal (puede venir en 'imagen' o en req.file por compatibilidad)
            const mainImgFile = files?.['imagen']?.[0] || (req as any).file;
            if (mainImgFile && mainImgFile.size > 0) {
                newImages.imagen_url = await uploadToFirebase(mainImgFile);
                updates.push('imagen_url = ?');
                params.push(newImages.imagen_url);
            }

            // Imagen 2
            if (img2Ok && files?.['imagen2']?.[0] && files['imagen2'][0].size > 0) {
                newImages.imagen_url_2 = await uploadToFirebase(files['imagen2'][0]);
                updates.push('imagen_url_2 = ?');
                params.push(newImages.imagen_url_2);
            }

            // Imagen 3
            if (img3Ok && files?.['imagen3']?.[0] && files['imagen3'][0].size > 0) {
                newImages.imagen_url_3 = await uploadToFirebase(files['imagen3'][0]);
                updates.push('imagen_url_3 = ?');
                params.push(newImages.imagen_url_3);
            }
        } catch (fbError: any) {
            console.error('❌ Error crítico en Firebase Storage durante update:', fbError.message);
            res.status(500).json({ 
                error: 'Error al procesar las imágenes. Firebase Storage no está configurado o falló.',
                details: [fbError.message]
            });
            return;
        }

        // 5. Ejecutar Actualización
        if (updates.length === 0) {
            res.status(200).json({ message: 'No se detectaron cambios para actualizar' });
            return;
        }

        const query = `UPDATE productos SET ${updates.join(', ')} WHERE id = ${idExpr}`;
        params.push(id);
        
        await pool.query(query, params);

        // 6. Limpieza en segundo plano (No bloqueante)
        // Si la DB ya se actualizó, intentamos borrar las viejas pero no fallamos si falla Firebase
        if (Object.keys(newImages).length > 0) {
            if (newImages.imagen_url && oldProduct.imagen_url) deleteFile(oldProduct.imagen_url).catch(e => console.warn('Non-blocking delete error:', e.message));
            if (newImages.imagen_url_2 && oldProduct.imagen_url_2) deleteFile(oldProduct.imagen_url_2).catch(e => console.warn('Non-blocking delete error:', e.message));
            if (newImages.imagen_url_3 && oldProduct.imagen_url_3) deleteFile(oldProduct.imagen_url_3).catch(e => console.warn('Non-blocking delete error:', e.message));
        }

        // Invalidar cache
        appCache.invalidateByPrefix('catalog:');

        res.status(200).json({ message: 'Producto actualizado exitosamente' });
    } catch (error: any) {
        console.error('Error in updateProduct controller:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor al actualizar el producto', 
            details: [error.message],
            code: error.code
        });
    }
};

// 5. Eliminar producto
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const idExpr = await productIdWhereExpr();

        // 1. Obtener URLs de imágenes para borrar de Storage
        let imagesToDelete: string[] = [];
        try {
            const img2Ok = await detectImage2Schema();
            const img3Ok = await detectImage3Schema();
            const selectCols = ['imagen_url'];
            if (img2Ok) selectCols.push('imagen_url_2');
            if (img3Ok) selectCols.push('imagen_url_3');

            const [rows] = await pool.query<any[]>(
                `SELECT ${selectCols.join(', ')} FROM productos WHERE id = ${idExpr}`,
                [id]
            );
            if (rows.length > 0) {
                const p = rows[0];
                if (p.imagen_url) imagesToDelete.push(p.imagen_url);
                if (img2Ok && p.imagen_url_2) imagesToDelete.push(p.imagen_url_2);
                if (img3Ok && p.imagen_url_3) imagesToDelete.push(p.imagen_url_3);
            }
        } catch (err) {
            console.warn('⚠️ No se pudieron obtener las imágenes para borrar de Storage:', err);
        }


        // 2. Borrar de la base de datos
        const [result] = await pool.query<any>(`
            DELETE FROM productos WHERE id = ${idExpr}
        `, [id]);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }

        // 3. Si se borró de la BD, borrar de Firebase Storage
        for (const imgUrl of imagesToDelete) {
            await deleteFile(imgUrl);
        }

        // Bust catalog cache so deleted product is gone immediately
        appCache.invalidateByPrefix('catalog:');

        res.status(200).json({ message: 'Producto eliminado exitosamente' });

    } catch (error) {
        // Caso tipico: el producto ya fue vendido y existe en detalleordenes.
        // En ese escenario el FK bloquea el DELETE y MySQL/MariaDB devuelve errno 1451.
        const err: any = error as any;
        const errno = Number(err?.errno);
        const code = String(err?.code || '');
        if (errno === 1451 || code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                error: 'No se puede eliminar el producto porque tiene ventas/pedidos asociados. Puedes dejarlo sin stock o desactivarlo en lugar de eliminarlo.'
            });
            return;
        }
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
            // genero (mujer | hombre | unisex)
            'genero',
            // casa / marca (ideal: slug de categoria, ej: dior, lattafa, arabe)
            'casa',
            'notas_olfativas',
            'descripcion',
            'precio',
            'stock',
            'imagen_url',
            'imagen_url_2',
            'imagen_url_3',
            'unidades_vendidas',
            'es_nuevo',
            // opcional (datetime-local o ISO). Ej: 2026-04-30T23:59
            'nuevo_hasta'
        ];
        const example = [
            'Aqua di Roma',
            'unisex',
            'dior',
            'Bergamota, Cedro, Ambar',
            'Fragancia fresca y elegante. Notas: Bergamota, Cedro, Ambar',
            159900,
            25,
            'https://tusitio.com/imagen.jpg',
            '',
            '',
            0,
            'TRUE',
            ''
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
        const casaOk = await detectProductCasaSchema();
        const newUntilOk = await detectProductNewUntilSchema();
        const slugOk = await detectSlugSchema();

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
            casa?: string | null;
            descripcion: string;
            notas_olfativas: string | null;
            precio: number;
            stock: number;
            unidades_vendidas: number;
            imagen_url: string | null;
            imagen_url_2?: string | null;
            imagen_url_3?: string | null;
            es_nuevo: boolean;
            nuevo_hasta?: string | null;
            slug?: string;
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
            // compat: algunos archivos antiguos usaban "categoria" como genero
            const categoriaRaw = getRowValue(r, ['categoria', 'category', 'categoria_slug']);
            const casaRaw = getRowValue(r, ['casa', 'house', 'marca', 'brand']);
            const stockRaw = getRowValue(r, ['stock', 'inventario', 'cantidad']);
            const imagenRaw = getRowValue(r, ['imagen_url', 'image_url', 'imagen', 'image', 'url_imagen', 'imageurl']);
            const imagen2Raw = getRowValue(r, ['imagen_url_2', 'image_url_2', 'imagen2', 'image2', 'url_imagen_2', 'imageurl2']);
            const imagen3Raw = getRowValue(r, ['imagen_url_3', 'image_url_3', 'imagen3', 'image3', 'url_imagen_3', 'imageurl3']);
            const vendidasRaw = getRowValue(r, ['unidades_vendidas', 'vendidas', 'ventas', 'unidades']);
            const nuevoRaw = getRowValue(r, ['es_nuevo', 'nuevo', 'is_new', 'new']);
            const nuevoHastaRaw = getRowValue(r, ['nuevo_hasta', 'nuevohasta', 'new_until', 'newuntil', 'hasta_nuevo']);

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

            const genero = normalizeGeneroInput(generoRaw !== undefined ? generoRaw : categoriaRaw);
            const stockN = parseNumberFlexible(stockRaw);
            const vendidasN = parseNumberFlexible(vendidasRaw);

            const stock = stockN === null ? 0 : Math.max(0, Math.trunc(stockN));
            const unidades_vendidas = vendidasN === null ? 0 : Math.max(0, Math.trunc(vendidasN));
            const imagen_url = String(imagenRaw ?? '').trim() || null;
            const imagen_url_2 = String(imagen2Raw ?? '').trim() || null;
            const imagen_url_3 = String(imagen3Raw ?? '').trim() || null;
            const es_nuevo = String(nuevoRaw ?? '').toLowerCase() === 'true' || nuevoRaw === 1 || nuevoRaw === true;

            const nuevoHastaParsed = parseNuevoHastaInput(nuevoHastaRaw);
            if (nuevoHastaParsed !== undefined && !newUntilOk) {
                errors.push({ row: excelRow, field: 'nuevo_hasta', message: 'Tu base de datos no soporta nuevo_hasta. Ejecuta migraciones y vuelve a intentar.' });
                continue;
            }

            const casaVal = String(casaRaw ?? '').trim();
            const casaFinal = casaVal ? (casaVal.length > 120 ? casaVal.slice(0, 120) : casaVal) : null;

            toInsert.push({
                id: uuidv4(),
                nombre,
                genero,
                casa: casaOk ? casaFinal : undefined,
                descripcion,
                notas_olfativas: notas || null,
                precio: precioN,
                stock,
                unidades_vendidas,
                imagen_url,
                imagen_url_2,
                imagen_url_3,
                es_nuevo
                ,
                nuevo_hasta: newUntilOk ? (nuevoHastaParsed === undefined ? null : nuevoHastaParsed) : undefined,
                slug: slugOk ? generateSlug(nombre) : undefined
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
            const image2Ok = true;
            const image3Ok = true;

            // Build a single INSERT statement shape (same columns for all rows)
            const baseCols: string[] = [
                'id',
                'nombre',
                'genero',
                ...(casaOk ? ['casa'] : []),
                ...(slugOk ? ['slug'] : []),
                'descripcion',
                'notas_olfativas',
                'precio',
                'stock',
                'unidades_vendidas',
                'imagen_url',
                ...(image2Ok ? ['imagen_url_2'] : []),
                ...(image3Ok ? ['imagen_url_3'] : []),
                'es_nuevo',
                ...(newUntilOk ? ['nuevo_hasta'] : [])
            ];
            const placeholders = baseCols.map(() => '?').join(', ');
            const insertSql = `INSERT INTO productos (${baseCols.join(', ')}) VALUES (${placeholders})`;

            for (const p of toInsert) {
                const values: any[] = [
                    p.id,
                    p.nombre,
                    p.genero,
                    ...(casaOk ? [(p as any).casa ?? null] : []),
                    ...(slugOk ? [(p as any).slug ?? null] : []),
                    p.descripcion,
                    p.notas_olfativas,
                    p.precio,
                    p.stock,
                    p.unidades_vendidas,
                    p.imagen_url,
                    ...(image2Ok ? [(p as any).imagen_url_2 ?? null] : []),
                    ...(image3Ok ? [(p as any).imagen_url_3 ?? null] : []),
                    p.es_nuevo,
                    ...(newUntilOk ? [(p as any).nuevo_hasta ?? null] : [])
                ];

                await connection.query(insertSql, values);
            }
            await connection.query('COMMIT');
        } catch (e) {
            await connection.query('ROLLBACK');
            throw e;
        } finally {
            connection.release();
        }

        // Bust catalog cache so imported products are visible immediately
        appCache.invalidateByPrefix('catalog:');

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
