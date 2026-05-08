import { Hono } from 'hono';

import * as phoneIdentitiesController from '../controllers/phoneIdentitiesController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authenticateToken);

router.get('/me', phoneIdentitiesController.getCurrentPhoneIdentity);
router.delete('/me', phoneIdentitiesController.unlinkCurrentPhoneIdentity);
router.post('/link/start', phoneIdentitiesController.startPhoneLink);
router.get('/link/:attemptId', phoneIdentitiesController.getPhoneLinkAttempt);

export default router;
