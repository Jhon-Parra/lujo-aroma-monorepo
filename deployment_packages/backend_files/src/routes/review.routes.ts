import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createReviewSchema } from '../schemas/review.schema';
import { createReview, getMyReviews, getProductReviews, getProductReviewSummary } from '../controllers/review.controller';

const router = Router();

router.post('/', verifyToken, validate(createReviewSchema), createReview);
router.get('/my', verifyToken, getMyReviews);

router.get('/product/:id', getProductReviews);
router.get('/product/:id/summary', getProductReviewSummary);

export default router;
