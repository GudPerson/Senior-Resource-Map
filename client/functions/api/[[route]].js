import { handle } from 'hono/cloudflare-pages';
import app from '../../../server/src/index.js';

export const onRequest = handle(app);
