"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleAuthSchema = exports.registerSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().min(1, 'Email es requerido').email('Email inválido'),
    password: zod_1.z.string().min(1, 'Contraseña es requerida')
});
exports.registerSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2, 'Nombre debe tener al menos 2 caracteres').max(100),
    apellido: zod_1.z.string().min(2, 'Apellido debe tener al menos 2 caracteres').max(100),
    telefono: zod_1.z.string().min(10, 'Teléfono debe tener al menos 10 dígitos').max(20),
    email: zod_1.z.string().min(1, 'Email es requerido').email('Email inválido'),
    password: zod_1.z.string().min(6, 'Contraseña debe tener al menos 6 caracteres').max(100)
});
exports.googleAuthSchema = zod_1.z.object({
    credential: zod_1.z.string().min(1, 'Token de Google es requerido')
});
