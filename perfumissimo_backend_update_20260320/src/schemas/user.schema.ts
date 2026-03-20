import { z } from 'zod';

export const updateUserRoleSchema = z.object({
    rol: z.enum(['SUPERADMIN', 'ADMIN', 'VENTAS', 'PRODUCTOS', 'CUSTOMER'])
});

export const updateUserSegmentSchema = z.object({
    segmento: z.string().max(100).optional().nullable()
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserSegmentInput = z.infer<typeof updateUserSegmentSchema>;
