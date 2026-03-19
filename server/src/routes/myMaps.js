import { Hono } from 'hono';

import { authenticateToken } from '../middleware/auth.js';
import {
    deleteMyMap,
    deleteMyMapAsset,
    getMyMap,
    getMyMaps,
    patchMyMap,
    postMyMap,
    postMyMapAsset,
} from '../controllers/myMapsController.js';

const router = new Hono();

router.get('/', authenticateToken, getMyMaps);
router.post('/', authenticateToken, postMyMap);
router.get('/:id', authenticateToken, getMyMap);
router.patch('/:id', authenticateToken, patchMyMap);
router.delete('/:id', authenticateToken, deleteMyMap);
router.post('/:id/assets', authenticateToken, postMyMapAsset);
router.delete('/:id/assets/:resourceType/:resourceId', authenticateToken, deleteMyMapAsset);

export default router;
