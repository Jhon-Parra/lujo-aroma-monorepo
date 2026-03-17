import { Router } from 'express';
import { generateAIDescription } from '../controllers/ai.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { generateDescriptionSchema } from '../schemas/ai.schema';

const router = Router();

router.post('/generate-description', verifyToken, validate(generateDescriptionSchema), generateAIDescription);

export default router;
