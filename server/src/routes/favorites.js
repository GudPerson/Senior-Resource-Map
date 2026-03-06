import { Hono } from 'hono';
import { authenticateToken } from '../middleware/auth.js';
import { getFavorites, toggleFavorite } from '../controllers/favoritesController.js';

const router = new Hono();

router.get('/', authenticateToken, getFavorites);
router.post('/toggle', authenticateToken, toggleFavorite);

export default router;
