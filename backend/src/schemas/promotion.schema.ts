import { z } from 'zod';

const parseUuidArray = (value: unknown): string[] | undefined => {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        // Aceptar JSON (["uuid", ...]) o lista separada por coma/espacio/nueva linea
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.map(String);
            } catch {
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

const parseBooleanStrict = (value: unknown): boolean | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : undefined;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (v === 'true' || v === '1' || v === 'yes') return true;
        if (v === 'false' || v === '0' || v === 'no') return false;
    }
    return undefined;
};

export const createPromotionSchema = z.object({
    nombre: z.string().min(1, 'Nombre es requerido').max(100),
    descripcion: z.string().optional(),
    discount_type: z.enum(['PERCENT', 'AMOUNT']).default('PERCENT'),
    porcentaje_descuento: z.coerce.number().min(0, 'Porcentaje mínimo es 0').max(100, 'Porcentaje máximo es 100'),
    amount_discount: z.preprocess(
        (v) => (v === '' || v === null || v === undefined ? undefined : v),
        z.coerce.number().min(0, 'Monto mínimo es 0').optional()
    ),
    priority: z.preprocess(
        (v) => (v === '' || v === null || v === undefined ? undefined : v),
        z.coerce.number().int().min(0).max(1000).optional()
    ),
    fecha_inicio: z.string().refine((val) => !isNaN(Date.parse(val)), 'Fecha de inicio inválida'),
    fecha_fin: z.string().refine((val) => !isNaN(Date.parse(val)), 'Fecha de fin inválida'),

    // Reglas de asignacion
    product_scope: z.enum(['GLOBAL', 'SPECIFIC', 'GENDER']).default('GLOBAL'),
    product_gender: z.preprocess(
        (v) => (v === '' || v === null || v === undefined ? undefined : v),
        z.string().min(1).max(120).optional()
    ),
    product_ids: z.preprocess(parseUuidArray, z.array(z.string().uuid()).optional()),

    audience_scope: z.enum(['ALL', 'SEGMENT', 'CUSTOMERS']).default('ALL'),
    audience_segment: z.string().min(1).max(100).optional(),
    audience_user_ids: z.preprocess(parseUuidArray, z.array(z.string().uuid()).optional()),

    activo: z.preprocess(parseBooleanStrict, z.boolean().optional())
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

export const updatePromotionActiveSchema = z.object({
    activo: z.preprocess(parseBooleanStrict, z.boolean())
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
