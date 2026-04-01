"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDescriptionSchema = void 0;
const zod_1 = require("zod");
exports.generateDescriptionSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, 'Nombre del producto es requerido').max(200),
    notas_olfativas: zod_1.z.string().min(1, 'Notas olfativas son requeridas').max(255)
});
