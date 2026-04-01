"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendationEventSchema = exports.recommendationSimilarSchema = exports.recommendationFreeSchema = exports.recommendationQuizSchema = void 0;
const zod_1 = require("zod");
const emptyToUndefined = (v) => {
    if (v === undefined || v === null)
        return undefined;
    if (typeof v === 'string' && v.trim() === '')
        return undefined;
    return v;
};
exports.recommendationQuizSchema = zod_1.z.object({
    session_id: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().max(120).optional()),
    answers: zod_1.z.object({
        for_who: zod_1.z.enum(['hombre', 'mujer', 'unisex']).optional(),
        aroma: zod_1.z.enum(['dulce', 'fresco', 'amaderado', 'floral', 'citrico', 'oriental']).optional(),
        occasion: zod_1.z.enum(['diario', 'trabajo', 'fiesta', 'citas', 'eventos']).optional(),
        intensity: zod_1.z.enum(['suave', 'moderada', 'fuerte']).optional(),
        climate: zod_1.z.enum(['calido', 'templado', 'frio']).optional()
    })
});
exports.recommendationFreeSchema = zod_1.z.object({
    session_id: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().max(120).optional()),
    query: zod_1.z.string().min(3).max(400)
});
exports.recommendationSimilarSchema = zod_1.z.object({
    session_id: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().max(120).optional())
});
exports.recommendationEventSchema = zod_1.z.object({
    session_id: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().max(120).optional()),
    event_type: zod_1.z.string().min(2).max(60),
    payload: zod_1.z.any().optional()
});
