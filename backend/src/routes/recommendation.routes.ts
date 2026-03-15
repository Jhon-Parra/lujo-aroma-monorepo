import { Router } from 'express';

import { validate } from '../middleware/validation.middleware';
import {
    recommendationQuizSchema,
    recommendationFreeSchema,
    recommendationEventSchema,
    recommendationSimilarSchema
} from '../schemas/recommendation.schema';
import {
    recommendFromQuiz,
    recommendFromFreeText,
    recordRecommendationEvent,
    recommendSimilar
} from '../controllers/recommendation.controller';

const router = Router();

router.post('/quiz', validate(recommendationQuizSchema), recommendFromQuiz);
router.post('/free', validate(recommendationFreeSchema), recommendFromFreeText);
router.post('/events', validate(recommendationEventSchema), recordRecommendationEvent);
router.post('/similar/:id', validate(recommendationSimilarSchema), recommendSimilar);

export default router;
