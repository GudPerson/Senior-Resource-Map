import { Hono } from 'hono';

import {
    deletePersonalPlaceRoute,
    getPersonalPlaceCategories,
    getPersonalPlaces,
    patchPersonalPlace,
    patchPersonalPlaceCategory,
    postPersonalPlace,
    postPersonalPlaceCategory,
} from '../controllers/personalPlacesController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = new Hono();

router.get('/', authenticateToken, getPersonalPlaces);
router.post('/', authenticateToken, postPersonalPlace);
router.get('/categories', authenticateToken, getPersonalPlaceCategories);
router.post('/categories', authenticateToken, postPersonalPlaceCategory);
router.patch('/categories/:categoryId', authenticateToken, patchPersonalPlaceCategory);
router.patch('/:placeId', authenticateToken, patchPersonalPlace);
router.delete('/:placeId', authenticateToken, deletePersonalPlaceRoute);

export default router;
