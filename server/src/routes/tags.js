import { Hono } from 'hono';
import { getTags } from '../controllers/tagsController.js';

const router = new Hono();

router.get('/', getTags);

export default router;
