"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePromotionActiveSchema = exports.createPromotionSchema = void 0;
const zod_1 = require("zod");
const parseUuidArray = (value) => {
    if (value === undefined || value === null)
        return undefined;
    if (Array.isArray(value))
        return value.map(String);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return [];
        // Aceptar JSON (["uuid", ...]) o lista separada por coma/espacio/nueva linea
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed))
                    return parsed.map(String);
            }
            catch {
                // continuar con split
            }
        }
        return trimmed
            .split(/\s|,|;/)
            .map(s => s.trim())
            .filter(Boolean);
    }
    return undefined;
};
const parseBooleanStrict = (value) => {
    if (value === undefined || value === null)
        return undefined;
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return value === 1 ? true : value === 0 ? false : undefined;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (v === 'true' || v === '1' || v === 'yes')
            return true;
        if (v === 'false' || v === '0' || v === 'no')
            return false;
    }
    return undefined;
};
exports.createPromotionSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, 'Nombre es requerido').max(100),
    descripcion: zod_1.z.string().optional(),
    discount_type: zod_1.z.enum(['PERCENT', 'AMOUNT']).default('PERCENT'),
    porcentaje_descuento: zod_1.z.coerce.number().min(0, 'Porcentaje mínimo es 0').max(100, 'Porcentaje máximo es 100'),
    amount_discount: zod_1.z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : v), zod_1.z.coerce.number().min(0, 'Monto mínimo es 0').optional()),
    priority: zod_1.z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : v), zod_1.z.coerce.number().int().min(0).max(1000).optional()),
    fecha_inicio: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), 'Fecha de inicio inválida'),
    fecha_fin: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), 'Fecha de fin inválida'),
    // Reglas de asignacion
    product_scope: zod_1.z.enum(['GLOBAL', 'SPECIFIC', 'GENDER']).default('GLOBAL'),
    product_gender: zod_1.z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : v), zod_1.z.string().min(1).max(120).optional()),
    product_ids: zod_1.z.preprocess(parseUuidArray, zod_1.z.array(zod_1.z.string().uuid()).optional()),
    audience_scope: zod_1.z.enum(['ALL', 'SEGMENT', 'CUSTOMERS']).default('ALL'),
    audience_segment: zod_1.z.string().min(1).max(100).optional(),
    audience_user_ids: zod_1.z.preprocess(parseUuidArray, zod_1.z.array(zod_1.z.string().uuid()).optional()),
    activo: zod_1.z.preprocess(parseBooleanStrict, zod_1.z.boolean().optional())
}).refine((data) => new Date(data.fecha_fin) > new Date(data.fecha_inicio), {
    message: 'Fecha fin debe ser mayor a fecha inicio',
    path: ['fecha_fin']
}).refine((data) => {
    // Validar que exista un descuento real
    if (data.discount_type === 'AMOUNT') {
        return typeof data.amount_discount === 'number' && data.amount_discount > 0;
    }
    return typeof data.porcentaje_descuento === 'number' && data.porcentaje_descuento > 0;
}, {
    message: 'Debes indicar un descuento válido (porcentaje o monto)',
    path: ['discount_type']
}).refine((data) => {
    if (data.product_scope === 'SPECIFIC') {
        return Array.isArray(data.product_ids) && data.product_ids.length > 0;
    }
    return true;
}, {
    message: 'Debes seleccionar al menos un producto',
    path: ['product_ids']
}).refine((data) => {
    if (data.product_scope === 'GENDER') {
        return typeof data.product_gender === 'string' && data.product_gender.trim().length > 0;
    }
    return true;
}, {
    message: 'Debes seleccionar una categoria',
    path: ['product_gender']
}).refine((data) => {
    if (data.audience_scope === 'SEGMENT') {
        return typeof data.audience_segment === 'string' && data.audience_segment.trim().length > 0;
    }
    if (data.audience_scope === 'CUSTOMERS') {
        return Array.isArray(data.audience_user_ids) && data.audience_user_ids.length > 0;
    }
    return true;
}, {
    message: 'Debes completar el publico objetivo',
    path: ['audience_scope']
});
exports.updatePromotionActiveSchema = zod_1.z.object({
    activo: zod_1.z.preprocess(parseBooleanStrict, zod_1.z.boolean())
});
