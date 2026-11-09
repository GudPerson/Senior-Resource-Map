import { Hono } from 'hono';
import { authenticateToken, authorize } from '../middleware/auth.js';
import { createRegionalDiscoveryGovernanceHandlers } from '../controllers/regionalDiscoveryGovernanceController.js';

export function createRegionalDiscoveryGovernanceRoutes({ getDatabase, authenticate = authenticateToken } = {}) {
    const router = new Hono();
    const handlers = createRegionalDiscoveryGovernanceHandlers(getDatabase);
    router.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
    router.use('*', authenticate, authorize('super_admin'));
    router.get('/subregions/:id/contacts/:field', handlers.getContact);
    router.put('/subregions/:id/contacts/:field', handlers.putContact);
    router.get('/resources/:resourceType/:resourceId/email-grant', handlers.getEmailGrant);
    router.put('/resources/:resourceType/:resourceId/email-grant', handlers.putEmailGrant);
    return router;
}

export default createRegionalDiscoveryGovernanceRoutes();
