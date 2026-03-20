import { z } from 'zod';

export const orderItemSchema = z.object({
    producto_id: z.string().uuid('ID de producto inválido'),
    cantidad: z.number().int().positive('Cantidad debe ser mayor a 0')
});

export const createOrderSchema = z.object({
    direccion_envio: z.string().min(1, 'Dirección de envío es requerida'),
    detalles: z.array(orderItemSchema).min(1, 'Debe incluir al menos un producto')
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
