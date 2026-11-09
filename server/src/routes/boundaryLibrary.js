import { Hono } from 'hono';
import { authenticateToken } from '../middleware/auth.js';
import { privateBoundaryHeaders } from '../utils/boundaryRequests.js';
import { getBoundaryLibraryItem, listBoundaryLibrary, postBoundaryLibrary, retireBoundaryLibraryItem } from '../controllers/boundaryLibraryController.js';

const router = new Hono();
router.use('*', privateBoundaryHeaders, authenticateToken);
router.get('/', listBoundaryLibrary);
router.post('/', postBoundaryLibrary);
router.get('/:id', getBoundaryLibraryItem);
router.delete('/:id', retireBoundaryLibraryItem);
export default router;
