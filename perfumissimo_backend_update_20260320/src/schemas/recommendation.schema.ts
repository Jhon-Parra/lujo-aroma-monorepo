import { z } from 'zod';

const emptyToUndefined = (v: any) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'string' && v.trim() === '') return undefined;
    return v;
};

export const recommendationQuizSchema = z.object({
    session_id: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
    answers: z.object({
        for_who: z.enum(['hombre', 'mujer', 'unisex']).optional(),
        aroma: z.enum(['dulce', 'fresco', 'amaderado', 'floral', 'citrico', 'oriental']).optional(),
        occasion: z.enum(['diario', 'trabajo', 'fiesta', 'citas', 'eventos']).optional(),
        intensity: z.enum(['suave', 'moderada', 'fuerte']).optional(),
        climate: z.enum(['calido', 'templado', 'frio']).optional()
    })
});

export const recommendationFreeSchema = z.object({
    session_id: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
    query: z.string().min(3).max(400)
});

export const recommendationSimilarSchema = z.object({
    session_id: z.preprocess(emptyToUndefined, z.string().max(120).optional())
});

export const recommendationEventSchema = z.object({
    session_id: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
    event_type: z.string().min(2).max(60),
    payload: z.any().optional()
});

export type RecommendationQuizInput = z.infer<typeof recommendationQuizSchema>;
export type RecommendationFreeInput = z.infer<typeof recommendationFreeSchema>;
export type RecommendationEventInput = z.infer<typeof recommendationEventSchema>;
