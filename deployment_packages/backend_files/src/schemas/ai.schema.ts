import { z } from 'zod';

export const generateDescriptionSchema = z.object({
    nombre: z.string().min(1, 'Nombre del producto es requerido').max(200),
    notas_olfativas: z.string().min(1, 'Notas olfativas son requeridas').max(255)
});

export type GenerateDescriptionInput = z.infer<typeof generateDescriptionSchema>;
