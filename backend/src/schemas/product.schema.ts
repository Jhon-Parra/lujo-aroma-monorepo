import { z } from 'zod';

const stringOptional = z.string().optional();
const stringMin2Optional = z.string().min(2).optional();
const stringMin10Optional = z.string().min(10).optional();

const booleanOptional = z.preprocess((val) => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') {
        if (val === 1) return true;
        if (val === 0) return false;
        return undefined;
    }
    if (typeof val === 'string') {
        const v = val.trim().toLowerCase();
        if (v === '') return undefined;
        if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
        if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
        return undefined;
    }
    return undefined;
}, z.boolean()).optional();

export const createProductSchema = z.object({
    nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres').max(200),
    genero: z.string().min(1).max(120).optional(),
    casa: z.string().max(120).optional(),
    descripcion: z.string().min(10, 'Descripción debe tener al menos 10 caracteres'),
    notas_olfativas: stringOptional,
    notas: stringOptional,
    precio: z.coerce.number().min(0, 'Precio debe ser positivo'),
    stock: z.coerce.number().int().min(0, 'Stock no puede ser negativo').optional(),
    unidades_vendidas: z.coerce.number().int().min(0).optional(),
    es_nuevo: booleanOptional,
    nuevo_hasta: z.preprocess((val) => {
        if (val === undefined || val === null) return undefined;
        if (typeof val === 'string' && val.trim() === '') return undefined;
        return val;
    }, z.string().max(40).optional())
});

export const updateProductSchema = z.object({
    nombre: stringMin2Optional,
    genero: z.string().min(1).max(120).optional(),
    casa: z.string().max(120).optional(),
    descripcion: stringMin10Optional.or(z.literal('')),
    notas_olfativas: stringOptional,
    notas: stringOptional,
    precio: z.coerce.number().min(0).optional(),
    stock: z.coerce.number().int().min(0).optional(),
    es_nuevo: booleanOptional,
    // permitir '' para limpiar la fecha
    nuevo_hasta: z.preprocess((val) => {
        if (val === undefined || val === null) return undefined;
        if (typeof val === 'string' && val.trim() === '') return '';
        return val;
    }, z.union([z.string().max(40), z.literal('')]).optional())
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
