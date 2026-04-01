"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrderSchema = exports.orderItemSchema = void 0;
const zod_1 = require("zod");
exports.orderItemSchema = zod_1.z.object({
    producto_id: zod_1.z.string().uuid('ID de producto inválido'),
    cantidad: zod_1.z.number().int().positive('Cantidad debe ser mayor a 0')
});
exports.createOrderSchema = zod_1.z.object({
    direccion_envio: zod_1.z.string().min(1, 'Dirección de envío es requerida'),
    detalles: zod_1.z.array(exports.orderItemSchema).min(1, 'Debe incluir al menos un producto')
});
