import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getFavorites, toggleFavorite } from '../controllers/favoritesController.js';

const router = express.Router();

router.get('/', authenticateToken, getFavorites);
router.post('/toggle', authenticateToken, toggleFavorite);

export default router;
