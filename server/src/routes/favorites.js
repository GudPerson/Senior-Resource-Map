import { Hono } from 'hono';
import { authenticateToken } from '../middleware/auth.js';
import {
    bulkRemoveUnusedFavorites,
    getFavoriteMapUsage,
    getFavorites,
    toggleFavorite,
} from '../controllers/favoritesController.js';

const router = new Hono();

router.get('/', authenticateToken, getFavorites);
router.get('/map-usage', authenticateToken, getFavoriteMapUsage);
router.post('/bulk-remove-unused', authenticateToken, bulkRemoveUnusedFavorites);
router.post('/toggle', authenticateToken, toggleFavorite);

export default router;
