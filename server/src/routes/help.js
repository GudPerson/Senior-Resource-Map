import { Hono } from 'hono';

import { askHelpQuestion } from '../controllers/helpController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = new Hono();

router.post('/ask', optionalAuth, askHelpQuestion);

export default router;
