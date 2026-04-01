"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPromotionsFabMetrics = exports.trackPromotionsFabClick = exports.deletePromotion = exports.updatePromotionActive = exports.updatePromotion = exports.getPromotionsAdmin = exports.getPromotions = exports.createPromotion = void 0;
const database_1 = require("../config/database");
const uuid_1 = require("uuid");
const supabase_1 = require("../config/supabase");
const upload_middleware_1 = require("../middleware/upload.middleware");
let promotionAssignmentReady = null;
let promotionMediaReady = null;
let promotionAdvancedReady = null;
let promotionGenderReady = null;
let promoFabClicksReady = null;
const detectPromoFabClicksColumn = async () => {
    if (promoFabClicksReady !== null)
        return promoFabClicksReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE lower(table_name) = 'configuracionglobal'
                  AND column_name = 'promotions_fab_clicks'
                  AND table_schema = DATABASE()
            ) AS ok`);
        promoFabClicksReady = !!rows?.[0]?.ok;
        return promoFabClicksReady;
    }
    catch {
        promoFabClicksReady = false;
        return false;
    }
};
let categoriesReady = null;
const detectCategoriesSchema = async () => {
    if (categoriesReady !== null)
        return categoriesReady;
    try {
        const [rows] = await database_1.pool.query("SELECT count(*) > 0 AS ok FROM information_schema.tables WHERE lower(table_name) = 'categorias' AND table_schema = DATABASE()");
        categoriesReady = !!rows?.[0]?.ok;
        return categoriesReady;
    }
    catch {
        categoriesReady = false;
        return false;
    }
};
const slugify = (name) => {
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
const parseBoolean = (value, fallback) => {
    if (value === undefined || value === null)
        return fallback;
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return value === 1 ? true : value === 0 ? false : fallback;
    const v = String(value).trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes')
        return true;
    if (v === 'false' || v === '0' || v === 'no')
        return false;
    return fallback;
};
const ensureCategoryExists = async (slug) => {
    try {
        const [rows] = await database_1.pool.query('SELECT 1 AS ok FROM categorias WHERE slug = ? LIMIT 1', [slug]);
        return !!rows?.[0]?.ok;
    }
    catch {
        return false;
    }
};
const detectPromotionAssignmentSchema = async () => {
    if (promotionAssignmentReady !== null)
        return promotionAssignmentReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT
                (SELECT COUNT(*) FROM information_schema.tables WHERE lower(table_name) = 'promocionproductos' AND table_schema = DATABASE()) > 0 AS has_pp,
                (SELECT COUNT(*) FROM information_schema.tables WHERE lower(table_name) = 'promocionusuarios' AND table_schema = DATABASE()) > 0 AS has_pu,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE lower(table_name) = 'promociones' AND column_name = 'product_scope' AND table_schema = DATABASE()
                ) AS has_product_scope,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE lower(table_name) = 'promociones' AND column_name = 'audience_scope' AND table_schema = DATABASE()
                ) AS has_audience_scope
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
const detectPromotionMediaSchema = async () => {
    if (promotionMediaReady !== null)
        return promotionMediaReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE lower(table_name) = 'promociones' AND column_name = 'product_gender' AND table_schema = DATABASE()
                ) AS has_product_gender,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE lower(table_name) = 'promociones' AND column_name = 'imagen_url' AND table_schema = DATABASE()
                ) AS has_imagen_url
            `);
        const r = rows?.[0] || {};
        promotionMediaReady = !!(r.has_product_gender && r.has_imagen_url);
        return promotionMediaReady;
    }
    catch {
        promotionMediaReady = false;
        return false;
    }
};
const detectPromotionGenderSchema = async () => {
    if (promotionGenderReady !== null)
        return promotionGenderReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE lower(table_name) = 'promociones' AND column_name = 'product_gender' AND table_schema = DATABASE()
                ) AS has_product_gender`);
        promotionGenderReady = !!rows?.[0]?.has_product_gender;
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
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE lower(table_name) = 'promociones' AND column_name = 'discount_type' AND table_schema = DATABASE()
                ) AS has_discount_type,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE lower(table_name) = 'promociones' AND column_name = 'amount_discount' AND table_schema = DATABASE()
                ) AS has_amount_discount,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE lower(table_name) = 'promociones' AND column_name = 'priority' AND table_schema = DATABASE()
                ) AS has_priority
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
const createPromotion = async (req, res) => {
    try {
        const { nombre, descripcion, product_gender, discount_type, porcentaje_descuento, amount_discount, priority, fecha_inicio, fecha_fin, activo, product_scope, product_ids, audience_scope, audience_segment, audience_user_ids } = req.body;
        const id = (0, uuid_1.v4)();
        const isActive = parseBoolean(activo, true) ?? true;
        const assignmentReady = await detectPromotionAssignmentSchema();
        const mediaReady = await detectPromotionMediaSchema();
        const advancedReady = await detectPromotionAdvancedSchema();
        const categoriesOk = await detectCategoriesSchema();
        if (!assignmentReady) {
            res.status(400).json({ error: 'Tu base de datos no soporta reglas de asignacion de promociones. Aplica la migracion primero.' });
            return;
        }
        if (!mediaReady && (req.file || (product_scope || 'GLOBAL') === 'GENDER')) {
            res.status(400).json({ error: 'Tu base de datos no soporta imagen o filtro por genero. Ejecuta la migracion 20260312_promotions_image_and_gender.sql.' });
            return;
        }
        const wantsAdvanced = typeof discount_type === 'string' ||
            amount_discount !== undefined ||
            priority !== undefined;
        if (wantsAdvanced && !advancedReady) {
            res.status(400).json({
                error: 'Tu base de datos no soporta descuento fijo/prioridad. Ejecuta database/migrations/20260312_promotions_amount_and_priority.sql en Supabase.'
            });
            return;
        }
        let imagen_url = null;
        if (mediaReady && req.file) {
            const file = req.file;
            const uniqueFilename = (0, upload_middleware_1.sanitizeFilename)(file.originalname);
            const { error } = await supabase_1.supabase.storage
                .from('perfumissimo_bucket')
                .upload(`promotions/${uniqueFilename}`, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });
            if (error)
                throw new Error('Error subiendo imagen de promocion a Supabase: ' + error.message);
            const { data: publicData } = supabase_1.supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(`promotions/${uniqueFilename}`);
            imagen_url = publicData.publicUrl;
        }
        const connection = await database_1.pool.getConnection();
        try {
            await connection.beginTransaction();
            const dtype = advancedReady ? (String(discount_type || 'PERCENT').toUpperCase()) : 'PERCENT';
            const pct = dtype === 'AMOUNT' ? 0 : Number(porcentaje_descuento || 0);
            const amount = dtype === 'AMOUNT' ? Number(amount_discount || 0) : null;
            const prio = advancedReady ? Number(priority || 0) : 0;
            if (mediaReady) {
                const scope = (product_scope || 'GLOBAL');
                const categorySlug = scope === 'GENDER' ? slugify(product_gender || '') : '';
                if (scope === 'GENDER') {
                    if (!categorySlug) {
                        await connection.rollback();
                        connection.release();
                        res.status(400).json({ error: 'Debes seleccionar una categoria' });
                        return;
                    }
                    if (categoriesOk) {
                        const exists = await ensureCategoryExists(categorySlug);
                        if (!exists) {
                            await connection.rollback();
                            connection.release();
                            res.status(400).json({ error: 'Categoria invalida. Crea la categoria primero en Admin > Categorias.' });
                            return;
                        }
                    }
                }
                await connection.query(`INSERT INTO promociones (
                        id, nombre, descripcion, imagen_url, porcentaje_descuento${advancedReady ? ', discount_type, amount_discount, priority' : ''}, fecha_inicio, fecha_fin,
                        product_scope, product_gender, audience_scope, audience_segment, activo
                    )
                    VALUES (?, ?, ?, ?, ?, ${advancedReady ? '?, ?, ?, ' : ''}?, ?, ?, ?, ?, ?, ?)`, [
                    id,
                    nombre,
                    descripcion,
                    imagen_url,
                    pct,
                    ...(advancedReady ? [dtype, amount, prio] : []),
                    fecha_inicio,
                    fecha_fin,
                    scope,
                    scope === 'GENDER' ? categorySlug : null,
                    audience_scope || 'ALL',
                    audience_segment || null,
                    isActive
                ]);
            }
            else {
                await connection.query(`INSERT INTO promociones (
                        id, nombre, descripcion, porcentaje_descuento${advancedReady ? ', discount_type, amount_discount, priority' : ''}, fecha_inicio, fecha_fin,
                        product_scope, audience_scope, audience_segment, activo
                    )
                    VALUES (?, ?, ?, ?, ${advancedReady ? '?, ?, ?, ' : ''}?, ?, ?, ?, ?, ?)`, [
                    id,
                    nombre,
                    descripcion,
                    pct,
                    ...(advancedReady ? [dtype, amount, prio] : []),
                    fecha_inicio,
                    fecha_fin,
                    product_scope || 'GLOBAL',
                    audience_scope || 'ALL',
                    audience_segment || null,
                    isActive
                ]);
            }
            if ((product_scope || 'GLOBAL') === 'SPECIFIC') {
                for (const pid of (product_ids || [])) {
                    await connection.query('INSERT IGNORE INTO promocionproductos (promocion_id, producto_id) VALUES (?, ?)', [id, pid]);
                }
            }
            if ((audience_scope || 'ALL') === 'CUSTOMERS') {
                for (const uid of (audience_user_ids || [])) {
                    await connection.query('INSERT IGNORE INTO promocionusuarios (promocion_id, usuario_id) VALUES (?, ?)', [id, uid]);
                }
            }
            await connection.commit();
        }
        catch (e) {
            await connection.rollback();
            throw e;
        }
        finally {
            connection.release();
        }
        res.status(201).json({ message: 'Promocion creada con exito', id });
    }
    catch (error) {
        console.error('Error creating promo:', error);
        res.status(500).json({ error: 'Error al crear promocion' });
    }
};
exports.createPromotion = createPromotion;
const getPromotions = async (_req, res) => {
    try {
        const assignmentReady = await detectPromotionAssignmentSchema();
        const mediaReady = await detectPromotionMediaSchema();
        const genderReady = await detectPromotionGenderSchema();
        const advancedReady = await detectPromotionAdvancedSchema();
        if (assignmentReady) {
            const genderOr = genderReady
                ? `
                    OR (
                      COALESCE(pr.product_scope, 'GLOBAL') = 'GENDER'
                      AND pr.product_gender IS NOT NULL
                      AND EXISTS (
                        SELECT 1
                        FROM productos p
                        WHERE p.genero = pr.product_gender
                          AND p.stock > 0
                      )
                    )`
                : '';
            const [rows] = await database_1.pool.query(`
                SELECT id, nombre, descripcion${mediaReady ? ', imagen_url' : ''}, porcentaje_descuento${advancedReady ? ', discount_type, amount_discount, priority' : ''}, fecha_inicio, fecha_fin, activo
                FROM promociones pr
                WHERE pr.activo = true
                  AND (
                    ${advancedReady
                ? "(pr.discount_type = 'AMOUNT' AND COALESCE(pr.amount_discount, 0) > 0) OR (pr.discount_type <> 'AMOUNT' AND pr.porcentaje_descuento > 0)"
                : 'pr.porcentaje_descuento > 0'}
                  )
                  AND pr.fecha_inicio <= NOW()
                  AND pr.fecha_fin >= NOW()
                  AND COALESCE(pr.audience_scope, 'ALL') = 'ALL'
                  AND (
                    COALESCE(pr.product_scope, 'GLOBAL') = 'GLOBAL'
                    OR EXISTS (SELECT 1 FROM promocionproductos pp WHERE pp.promocion_id = pr.id)
                    ${genderOr}
                    OR EXISTS (SELECT 1 FROM productos p WHERE p.promocion_id = pr.id)
                  )
                ORDER BY ${advancedReady ? 'pr.priority DESC, COALESCE(pr.amount_discount, 0) DESC, pr.porcentaje_descuento DESC,' : 'pr.porcentaje_descuento DESC,'} pr.creado_en DESC
            `);
            res.status(200).json(rows);
            return;
        }
        const [rows] = await database_1.pool.query(`
            SELECT pr.id, pr.nombre, pr.descripcion, pr.porcentaje_descuento${advancedReady ? ', pr.discount_type, pr.amount_discount, pr.priority' : ''}, pr.fecha_inicio, pr.fecha_fin, pr.activo
            FROM promociones pr
            WHERE pr.activo = true
              AND (
                ${advancedReady
            ? "(pr.discount_type = 'AMOUNT' AND COALESCE(pr.amount_discount, 0) > 0) OR (pr.discount_type <> 'AMOUNT' AND pr.porcentaje_descuento > 0)"
            : 'pr.porcentaje_descuento > 0'}
              )
              AND pr.fecha_inicio <= NOW()
              AND pr.fecha_fin >= NOW()
              AND EXISTS (
                SELECT 1
                FROM productos p
                WHERE p.promocion_id = pr.id
                  AND p.stock > 0
              )
            ORDER BY ${advancedReady ? 'pr.priority DESC, COALESCE(pr.amount_discount, 0) DESC, pr.porcentaje_descuento DESC,' : 'pr.porcentaje_descuento DESC,'} pr.creado_en DESC
        `);
        res.status(200).json(rows);
    }
    catch (error) {
        console.error('Error fetching promos:', error);
        res.status(500).json({ error: 'Error al obtener promociones' });
    }
};
exports.getPromotions = getPromotions;
const getPromotionsAdmin = async (_req, res) => {
    try {
        const assignmentReady = await detectPromotionAssignmentSchema();
        const mediaReady = await detectPromotionMediaSchema();
        const advancedReady = await detectPromotionAdvancedSchema();
        if (assignmentReady) {
            const [rows] = await database_1.pool.query(`
                SELECT
                    pr.id,
                    pr.nombre,
                    pr.descripcion,
                    ${mediaReady ? 'pr.imagen_url,' : ''}
                    pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : ''}
                    pr.fecha_inicio,
                    pr.fecha_fin,
                    pr.activo,
                    pr.product_scope,
                    ${mediaReady ? 'pr.product_gender,' : ''}
                    pr.audience_scope,
                    pr.audience_segment,
                    COALESCE((SELECT GROUP_CONCAT(pp.producto_id) FROM promocionproductos pp WHERE pp.promocion_id = pr.id), '') AS product_ids,
                    COALESCE((SELECT GROUP_CONCAT(pu.usuario_id) FROM promocionusuarios pu WHERE pu.promocion_id = pr.id), '') AS audience_user_ids
                FROM promociones pr
                ORDER BY ${advancedReady ? 'pr.priority DESC,' : ''} pr.creado_en DESC
            `);
            // MariaDB workaround: parse GROUP_CONCAT strings into arrays
            const formatted = rows.map(r => ({
                ...r,
                product_ids: r.product_ids ? String(r.product_ids).split(',') : [],
                audience_user_ids: r.audience_user_ids ? String(r.audience_user_ids).split(',') : []
            }));
            res.status(200).json(formatted);
            return;
        }
        const [rows] = await database_1.pool.query(`
            SELECT id, nombre, descripcion, porcentaje_descuento${advancedReady ? ', discount_type, amount_discount, priority' : ''}, fecha_inicio, fecha_fin, activo
            FROM promociones
            ORDER BY ${advancedReady ? 'priority DESC,' : ''} creado_en DESC
        `);
        res.status(200).json(rows);
    }
    catch (error) {
        console.error('Error fetching promos admin:', error);
        res.status(500).json({ error: 'Error al obtener promociones' });
    }
};
exports.getPromotionsAdmin = getPromotionsAdmin;
const updatePromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, discount_type, porcentaje_descuento, amount_discount, priority, fecha_inicio, fecha_fin, activo, product_scope, product_ids, product_gender, audience_scope, audience_segment, audience_user_ids } = req.body;
        const assignmentReady = await detectPromotionAssignmentSchema();
        const mediaReady = await detectPromotionMediaSchema();
        const advancedReady = await detectPromotionAdvancedSchema();
        const categoriesOk = await detectCategoriesSchema();
        if (!assignmentReady) {
            res.status(400).json({ error: 'Tu base de datos no soporta reglas de asignacion de promociones. Aplica la migracion primero.' });
            return;
        }
        if (!mediaReady && (req.file || product_scope === 'GENDER')) {
            res.status(400).json({ error: 'Tu base de datos no soporta imagen o filtro por genero. Ejecuta la migracion 20260312_promotions_image_and_gender.sql.' });
            return;
        }
        const wantsAdvanced = typeof discount_type === 'string' ||
            amount_discount !== undefined ||
            priority !== undefined;
        if (wantsAdvanced && !advancedReady) {
            res.status(400).json({
                error: 'Tu base de datos no soporta descuento fijo/prioridad. Ejecuta database/migrations/20260312_promotions_amount_and_priority.sql en Supabase.'
            });
            return;
        }
        let imagen_url = undefined;
        if (mediaReady && req.file) {
            const file = req.file;
            const uniqueFilename = (0, upload_middleware_1.sanitizeFilename)(file.originalname);
            const { error } = await supabase_1.supabase.storage
                .from('perfumissimo_bucket')
                .upload(`promotions/${uniqueFilename}`, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });
            if (error)
                throw new Error('Error subiendo imagen de promocion a Supabase: ' + error.message);
            const { data: publicData } = supabase_1.supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(`promotions/${uniqueFilename}`);
            imagen_url = publicData.publicUrl;
        }
        const connection = await database_1.pool.getConnection();
        try {
            await connection.beginTransaction();
            const updates = [];
            const params = [];
            const dtype = advancedReady ? String(discount_type || 'PERCENT').toUpperCase() : 'PERCENT';
            const pct = dtype === 'AMOUNT' ? 0 : Number(porcentaje_descuento || 0);
            const amount = dtype === 'AMOUNT' ? Number(amount_discount || 0) : null;
            const prio = advancedReady ? Number(priority || 0) : 0;
            if (nombre !== undefined) {
                updates.push('nombre = ?');
                params.push(nombre);
            }
            if (descripcion !== undefined) {
                updates.push('descripcion = ?');
                params.push(descripcion);
            }
            if (imagen_url !== undefined) {
                updates.push('imagen_url = ?');
                params.push(imagen_url);
            }
            if (porcentaje_descuento !== undefined || discount_type !== undefined || amount_discount !== undefined) {
                updates.push('porcentaje_descuento = ?');
                params.push(pct);
                if (advancedReady) {
                    updates.push('discount_type = ?');
                    params.push(dtype);
                    updates.push('amount_discount = ?');
                    params.push(amount);
                }
            }
            if (advancedReady && priority !== undefined) {
                updates.push('priority = ?');
                params.push(prio);
            }
            if (fecha_inicio !== undefined) {
                updates.push('fecha_inicio = ?');
                params.push(fecha_inicio);
            }
            if (fecha_fin !== undefined) {
                updates.push('fecha_fin = ?');
                params.push(fecha_fin);
            }
            if (activo !== undefined) {
                const activeParsed = parseBoolean(activo, undefined);
                if (activeParsed !== undefined) {
                    updates.push('activo = ?');
                    params.push(activeParsed);
                }
            }
            if (product_scope !== undefined) {
                updates.push('product_scope = ?');
                params.push(product_scope);
            }
            if (mediaReady) {
                if (product_gender !== undefined && (product_scope === undefined || product_scope === 'GENDER')) {
                    const normalized = product_gender ? slugify(String(product_gender)) : '';
                    if (product_scope === 'GENDER' || (product_scope === undefined && normalized)) {
                        if (!normalized) {
                            await connection.rollback();
                            connection.release();
                            res.status(400).json({ error: 'Debes seleccionar una categoria' });
                            return;
                        }
                        if (categoriesOk) {
                            const exists = await ensureCategoryExists(normalized);
                            if (!exists) {
                                await connection.rollback();
                                connection.release();
                                res.status(400).json({ error: 'Categoria invalida. Crea la categoria primero en Admin > Categorias.' });
                                return;
                            }
                        }
                    }
                    updates.push('product_gender = ?');
                    params.push(normalized || null);
                }
                if (product_scope !== undefined && product_scope !== 'GENDER') {
                    updates.push('product_gender = ?');
                    params.push(null);
                }
            }
            if (audience_scope !== undefined) {
                updates.push('audience_scope = ?');
                params.push(audience_scope);
            }
            if (audience_segment !== undefined) {
                updates.push('audience_segment = ?');
                params.push(audience_segment || null);
            }
            if (updates.length > 0) {
                params.push(id);
                const query = `UPDATE promociones SET ${updates.join(', ')} WHERE id = ?`;
                const [result] = await connection.query(query, params);
                const affected = Number(result?.affectedRows ?? 0);
                if (affected === 0) {
                    await connection.rollback();
                    res.status(404).json({ error: 'Promocion no encontrada' });
                    return;
                }
            }
            // Reemplazar asignacion de productos si viene en el payload
            if (product_scope !== undefined) {
                if (product_scope === 'GLOBAL') {
                    await connection.query('DELETE FROM promocionproductos WHERE promocion_id = ?', [id]);
                }
                if (product_scope === 'SPECIFIC') {
                    if (!Array.isArray(product_ids) || product_ids.length === 0) {
                        await connection.rollback();
                        res.status(400).json({ error: 'Debes seleccionar al menos un producto' });
                        return;
                    }
                    await connection.query('DELETE FROM promocionproductos WHERE promocion_id = ?', [id]);
                    for (const pid of product_ids) {
                        await connection.query('INSERT IGNORE INTO promocionproductos (promocion_id, producto_id) VALUES (?, ?)', [id, pid]);
                    }
                }
                if (product_scope === 'GENDER') {
                    await connection.query('DELETE FROM promocionproductos WHERE promocion_id = ?', [id]);
                }
            }
            // Reemplazar asignacion de usuarios si viene en el payload
            if (audience_scope !== undefined) {
                if (audience_scope === 'ALL' || audience_scope === 'SEGMENT') {
                    await connection.query('DELETE FROM promocionusuarios WHERE promocion_id = ?', [id]);
                }
                if (audience_scope === 'CUSTOMERS') {
                    if (!Array.isArray(audience_user_ids) || audience_user_ids.length === 0) {
                        await connection.rollback();
                        res.status(400).json({ error: 'Debes seleccionar al menos un cliente' });
                        return;
                    }
                    await connection.query('DELETE FROM promocionusuarios WHERE promocion_id = ?', [id]);
                    for (const uid of audience_user_ids) {
                        await connection.query('INSERT IGNORE INTO promocionusuarios (promocion_id, usuario_id) VALUES (?, ?)', [id, uid]);
                    }
                }
            }
            await connection.commit();
        }
        catch (e) {
            await connection.rollback();
            throw e;
        }
        finally {
            connection.release();
        }
        res.status(200).json({ message: 'Promocion actualizada exitosamente' });
    }
    catch (error) {
        console.error('Error updating promo:', error);
        res.status(500).json({ error: 'Error al actualizar promocion' });
    }
};
exports.updatePromotion = updatePromotion;
const updatePromotionActive = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;
        const activeParsed = parseBoolean(activo, undefined);
        if (activeParsed === undefined) {
            res.status(400).json({ error: 'Valor de activo inválido' });
            return;
        }
        const [result] = await database_1.pool.query('UPDATE promociones SET activo = ? WHERE id = ?', [activeParsed, id]);
        const affected = Number(result?.affectedRows ?? 0);
        if (!affected) {
            res.status(404).json({ error: 'Promocion no encontrada' });
            return;
        }
        res.status(200).json({ message: 'Estado actualizado', activo: activeParsed });
    }
    catch (error) {
        console.error('Error updating promo active:', error);
        res.status(500).json({ error: 'Error al actualizar estado de la promocion' });
    }
};
exports.updatePromotionActive = updatePromotionActive;
const deletePromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await database_1.pool.query(`DELETE FROM promociones WHERE id = ?`, [id]);
        const affected = Number(result?.affectedRows ?? result?.rowCount ?? 0);
        if (affected === 0) {
            res.status(404).json({ error: 'Promocion no encontrada' });
            return;
        }
        res.status(200).json({ message: 'Promocion eliminada exitosamente' });
    }
    catch (error) {
        console.error('Error deleting promo:', error);
        res.status(500).json({ error: 'Error al eliminar promocion' });
    }
};
exports.deletePromotion = deletePromotion;
// ─────────────────────────────────────────────────────────────────────────────
// Floating Promotions Button metrics
// ─────────────────────────────────────────────────────────────────────────────
const trackPromotionsFabClick = async (_req, res) => {
    try {
        const supported = await detectPromoFabClicksColumn();
        if (!supported) {
            res.status(400).json({
                error: 'Tu base de datos no soporta metrics de clicks del boton flotante. Ejecuta backend/database/migrations/20260330_promotions_fab_clicks_mysql.sql (MySQL) o backend/database/migrations/20260330_promotions_fab_clicks.sql (Postgres).'
            });
            return;
        }
        await database_1.pool.query('UPDATE configuracionglobal SET promotions_fab_clicks = COALESCE(promotions_fab_clicks, 0) + 1 WHERE id = 1');
        const [rows] = await database_1.pool.query('SELECT COALESCE(promotions_fab_clicks, 0) AS clicks FROM configuracionglobal WHERE id = 1');
        const clicks = Number(rows?.[0]?.clicks || 0);
        res.status(200).json({ ok: true, clicks: Number.isFinite(clicks) ? clicks : 0 });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message || 'No se pudo registrar click' });
    }
};
exports.trackPromotionsFabClick = trackPromotionsFabClick;
const getPromotionsFabMetrics = async (_req, res) => {
    try {
        const supported = await detectPromoFabClicksColumn();
        if (!supported) {
            res.status(400).json({
                error: 'Tu base de datos no soporta metrics de clicks del boton flotante. Ejecuta backend/database/migrations/20260330_promotions_fab_clicks_mysql.sql (MySQL) o backend/database/migrations/20260330_promotions_fab_clicks.sql (Postgres).'
            });
            return;
        }
        const [rows] = await database_1.pool.query('SELECT COALESCE(promotions_fab_clicks, 0) AS clicks FROM configuracionglobal WHERE id = 1');
        const clicks = Number(rows?.[0]?.clicks || 0);
        res.status(200).json({ ok: true, clicks: Number.isFinite(clicks) ? clicks : 0 });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message || 'No se pudo obtener metrics' });
    }
};
exports.getPromotionsFabMetrics = getPromotionsFabMetrics;
