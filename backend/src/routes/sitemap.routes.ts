import { Router } from 'express';
import { getSitemap } from '../controllers/sitemap.controller';

const router = Router();

router.get('/', getSitemap);

export default router;
