import { Router } from 'express';
import { getInstagramMedia } from '../controllers/social.controller';

const router = Router();

router.get('/instagram/media', getInstagramMedia);

export default router;
