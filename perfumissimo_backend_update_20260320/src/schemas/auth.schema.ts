import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().min(1, 'Email es requerido').email('Email inválido'),
    password: z.string().min(1, 'Contraseña es requerida')
});

export const registerSchema = z.object({
    nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres').max(100),
    apellido: z.string().min(2, 'Apellido debe tener al menos 2 caracteres').max(100),
    telefono: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos').max(20),
    email: z.string().min(1, 'Email es requerido').email('Email inválido'),
    password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres').max(100)
});

export const googleAuthSchema = z.object({
    credential: z.string().min(1, 'Token de Google es requerido')
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
