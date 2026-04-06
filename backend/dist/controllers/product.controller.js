"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLowStockProducts = exports.importProductsFromSpreadsheet = exports.downloadProductImportTemplate = exports.deleteProduct = exports.updateProduct = exports.getRelatedProducts = exports.getProductById = exports.getBestsellers = exports.getNewestProducts = exports.getPublicCatalog = exports.getProducts = exports.createProduct = void 0;
const database_1 = require("../config/database");
const uuid_1 = require("uuid");
const XLSX = __importStar(require("xlsx"));
const cache_util_1 = require("../utils/cache.util");
const storage_util_1 = require("../utils/storage.util");
/**
 * Helper to upload a file to Firebase Storage /products/
 */
async function uploadToFirebase(file) {
    return await (0, storage_util_1.uploadFile)(file, { folder: 'products' });
}
let promotionAssignmentReady = null;
let promotionGenderReady = null;
let promotionAdvancedReady = null;
// Detecta si productos.id es BINARY (UUID) o VARCHAR
let productIdIsBinary = null;
const detectProductIdType = async () => {
    if (productIdIsBinary !== null)
        return productIdIsBinary;
    try {
        const [rows] = await database_1.pool.query(`SELECT DATA_TYPE FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND LOWER(table_name) = 'productos'
               AND LOWER(column_name) = 'id'
             LIMIT 1`);
        const dtype = String(rows?.[0]?.DATA_TYPE || '').toLowerCase();
        productIdIsBinary = dtype === 'binary' || dtype === 'varbinary';
    }
    catch {
        productIdIsBinary = false;
    }
    return productIdIsBinary;
};
const productIdWhereExpr = async () => {
    const binary = await detectProductIdType();
    return binary ? 'UUID_TO_BIN(?)' : '?';
};
let categoriesReady = null;
const detectCategoriesSchema = async () => {
    if (categoriesReady !== null)
        return categoriesReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT COUNT(*) AS ok 
             FROM information_schema.tables 
             WHERE table_schema = DATABASE() 
               AND lower(table_name) = 'categorias'`);
        categoriesReady = Number(rows?.[0]?.ok || 0) > 0;
        return categoriesReady;
    }
    catch {
        categoriesReady = false;
        return false;
    }
};
const normalizeCategorySlug = (raw) => {
    if (raw === undefined || raw === null)
        return null;
    const v = String(raw).trim().toLowerCase();
    if (!v)
        return null;
    return v.length > 120 ? v.slice(0, 120) : v;
};
const generateSlug = (name) => {
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
const getCategorySqlParts = async () => {
    const ok = await detectCategoriesSchema();
    if (!ok)
        return { categorySelect: '', categoryJoin: '' };
    // Evitar JOIN si la columna casa no existe (migración pendiente)
    const casaOk = await detectProductCasaSchema();
    if (!casaOk)
        return { categorySelect: '', categoryJoin: '' };
    return {
        categorySelect: ', c.nombre AS categoria_nombre, c.slug AS categoria_slug',
        // categorias ahora se usan como "Casa" (marca)
        categoryJoin: 'LEFT JOIN categorias c ON c.slug = p.casa'
    };
};
const normalizeGeneroInput = (raw) => {
    const v = String(raw ?? '').trim().toLowerCase();
    if (!v)
        return 'unisex';
    if (['mujer', 'ella', 'dama', 'female', 'woman', 'women'].includes(v))
        return 'mujer';
    if (['hombre', 'el', 'caballero', 'male', 'man', 'men'].includes(v))
        return 'hombre';
    if (['unisex', 'mix', 'mixto', 'uni'].includes(v))
        return 'unisex';
    // fallback seguro
    if (v.includes('muj'))
        return 'mujer';
    if (v.includes('hom') || v.includes('cab'))
        return 'hombre';
    return 'unisex';
};
let productSlugReady = null;
const detectSlugSchema = async () => {
    if (productSlugReady !== null)
        return productSlugReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT COUNT(*) AS ok
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'productos'
               AND column_name = 'slug'
             LIMIT 1`);
        productSlugReady = !!rows?.[0]?.ok;
        return productSlugReady;
    }
    catch {
        productSlugReady = false;
        return false;
    }
};
let productNewUntilReady = null;
const detectProductNewUntilSchema = async () => {
    if (productNewUntilReady !== null)
        return productNewUntilReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT COUNT(*) AS ok
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'productos'
               AND column_name = 'nuevo_hasta'
             LIMIT 1`);
        productNewUntilReady = !!rows?.[0]?.ok;
        return productNewUntilReady;
    }
    catch {
        productNewUntilReady = false;
        return false;
    }
};
const getProductImagesSql = async (alias = 'p') => {
    const img2 = await detectImage2Schema();
    const img3 = await detectImage3Schema();
    let sql = `${alias}.imagen_url AS imageUrl, ${alias}.imagen_url`;
    if (img2)
        sql += `, ${alias}.imagen_url_2 AS imageUrl2, ${alias}.imagen_url_2`;
    if (img3)
        sql += `, ${alias}.imagen_url_3 AS imageUrl3, ${alias}.imagen_url_3`;
    return sql;
};
let productCasaReady = null;
const detectProductCasaSchema = async () => {
    if (productCasaReady === true)
        return true;
    try {
        const [rows] = await database_1.pool.query(`SELECT COUNT(*) AS ok
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'productos'
               AND column_name = 'casa'
             LIMIT 1`);
        productCasaReady = !!rows?.[0]?.ok;
        return productCasaReady;
    }
    catch {
        productCasaReady = false;
        return false;
    }
};
let productImg2Ready = null;
const detectImage2Schema = async () => {
    if (productImg2Ready !== null)
        return productImg2Ready;
    productImg2Ready = await database_1.pool.hasColumn('productos', 'imagen_url_2');
    return productImg2Ready;
};
let productImg3Ready = null;
const detectImage3Schema = async () => {
    if (productImg3Ready !== null)
        return productImg3Ready;
    productImg3Ready = await database_1.pool.hasColumn('productos', 'imagen_url_3');
    return productImg3Ready;
};
const parseNuevoHastaInput = (raw) => {
    if (raw === undefined || raw === null)
        return undefined;
    const v = String(raw).trim();
    if (!v)
        return null;
    // Aceptar formatos comunes (datetime-local o ISO); Postgres parsea.
    return v;
};
const detectPromotionAssignmentSchema = async () => {
    if (promotionAssignmentReady !== null)
        return promotionAssignmentReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND lower(table_name) = 'promocionproductos') > 0 AS has_pp,
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND lower(table_name) = 'promocionusuarios') > 0 AS has_pu,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'promociones' AND column_name = 'product_scope') > 0 AS has_product_scope,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'promociones' AND column_name = 'audience_scope') > 0 AS has_audience_scope
            `);
        const r = rows?.[0] || {};
        promotionAssignmentReady = !!(r.has_pp && r.has_pu && r.has_product_scope && r.has_audience_scope);
        return promotionAssignmentReady;
    }
    catch {
        promotionAssignmentReady = false;
        return false;
    }
};
const detectPromotionGenderSchema = async () => {
    if (promotionGenderReady !== null)
        return promotionGenderReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT
                COUNT(*) > 0 AS has_product_gender
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND lower(table_name) = 'promociones'
               AND column_name = 'product_gender'
            `);
        const r = rows?.[0] || {};
        promotionGenderReady = !!r.has_product_gender;
        return promotionGenderReady;
    }
    catch {
        promotionGenderReady = false;
        return false;
    }
};
const detectPromotionAdvancedSchema = async () => {
    if (promotionAdvancedReady !== null)
        return promotionAdvancedReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'promociones' AND column_name = 'discount_type') > 0 AS has_discount_type,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'promociones' AND column_name = 'amount_discount') > 0 AS has_amount_discount,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND lower(table_name) = 'promociones' AND column_name = 'priority') > 0 AS has_priority
            `);
        const r = rows?.[0] || {};
        promotionAdvancedReady = !!(r.has_discount_type && r.has_amount_discount && r.has_priority);
        return promotionAdvancedReady;
    }
    catch {
        promotionAdvancedReady = false;
        return false;
    }
};
const getPromotionAdvancedSqlParts = async () => {
    const advancedReady = await detectPromotionAdvancedSchema();
    const discountAmountExpr = advancedReady
        ? "CASE WHEN pr.discount_type = 'AMOUNT' THEN LEAST(COALESCE(pr.amount_discount, 0), p.precio) ELSE (p.precio * (pr.porcentaje_descuento / 100.0)) END"
        : '(p.precio * (pr.porcentaje_descuento / 100.0))';
    const orderByPromo = advancedReady
        ? `pr.priority DESC, (${discountAmountExpr}) DESC, pr.porcentaje_descuento DESC`
        : 'pr.porcentaje_descuento DESC';
    return { advancedReady, discountAmountExpr, orderByPromo };
};
const createProduct = async (req, res) => {
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
        const files = req.files;
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
        }
        catch (fbError) {
            console.error('❌ Error crítico en Firebase Storage durante creación:', fbError.message);
            res.status(500).json({
                error: 'Error al procesar las imágenes. Firebase Storage no está configurado correctamente.',
                details: [fbError.message]
            });
            return;
        }
        const id = (0, uuid_1.v4)();
        const slug = generateSlug(nombre);
        const casaNormalized = normalizeCategorySlug(casa);
        // Convert UUID to BINARY(16) in MySQL logic
        const idExpr = await productIdWhereExpr();
        const cols = ['id', 'nombre', 'genero', 'descripcion', 'notas_olfativas', 'precio', 'stock', 'unidades_vendidas', 'imagen_url', 'es_nuevo'];
        const vals = [
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
        await database_1.pool.query(query, vals);
        // Bust catalog cache so the new product is visible immediately
        cache_util_1.appCache.invalidateByPrefix('catalog:');
        res.status(201).json({
            message: 'Producto creado exitosamente',
            product: { id, nombre, precio, imagen_url }
        });
    }
    catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({
            error: 'Error del servidor al crear producto',
            details: [error.message],
            code: error.code
        });
    }
};
exports.createProduct = createProduct;
// 2. Obtener todos los productos
const getProducts = async (req, res) => {
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
        const [rows] = await database_1.pool.query(`SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.descripcion AS description, p.descripcion,
                    p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                    p.unidades_vendidas AS soldCount, p.unidades_vendidas, ${imagesSelect},
                    ${esNuevoExpr}${extraSelect}${casaSelect}, p.creado_en
             FROM productos p

             ${categoryJoin}
             ORDER BY p.creado_en DESC`);
        res.status(200).json(rows);
    }
    catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
};
exports.getProducts = getProducts;
// 2.b Obtener catálogo público con promociones activas
const getPublicCatalog = async (req, res) => {
    try {
        const authReq = req;
        const userId = authReq?.user?.id || null;
        const normalizeSearch = (raw) => {
            const s = String(raw ?? '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            return s.replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
        };
        const normalizeSlug = (raw) => {
            const v = String(raw ?? '').trim().toLowerCase();
            if (!v || v === 'todos' || v === 'all' || v === 'null' || v === 'undefined')
                return null;
            return v;
        };
        const parseGenderFilter = (raw) => {
            const v = String(raw ?? '').trim().toLowerCase();
            if (!v || v === 'all' || v === 'todos')
                return null;
            if (v === 'mujer' || v === 'hombre' || v === 'unisex')
                return v;
            return null;
        };
        const qRaw = String(req.query['q'] || '').trim();
        const q = normalizeSearch(qRaw);
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
        const pageRaw = Number(req.query['page'] || 1);
        const page = Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(pageRaw)) : 1;
        const offset = (page - 1) * limit;
        // ── Cache: serve anonymous requests from cache (TTL 5 min) ───────────
        let anonCacheKey = null;
        if (!userId) {
            const houseForKey = categorySlug && categorySlug !== 'mujer' && categorySlug !== 'hombre' && categorySlug !== 'unisex'
                ? categorySlug
                : '';
            anonCacheKey = `${cache_util_1.CACHE_KEYS.CATALOG_ANON}:q=${encodeURIComponent(q)}:house=${encodeURIComponent(houseForKey)}:gender=${encodeURIComponent(gender || '')}:page=${page}:limit=${limit}`;
            const cached = cache_util_1.appCache.get(anonCacheKey);
            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                res.status(200).json(cached);
                return;
            }
        }
        let userSegment = null;
        if (userId) {
            try {
                const [uRows] = await database_1.pool.query('SELECT segmento FROM usuarios WHERE id = ?', [userId]);
                userSegment = uRows?.[0]?.segmento || null;
            }
            catch {
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
        const queryParams = [];
        if (gender) {
            countQuery += ' AND p.genero = ?';
            queryParams.push(gender);
        }
        if (house && casaOk) {
            countQuery += ' AND LOWER(p.casa) = ?';
            queryParams.push(house);
        }
        if (q) {
            // Very basic SQL search for total count, more robust filtering happens later if needed
            // However, with indices, we can do some filtering here too.
            const qLike = `%${q}%`;
            if (casaOk) {
                countQuery += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ? OR p.casa LIKE ? OR p.notas_olfativas LIKE ?)';
                queryParams.push(qLike, qLike, qLike, qLike);
            }
            else {
                countQuery += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ? OR p.notas_olfativas LIKE ?)';
                queryParams.push(qLike, qLike, qLike);
            }
        }
        const [countRows] = await database_1.pool.query(countQuery, queryParams);
        const total = countRows?.[0]?.total || 0;
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
        const productsParams = [...queryParams];
        if (gender) {
            productsQuery += ' AND p.genero = ?';
        }
        if (house && casaOk) {
            productsQuery += ' AND LOWER(p.casa) = ?';
        }
        if (q) {
            if (casaOk) {
                productsQuery += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ? OR p.casa LIKE ? OR p.notas_olfativas LIKE ?)';
            }
            else {
                productsQuery += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ? OR p.notas_olfativas LIKE ?)';
            }
        }
        // Stable ordering avoids duplicates/missing items across pages when creado_en ties.
        productsQuery += ' ORDER BY p.creado_en DESC, p.id DESC LIMIT ? OFFSET ?';
        productsParams.push(limit, offset);
        const [pRows] = await database_1.pool.query(productsQuery, productsParams);
        // 3. Fetch ONLY promotions related to the fetched products or global ones
        // This is a big optimization: instead of matching ALL promotions to ALL products,
        // we only match to the current page.
        const [promoRows] = await database_1.pool.query(`SELECT pr.id, pr.nombre, pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : "'PERCENT' AS discount_type, 0 AS amount_discount, 0 AS priority,"}
                    pr.product_scope, pr.product_gender, pr.audience_scope, pr.audience_segment
             FROM promociones pr
             WHERE pr.activo = true
               AND pr.fecha_inicio <= NOW()
               AND pr.fecha_fin >= NOW()
            `);
        // 3. Fetch specific mappings if needed
        const [ppRows] = assignmentReady ? await database_1.pool.query('SELECT promocion_id, producto_id FROM promocionproductos') : [[]];
        const [puRows] = (userId && assignmentReady) ? await database_1.pool.query('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];
        const ppMap = {};
        ppRows.forEach(r => {
            if (!ppMap[r.promocion_id])
                ppMap[r.promocion_id] = new Set();
            ppMap[r.promocion_id].add(r.producto_id);
        });
        const userPromos = new Set(puRows.map(r => r.promocion_id));
        // 4. Match and apply logic in JS (Robust across MySQL versions)
        let products = pRows.map(p => {
            let bestPromo = null;
            let maxMontoDescuento = 0;
            promoRows.forEach(pr => {
                // Product Scope check
                let productMatch = false;
                if (pr.product_scope === 'GLOBAL')
                    productMatch = true;
                else if (pr.product_scope === 'SPECIFIC' && ppMap[pr.id]?.has(p.id))
                    productMatch = true;
                else if (pr.product_scope === 'GENDER' && pr.product_gender && p.genero === pr.product_gender)
                    productMatch = true;
                else if (pr.id === p.promocion_id)
                    productMatch = true;
                if (!productMatch)
                    return;
                // Audience Scope check
                let audienceMatch = false;
                if (pr.audience_scope === 'ALL')
                    audienceMatch = true;
                else if (pr.audience_scope === 'SEGMENT' && userSegment && pr.audience_segment === userSegment)
                    audienceMatch = true;
                else if (pr.audience_scope === 'CUSTOMERS' && userPromos.has(pr.id))
                    audienceMatch = true;
                if (!audienceMatch)
                    return;
                // Calculate discount
                let monto = 0;
                if (pr.discount_type === 'AMOUNT') {
                    monto = Math.min(Number(pr.amount_discount || 0), p.precio);
                }
                else {
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
        // Optional search and limit (used by navbar suggestions).
        if (q) {
            const tokens = q.split(' ').filter(Boolean);
            products = products.filter((p) => {
                const blob = normalizeSearch([
                    p?.nombre,
                    p?.name,
                    p?.descripcion,
                    p?.description,
                    p?.notas_olfativas,
                    p?.notes,
                    p?.categoria_nombre,
                    p?.categoria_slug,
                    p?.genero,
                    p?.casa,
                    p?.house,
                ].filter(Boolean).join(' '));
                if (!blob)
                    return false;
                return tokens.every(t => blob.includes(t));
            });
        }
        if (limit && limit > 0) {
            products = products.slice(0, limit);
        }
        const response = {
            total,
            page,
            pageSize: limit,
            totalPages: Math.ceil(total / limit),
            items: products
        };
        // ── Cache: store result for anonymous requests ────────────────────────
        if (anonCacheKey) {
            cache_util_1.appCache.set(anonCacheKey, response);
            res.setHeader('X-Cache', 'MISS');
        }
        res.status(200).json(response);
    }
    catch (error) {
        console.error('Error fetching public catalog:', error);
        res.status(500).json({ error: 'Error al cargar el catálogo de productos' });
    }
};
exports.getPublicCatalog = getPublicCatalog;
// 2.c Obtener productos mas nuevos (home)
const getNewestProducts = async (req, res) => {
    try {
        const authReq = req;
        const userId = authReq?.user?.id || null;
        let userSegment = null;
        if (userId) {
            try {
                const [uRows] = await database_1.pool.query('SELECT segmento FROM usuarios WHERE id = ?', [userId]);
                userSegment = uRows?.[0]?.segmento || null;
            }
            catch {
                userSegment = null;
            }
        }
        const limitRaw = req.query['limit'];
        const limit = Math.min(Math.max(Number(limitRaw || 8) || 8, 1), 50);
        // ── Cache: serve anonymous requests from cache (TTL 5 min) ───────────
        const cacheKey = `${cache_util_1.CACHE_KEYS.NEWEST}${limit}:${userId || 'anon'}`;
        const cached = cache_util_1.appCache.get(cacheKey);
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
        let rows = [];
        // 1. Fetch newest products
        const [pRows] = await database_1.pool.query(`SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.notas_olfativas AS notes, p.notas_olfativas, 
                    p.precio AS price, p.precio, p.stock, p.unidades_vendidas AS soldCount, p.unidades_vendidas,
                    p.imagen_url AS imageUrl, p.imagen_url, p.promocion_id,
                    ${esNuevoExpr}${casaSelect}, p.creado_en
             FROM productos p
             ${categoryJoin}
             WHERE p.stock >= 0
             ORDER BY p.creado_en DESC
             LIMIT ?`, [limit * 2]);
        // 2. Fetch all active promotions
        const [promoRows] = await database_1.pool.query(`SELECT pr.id, pr.nombre, pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : "'PERCENT' AS discount_type, 0 AS amount_discount, 0 AS priority,"}
                    pr.product_scope, pr.product_gender, pr.audience_scope, pr.audience_segment
             FROM promociones pr
             WHERE pr.activo = true
               AND pr.fecha_inicio <= NOW()
               AND pr.fecha_fin >= NOW()`);
        const assignmentReady = await detectPromotionAssignmentSchema();
        const [ppRows] = assignmentReady ? await database_1.pool.query('SELECT promocion_id, producto_id FROM promocionproductos') : [[]];
        const [puRows] = (userId && assignmentReady) ? await database_1.pool.query('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];
        const ppMap = {};
        ppRows.forEach(r => {
            if (!ppMap[r.promocion_id])
                ppMap[r.promocion_id] = new Set();
            ppMap[r.promocion_id].add(r.producto_id);
        });
        const userPromos = new Set(puRows.map((r) => r.promocion_id));
        // 3. Match logic in JS
        rows = pRows.map(p => {
            let bestPromo = null;
            let maxMontoDescuento = 0;
            promoRows.forEach(pr => {
                let productMatch = false;
                if (pr.product_scope === 'GLOBAL')
                    productMatch = true;
                else if (pr.product_scope === 'SPECIFIC' && ppMap[pr.id]?.has(p.id))
                    productMatch = true;
                else if (pr.product_scope === 'GENDER' && pr.product_gender && p.genero === pr.product_gender)
                    productMatch = true;
                else if (pr.id === p.promocion_id)
                    productMatch = true;
                if (!productMatch)
                    return;
                let audienceMatch = false;
                if (pr.audience_scope === 'ALL')
                    audienceMatch = true;
                else if (pr.audience_scope === 'SEGMENT' && userSegment && pr.audience_segment === userSegment)
                    audienceMatch = true;
                else if (pr.audience_scope === 'CUSTOMERS' && userPromos.has(pr.id))
                    audienceMatch = true;
                if (!audienceMatch)
                    return;
                let monto = 0;
                if (pr.discount_type === 'AMOUNT') {
                    monto = Math.min(Number(pr.amount_discount || 0), p.precio);
                }
                else {
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
        cache_util_1.appCache.set(cacheKey, response);
        res.setHeader('X-Cache', 'MISS');
        res.status(200).json(response);
    }
    catch (error) {
        console.error('Error fetching newest products:', error);
        res.status(500).json({ error: 'Error al cargar productos nuevos' });
    }
};
exports.getNewestProducts = getNewestProducts;
// 2.d Obtener productos más vendidos (home)
const getBestsellers = async (req, res) => {
    try {
        const authReq = req;
        const userId = authReq?.user?.id || null;
        let userSegment = null;
        if (userId) {
            try {
                const [uRows] = await database_1.pool.query('SELECT segmento FROM usuarios WHERE id = ?', [userId]);
                userSegment = uRows?.[0]?.segmento || null;
            }
            catch {
                userSegment = null;
            }
        }
        const limitRaw = req.query['limit'];
        const limit = Math.min(Math.max(Number(limitRaw || 4) || 4, 1), 50);
        // ── Cache: serve anonymous requests from cache (TTL 5 min) ───────────
        const cacheKey = `catalog:bestsellers:${limit}:${userId || 'anon'}`;
        const cached = cache_util_1.appCache.get(cacheKey);
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
        const [pRows] = await database_1.pool.query(`SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.notas_olfativas AS notes, p.notas_olfativas, 
                    p.precio AS price, p.precio, p.stock, p.unidades_vendidas AS soldCount, p.unidades_vendidas,
                    p.imagen_url AS imageUrl, p.imagen_url, p.promocion_id,
                    ${esNuevoExpr}${casaSelect}, p.creado_en
             FROM productos p
             ${categoryJoin}
             WHERE p.stock >= 0
             ORDER BY p.unidades_vendidas DESC
             LIMIT ?`, [limit * 2]);
        // 2. Fetch all active promotions
        const [promoRows] = await database_1.pool.query(`SELECT pr.id, pr.nombre, pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : "'PERCENT' AS discount_type, 0 AS amount_discount, 0 AS priority,"}
                    pr.product_scope, pr.product_gender, pr.audience_scope, pr.audience_segment
             FROM promociones pr
             WHERE pr.activo = true
               AND pr.fecha_inicio <= NOW()
               AND pr.fecha_fin >= NOW()`);
        const assignmentReady = await detectPromotionAssignmentSchema();
        const [ppRows] = assignmentReady ? await database_1.pool.query('SELECT promocion_id, producto_id FROM promocionproductos') : [[]];
        const [puRows] = (userId && assignmentReady) ? await database_1.pool.query('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];
        const ppMap = {};
        ppRows.forEach(r => {
            if (!ppMap[r.promocion_id])
                ppMap[r.promocion_id] = new Set();
            ppMap[r.promocion_id].add(r.producto_id);
        });
        const userPromos = new Set(puRows.map((r) => r.promocion_id));
        // 3. Match logic in JS
        const rows = pRows.map(p => {
            let bestPromo = null;
            let maxMontoDescuento = 0;
            promoRows.forEach(pr => {
                let productMatch = false;
                if (pr.product_scope === 'GLOBAL')
                    productMatch = true;
                else if (pr.product_scope === 'SPECIFIC' && ppMap[pr.id]?.has(p.id))
                    productMatch = true;
                else if (pr.product_scope === 'GENDER' && pr.product_gender && p.genero === pr.product_gender)
                    productMatch = true;
                else if (pr.id === p.promocion_id)
                    productMatch = true;
                if (!productMatch)
                    return;
                let audienceMatch = false;
                if (pr.audience_scope === 'ALL')
                    audienceMatch = true;
                else if (pr.audience_scope === 'SEGMENT' && userSegment && pr.audience_segment === userSegment)
                    audienceMatch = true;
                else if (pr.audience_scope === 'CUSTOMERS' && userPromos.has(pr.id))
                    audienceMatch = true;
                if (!audienceMatch)
                    return;
                let monto = 0;
                if (pr.discount_type === 'AMOUNT') {
                    monto = Math.min(Number(pr.amount_discount || 0), p.precio);
                }
                else {
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
        cache_util_1.appCache.set(cacheKey, response);
        res.setHeader('X-Cache', 'MISS');
        res.status(200).json(response);
    }
    catch (error) {
        console.error('Error fetching bestsellers:', error);
        res.status(500).json({ error: 'Error al cargar productos más vendidos' });
    }
};
exports.getBestsellers = getBestsellers;
// 3. Obtener un producto por ID
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const authReq = req;
        const userId = authReq?.user?.id || null;
        let userSegment = null;
        if (userId) {
            try {
                const [uRows] = await database_1.pool.query('SELECT segmento FROM usuarios WHERE id = ?', [userId]);
                userSegment = uRows?.[0]?.segmento || null;
            }
            catch {
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
        const [pRows] = await database_1.pool.query(`SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.descripcion AS description, p.descripcion,
                    p.notas_olfativas AS notes, p.notas_olfativas, p.precio AS price, p.precio, p.stock, 
                    p.unidades_vendidas AS soldCount, p.unidades_vendidas, ${imagesSelect},
                    p.promocion_id, ${esNuevoExpr}${casaSelect}, p.creado_en
             FROM productos p

             ${categoryJoin}
             ${whereClause}`, queryParams);
        if (!pRows || pRows.length === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }
        const p = pRows[0];
        // 2. Fetch all active promotions
        const [promoRows] = await database_1.pool.query(`SELECT pr.id, pr.nombre, pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : "'PERCENT' AS discount_type, 0 AS amount_discount, 0 AS priority,"}
                    pr.product_scope, pr.product_gender, pr.audience_scope, pr.audience_segment
             FROM promociones pr
             WHERE pr.activo = true
               AND pr.fecha_inicio <= NOW()
               AND pr.fecha_fin >= NOW()`);
        const assignmentReady = await detectPromotionAssignmentSchema();
        const [ppRows] = assignmentReady ? await database_1.pool.query('SELECT promocion_id, producto_id FROM promocionproductos WHERE producto_id = ?', [id]) : [[]];
        const [puRows] = (userId && assignmentReady) ? await database_1.pool.query('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];
        const hasSpecificPromo = ppRows.some(r => r.producto_id === id);
        const userPromos = new Set(puRows.map(r => r.promocion_id));
        // 3. Match logic in JS
        let bestPromo = null;
        let maxMontoDescuento = 0;
        promoRows.forEach(pr => {
            let productMatch = false;
            if (pr.product_scope === 'GLOBAL')
                productMatch = true;
            else if (pr.product_scope === 'SPECIFIC' && hasSpecificPromo && ppRows.some(r => r.promocion_id === pr.id))
                productMatch = true;
            else if (pr.product_scope === 'GENDER' && pr.product_gender && p.genero === pr.product_gender)
                productMatch = true;
            else if (pr.id === p.promocion_id)
                productMatch = true;
            if (!productMatch)
                return;
            let audienceMatch = false;
            if (pr.audience_scope === 'ALL')
                audienceMatch = true;
            else if (pr.audience_scope === 'SEGMENT' && userSegment && pr.audience_segment === userSegment)
                audienceMatch = true;
            else if (pr.audience_scope === 'CUSTOMERS' && userPromos.has(pr.id))
                audienceMatch = true;
            if (!audienceMatch)
                return;
            let monto = 0;
            if (pr.discount_type === 'AMOUNT') {
                monto = Math.min(Number(pr.amount_discount || 0), p.precio);
            }
            else {
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
    }
    catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Error al obtener producto' });
    }
};
exports.getProductById = getProductById;
const getRelatedProducts = async (req, res) => {
    try {
        const { id } = req.params;
        const authReq = req;
        const userId = authReq?.user?.id || null;
        let userSegment = null;
        if (userId) {
            try {
                const [uRows] = await database_1.pool.query('SELECT segmento FROM usuarios WHERE id = ?', [userId]);
                userSegment = uRows?.[0]?.segmento || null;
            }
            catch {
                userSegment = null;
            }
        }
        const limitRaw = req.query?.limit;
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
        const [gRows] = await database_1.pool.query('SELECT genero FROM productos WHERE id = ? LIMIT 1', [id]);
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
        const [pRows] = await database_1.pool.query(`SELECT p.id, p.nombre AS name, p.nombre, ${slugSelect}p.genero${categorySelect}, p.notas_olfativas AS notes, p.notas_olfativas, 
                    p.precio AS price, p.precio, p.stock, ${imagesSelect}, p.promocion_id,
                    ${esNuevoExpr}${casaSelect}, p.creado_en, p.unidades_vendidas AS soldCount, p.unidades_vendidas
             FROM productos p
             ${categoryJoin}
             WHERE p.id <> ?
               AND p.genero = ?
               AND p.stock >= 0
             ORDER BY p.unidades_vendidas DESC, p.creado_en DESC
             LIMIT ?`, [id, genero, limit]);
        if (!pRows || pRows.length === 0) {
            res.status(200).json([]);
            return;
        }
        // 3. Fetch all active promotions
        const [promoRows] = await database_1.pool.query(`SELECT pr.id, pr.nombre, pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : "'PERCENT' AS discount_type, 0 AS amount_discount, 0 AS priority,"}
                    pr.product_scope, pr.product_gender, pr.audience_scope, pr.audience_segment
             FROM promociones pr
             WHERE pr.activo = true
               AND pr.fecha_inicio <= NOW()
               AND pr.fecha_fin >= NOW()`);
        const assignmentReady = await detectPromotionAssignmentSchema();
        const [ppRows] = assignmentReady ? await database_1.pool.query('SELECT promocion_id, producto_id FROM promocionproductos') : [[]];
        const [puRows] = (userId && assignmentReady) ? await database_1.pool.query('SELECT promocion_id FROM promocionusuarios WHERE usuario_id = ?', [userId]) : [[]];
        const ppMap = {};
        ppRows.forEach(r => {
            if (!ppMap[r.promocion_id])
                ppMap[r.promocion_id] = new Set();
            ppMap[r.promocion_id].add(r.producto_id);
        });
        const userPromos = new Set(puRows.map(r => r.promocion_id));
        // 4. Match in JS
        const products = pRows.map(p => {
            let bestPromo = null;
            let maxMontoDescuento = 0;
            promoRows.forEach(pr => {
                let productMatch = false;
                if (pr.product_scope === 'GLOBAL')
                    productMatch = true;
                else if (pr.product_scope === 'SPECIFIC' && ppMap[pr.id]?.has(p.id))
                    productMatch = true;
                else if (pr.product_scope === 'GENDER' && pr.product_gender && p.genero === pr.product_gender)
                    productMatch = true;
                else if (pr.id === p.promocion_id)
                    productMatch = true;
                if (!productMatch)
                    return;
                let audienceMatch = false;
                if (pr.audience_scope === 'ALL')
                    audienceMatch = true;
                else if (pr.audience_scope === 'SEGMENT' && userSegment && pr.audience_segment === userSegment)
                    audienceMatch = true;
                else if (pr.audience_scope === 'CUSTOMERS' && userPromos.has(pr.id))
                    audienceMatch = true;
                if (!audienceMatch)
                    return;
                let monto = 0;
                if (pr.discount_type === 'AMOUNT') {
                    monto = Math.min(Number(pr.amount_discount || 0), p.precio);
                }
                else {
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
    }
    catch (error) {
        console.error('Error fetching related products:', error);
        res.status(500).json({ error: 'Error al obtener productos relacionados' });
    }
};
exports.getRelatedProducts = getRelatedProducts;
// 4. Actualizar producto (y manejar posible nueva imagen de forma resiliente)
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, genero, casa, descripcion, notas_olfativas, notas, precio, stock, es_nuevo, nuevo_hasta } = req.body;
        const files = req.files;
        // 1. Verificar si el producto existe antes de hacer nada costoso
        const idExpr = await productIdWhereExpr();
        const [existing] = await database_1.pool.query(`SELECT id, imagen_url, imagen_url_2, imagen_url_3 FROM productos WHERE id = ${idExpr}`, [id]);
        if (existing.length === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }
        const oldProduct = existing[0];
        const updates = [];
        const params = [];
        // 2. Detectar capacidades del esquema dinámicamente
        const img2Ok = await detectImage2Schema();
        const img3Ok = await detectImage3Schema();
        const newUntilOk = await detectProductNewUntilSchema();
        const casaOk = await detectProductCasaSchema();
        const slugOk = await detectSlugSchema();
        // 3. Procesar campos de texto (independiente de Firebase)
        const hasValue = (val) => val !== undefined && val !== null && val !== '';
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
        if (hasValue(descripcion)) {
            updates.push('descripcion = ?');
            params.push(descripcion);
        }
        const notasFinal = hasValue(notas_olfativas) ? notas_olfativas : (hasValue(notas) ? notas : undefined);
        if (notasFinal !== undefined) {
            updates.push('notas_olfativas = ?');
            params.push(notasFinal);
        }
        if (precio !== undefined && precio !== '') {
            updates.push('precio = ?');
            params.push(Number(precio));
        }
        if (stock !== undefined && stock !== '') {
            updates.push('stock = ?');
            params.push(Number(stock));
        }
        if (es_nuevo !== undefined) {
            updates.push('es_nuevo = ?');
            params.push(!!es_nuevo);
        }
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
        const newImages = {};
        try {
            // Imagen principal (puede venir en 'imagen' o en req.file por compatibilidad)
            const mainImgFile = files?.['imagen']?.[0] || req.file;
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
        }
        catch (fbError) {
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
        await database_1.pool.query(query, params);
        // 6. Limpieza en segundo plano (No bloqueante)
        // Si la DB ya se actualizó, intentamos borrar las viejas pero no fallamos si falla Firebase
        if (Object.keys(newImages).length > 0) {
            if (newImages.imagen_url && oldProduct.imagen_url)
                (0, storage_util_1.deleteFile)(oldProduct.imagen_url).catch(e => console.warn('Non-blocking delete error:', e.message));
            if (newImages.imagen_url_2 && oldProduct.imagen_url_2)
                (0, storage_util_1.deleteFile)(oldProduct.imagen_url_2).catch(e => console.warn('Non-blocking delete error:', e.message));
            if (newImages.imagen_url_3 && oldProduct.imagen_url_3)
                (0, storage_util_1.deleteFile)(oldProduct.imagen_url_3).catch(e => console.warn('Non-blocking delete error:', e.message));
        }
        // Invalidar cache
        cache_util_1.appCache.invalidateByPrefix('catalog:');
        res.status(200).json({ message: 'Producto actualizado exitosamente' });
    }
    catch (error) {
        console.error('Error in updateProduct controller:', error);
        res.status(500).json({
            error: 'Error interno del servidor al actualizar el producto',
            details: [error.message],
            code: error.code
        });
    }
};
exports.updateProduct = updateProduct;
// 5. Eliminar producto
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const idExpr = await productIdWhereExpr();
        // 1. Obtener URLs de imágenes para borrar de Storage
        let imagesToDelete = [];
        try {
            const img2Ok = await detectImage2Schema();
            const img3Ok = await detectImage3Schema();
            const selectCols = ['imagen_url'];
            if (img2Ok)
                selectCols.push('imagen_url_2');
            if (img3Ok)
                selectCols.push('imagen_url_3');
            const [rows] = await database_1.pool.query(`SELECT ${selectCols.join(', ')} FROM productos WHERE id = ${idExpr}`, [id]);
            if (rows.length > 0) {
                const p = rows[0];
                if (p.imagen_url)
                    imagesToDelete.push(p.imagen_url);
                if (img2Ok && p.imagen_url_2)
                    imagesToDelete.push(p.imagen_url_2);
                if (img3Ok && p.imagen_url_3)
                    imagesToDelete.push(p.imagen_url_3);
            }
        }
        catch (err) {
            console.warn('⚠️ No se pudieron obtener las imágenes para borrar de Storage:', err);
        }
        // 2. Borrar de la base de datos
        const [result] = await database_1.pool.query(`
            DELETE FROM productos WHERE id = ${idExpr}
        `, [id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }
        // 3. Si se borró de la BD, borrar de Firebase Storage
        for (const imgUrl of imagesToDelete) {
            await (0, storage_util_1.deleteFile)(imgUrl);
        }
        // Bust catalog cache so deleted product is gone immediately
        cache_util_1.appCache.invalidateByPrefix('catalog:');
        res.status(200).json({ message: 'Producto eliminado exitosamente' });
    }
    catch (error) {
        // Caso tipico: el producto ya fue vendido y existe en detalleordenes.
        // En ese escenario el FK bloquea el DELETE y MySQL/MariaDB devuelve errno 1451.
        const err = error;
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
exports.deleteProduct = deleteProduct;
const normalizeHeader = (value) => {
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
const parseGenero = (raw) => {
    const v = normalizeHeader(raw);
    if (!v)
        return 'unisex';
    if (['mujer', 'female', 'f', 'para_mujer', 'woman', 'women'].includes(v))
        return 'mujer';
    if (['hombre', 'male', 'm', 'para_hombre', 'man', 'men'].includes(v))
        return 'hombre';
    if (['unisex', 'u', 'uni'].includes(v))
        return 'unisex';
    return 'unisex';
};
const slugifyCategory = (name) => {
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
const parseCategorySlugFromImport = (raw, categoriesOk, validCategorySlugs) => {
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
const parseNumberFlexible = (raw) => {
    if (raw === null || raw === undefined)
        return null;
    if (typeof raw === 'number' && Number.isFinite(raw))
        return raw;
    const s0 = String(raw).trim();
    if (!s0)
        return null;
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
        }
        else {
            // 1,234.56 -> 1234.56
            s = s.replace(/,/g, '');
        }
    }
    else if (hasComma && !hasDot) {
        // 1234,56 -> 1234.56
        s = s.replace(',', '.');
    }
    else {
        // Keep dots as decimal separator
    }
    const n = Number(s);
    if (!Number.isFinite(n))
        return null;
    return n;
};
const getRowValue = (row, keys) => {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '')
            return row[k];
    }
    return undefined;
};
const downloadProductImportTemplate = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error generating import template:', error);
        res.status(500).json({ error: 'Error al generar la plantilla' });
    }
};
exports.downloadProductImportTemplate = downloadProductImportTemplate;
const importProductsFromSpreadsheet = async (req, res) => {
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: 'Debes subir un archivo en el campo "archivo" (.xlsx o .csv)' });
        return;
    }
    const dryRun = String(req.query?.dry_run || '').toLowerCase() === 'true';
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
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!rawRows || rawRows.length === 0) {
            res.status(400).json({ error: 'La hoja está vacía' });
            return;
        }
        // Normalize headers
        const rows = rawRows.map((r) => {
            const out = {};
            for (const [k, v] of Object.entries(r)) {
                out[normalizeHeader(k)] = v;
            }
            return out;
        });
        if (rows.length > 2000) {
            res.status(400).json({ error: 'El archivo tiene demasiadas filas (max 2000)' });
            return;
        }
        const errors = [];
        const toInsert = [];
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
                id: (0, uuid_1.v4)(),
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
                es_nuevo,
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
        const connection = await database_1.pool.getConnection();
        try {
            await connection.query('BEGIN');
            const image2Ok = true;
            const image3Ok = true;
            // Build a single INSERT statement shape (same columns for all rows)
            const baseCols = [
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
                const values = [
                    p.id,
                    p.nombre,
                    p.genero,
                    ...(casaOk ? [p.casa ?? null] : []),
                    ...(slugOk ? [p.slug ?? null] : []),
                    p.descripcion,
                    p.notas_olfativas,
                    p.precio,
                    p.stock,
                    p.unidades_vendidas,
                    p.imagen_url,
                    ...(image2Ok ? [p.imagen_url_2 ?? null] : []),
                    ...(image3Ok ? [p.imagen_url_3 ?? null] : []),
                    p.es_nuevo,
                    ...(newUntilOk ? [p.nuevo_hasta ?? null] : [])
                ];
                await connection.query(insertSql, values);
            }
            await connection.query('COMMIT');
        }
        catch (e) {
            await connection.query('ROLLBACK');
            throw e;
        }
        finally {
            connection.release();
        }
        // Bust catalog cache so imported products are visible immediately
        cache_util_1.appCache.invalidateByPrefix('catalog:');
        res.status(201).json({ created: toInsert.length, skipped, failed: errors.length, errors });
    }
    catch (error) {
        console.error('Error importing products from spreadsheet:', error);
        res.status(500).json({ error: 'Error al importar productos', details: error?.message || String(error) });
    }
};
exports.importProductsFromSpreadsheet = importProductsFromSpreadsheet;
const getLowStockProducts = async (req, res) => {
    try {
        const thresholdRaw = req.query?.threshold;
        const thresholdNum = Number(thresholdRaw ?? 5);
        const threshold = Number.isFinite(thresholdNum) ? Math.max(0, Math.min(1000, Math.trunc(thresholdNum))) : 5;
        const limitRaw = req.query?.limit;
        const limitNum = Number(limitRaw ?? 20);
        const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(100, Math.trunc(limitNum))) : 20;
        const [countRows] = await database_1.pool.query(`SELECT CAST(COUNT(*) AS SIGNED) AS count
             FROM productos
             WHERE COALESCE(stock, 0) <= ?`, [threshold]);
        const [rows] = await database_1.pool.query(`SELECT id, nombre, stock, imagen_url
             FROM productos
             WHERE COALESCE(stock, 0) <= ?
             ORDER BY COALESCE(stock, 0) ASC, nombre ASC
             LIMIT ?`, [threshold, limit]);
        res.status(200).json({
            threshold,
            count: Number(countRows?.[0]?.count || 0),
            items: rows || []
        });
    }
    catch (error) {
        console.error('Error fetching low stock products:', error);
        res.status(500).json({ error: 'Error al obtener productos con bajo stock' });
    }
};
exports.getLowStockProducts = getLowStockProducts;
