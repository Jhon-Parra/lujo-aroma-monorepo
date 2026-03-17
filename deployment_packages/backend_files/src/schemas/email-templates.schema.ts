import { z } from 'zod';

export const updateOrderEmailTemplateSchema = z.object({
    subject: z.string().min(3).max(200),
    body_text: z.string().min(20).max(20000),
    body_html: z.string().max(20000).optional().or(z.literal(''))
});

export type UpdateOrderEmailTemplateInput = z.infer<typeof updateOrderEmailTemplateSchema>;
