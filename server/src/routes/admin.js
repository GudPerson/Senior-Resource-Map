import { Hono } from 'hono';
import * as workbookController from '../controllers/workbookController.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authenticateToken, isAdmin);

router.get('/workbooks/:resourceType/template', workbookController.downloadWorkbookTemplate);
router.get('/workbooks/:resourceType/export', workbookController.exportWorkbookData);
router.post('/imports/:resourceType', workbookController.importWorkbookData);

export default router;
