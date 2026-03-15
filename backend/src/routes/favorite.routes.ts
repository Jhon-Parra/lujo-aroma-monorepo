import { Router } from 'express';
import { addFavorite, removeFavorite, getFavorites } from '../controllers/favorite.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', verifyToken, getFavorites);

router.post('/', verifyToken, addFavorite);

router.delete('/:productId', verifyToken, removeFavorite);

export default router;
