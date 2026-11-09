import { Hono } from 'hono';
import { authenticateToken } from '../middleware/auth.js';
import { privateBoundaryHeaders } from '../utils/boundaryRequests.js';
import { boundaryZoneJobHandler } from '../controllers/boundaryZoneJobsController.js';

export function createBoundaryZoneJobRoutes(options = {}) {
    const router = new Hono(), handler = action => boundaryZoneJobHandler(action, options);
    router.use('*', privateBoundaryHeaders, authenticateToken);
    router.get('/', handler('list'));
    router.post('/', handler('start'));
    router.get('/:id', handler('get'));
    router.get('/:id/rows/:rowKey/source', handler('source'));
    for (const action of ['advance', 'pause', 'resume', 'cancel', 'commit'])
        router.post('/:id/' + action, handler(action));
    return router;
}
export default createBoundaryZoneJobRoutes();
