import { Hono } from 'hono';

import { authenticateToken } from '../middleware/auth.js';
import {
    deletePrivateResourceFile,
    downloadPrivateResourceFile,
    getPrivateResourceAccessCandidates,
    getPrivateResourceContent,
    updatePrivateResourceContent,
    uploadPrivateResourceFile,
} from '../controllers/privateResourceContentController.js';

const router = new Hono();

router.use('*', authenticateToken);

router.get('/:type/:id', getPrivateResourceContent);
router.put('/:type/:id', updatePrivateResourceContent);
router.get('/:type/:id/access-candidates', getPrivateResourceAccessCandidates);
router.post('/:type/:id/files', uploadPrivateResourceFile);
router.get('/:type/:id/files/:fileId/download', downloadPrivateResourceFile);
router.delete('/:type/:id/files/:fileId', deletePrivateResourceFile);

export default router;
