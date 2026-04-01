"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProductSchema = exports.createProductSchema = void 0;
const zod_1 = require("zod");
const stringOptional = zod_1.z.string().optional();
const stringMin2Optional = zod_1.z.string().min(2).optional();
const stringMin10Optional = zod_1.z.string().min(10).optional();
const booleanOptional = zod_1.z.preprocess((val) => {
    if (val === undefined || val === null)
        return undefined;
    if (typeof val === 'boolean')
        return val;
    if (typeof val === 'number') {
        if (val === 1)
            return true;
        if (val === 0)
            return false;
        return undefined;
    }
    if (typeof val === 'string') {
        const v = val.trim().toLowerCase();
        if (v === '')
            return undefined;
        if (v === 'true' || v === '1' || v === 'yes' || v === 'on')
            return true;
        if (v === 'false' || v === '0' || v === 'no' || v === 'off')
            return false;
        return undefined;
    }
    return undefined;
}, zod_1.z.boolean()).optional();
exports.createProductSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2, 'Nombre debe tener al menos 2 caracteres').max(200),
    genero: zod_1.z.string().min(1).max(120).optional(),
    casa: zod_1.z.string().max(120).optional(),
    descripcion: zod_1.z.string().min(10, 'Descripción debe tener al menos 10 caracteres'),
    notas_olfativas: stringOptional,
    notas: stringOptional,
    precio: zod_1.z.coerce.number().min(0, 'Precio debe ser positivo'),
    stock: zod_1.z.coerce.number().int().min(0, 'Stock no puede ser negativo').optional(),
    unidades_vendidas: zod_1.z.coerce.number().int().min(0).optional(),
    es_nuevo: booleanOptional,
    nuevo_hasta: zod_1.z.preprocess((val) => {
        if (val === undefined || val === null)
            return undefined;
        if (typeof val === 'string' && val.trim() === '')
            return undefined;
        return val;
    }, zod_1.z.string().max(40).optional())
});
exports.updateProductSchema = zod_1.z.object({
    nombre: stringMin2Optional,
    genero: zod_1.z.string().min(1).max(120).optional(),
    casa: zod_1.z.string().max(120).optional(),
    descripcion: stringMin10Optional.or(zod_1.z.literal('')),
    notas_olfativas: stringOptional,
    notas: stringOptional,
    precio: zod_1.z.coerce.number().min(0).optional(),
    stock: zod_1.z.coerce.number().int().min(0).optional(),
    es_nuevo: booleanOptional,
    // permitir '' para limpiar la fecha
    nuevo_hasta: zod_1.z.preprocess((val) => {
        if (val === undefined || val === null)
            return undefined;
        if (typeof val === 'string' && val.trim() === '')
            return '';
        return val;
    }, zod_1.z.union([zod_1.z.string().max(40), zod_1.z.literal('')]).optional())
});
