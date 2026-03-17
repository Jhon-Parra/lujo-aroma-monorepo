import { Router } from 'express';
import { login, googleLogin, register, refreshToken, logout } from '../controllers/auth.controller';
import { validate } from '../middleware/validation.middleware';
import { loginSchema, registerSchema, googleAuthSchema } from '../schemas/auth.schema';

const router = Router();

router.post('/login', validate(loginSchema), login);

router.post('/google', validate(googleAuthSchema), googleLogin);

router.post('/register', validate(registerSchema), register);

router.post('/refresh', refreshToken);

router.post('/logout', logout);

export default router;
