import { Hono } from 'hono';

import { authenticateToken, authorizeResourceOperator } from '../middleware/auth.js';
import {
    getResourceTranslations,
    regenerateResourceTranslations,
    updateResourceTranslation,
} from '../controllers/resourceTranslationsController.js';

const router = new Hono();

router.use('*', authenticateToken, authorizeResourceOperator());

router.get('/:type/:id', getResourceTranslations);
router.put('/:type/:id/:locale', updateResourceTranslation);
router.post('/:type/:id/regenerate', regenerateResourceTranslations);

export default router;
