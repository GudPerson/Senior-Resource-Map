import { Hono } from 'hono';

import { authenticateToken, authorizeResourceOperator } from '../middleware/auth.js';
import {
    createSoftAssetParent,
    deleteSoftAssetParent,
    generateSoftAssetChildren,
    getSoftAssetParentById,
    getSoftAssetParentChildren,
    getSoftAssetParents,
    updateSoftAssetParent,
} from '../controllers/softAssetParentsController.js';

const router = new Hono();

router.use('*', authenticateToken, authorizeResourceOperator());

router.get('/', getSoftAssetParents);
router.post('/', createSoftAssetParent);
router.get('/:id', getSoftAssetParentById);
router.put('/:id', updateSoftAssetParent);
router.delete('/:id', deleteSoftAssetParent);
router.get('/:id/children', getSoftAssetParentChildren);
router.post('/:id/generate-children', generateSoftAssetChildren);

export default router;
