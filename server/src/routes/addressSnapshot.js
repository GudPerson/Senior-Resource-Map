import { Hono } from 'hono';
import { authenticateToken } from '../middleware/auth.js';
import { normalizeRole } from '../utils/roles.js';
import { createAddressSnapshotHandlers } from '../controllers/addressSnapshotController.js';

export async function addressSnapshotResponseHeaders(c, next) {
    await next();
    c.header('Cache-Control', 'private, no-store');
    c.header('Pragma', 'no-cache');
    c.header('X-Content-Type-Options', 'nosniff');
    const vary = new Set((c.res.headers.get('Vary') || '').split(',').map(value => value.trim()).filter(Boolean));
    for (const value of ['Origin', 'Cookie', 'Authorization', 'X-Session-Token']) vary.add(value);
    c.header('Vary', [...vary].join(', '));
}

async function requireAddressSnapshotUser(c, next) {
    const user = c.get('user');
    if (!Number.isSafeInteger(user?.id) || user.id <= 0 || normalizeRole(user.role) === 'guest') {
        return c.json({ error: 'Sign in to use address search.', code: 'ADDRESS_SNAPSHOT_ACCESS_DENIED' }, 403);
    }
    await next();
}

export function createAddressSnapshotRoutes(options = {}) {
    const router = new Hono();
    const handlers = createAddressSnapshotHandlers(options);
    router.use('*', addressSnapshotResponseHeaders, authenticateToken, requireAddressSnapshotUser);
    router.get('/metadata', handlers.metadata);
    router.post('/nearby', handlers.nearby);
    router.post('/area', handlers.area);
    return router;
}

export default createAddressSnapshotRoutes();
