import { shouldRejectManagedResourceListRequest } from '../utils/resourceListScope.js';

export function requireManagedResourceListAuth() {
    return async (c, next) => {
        if (shouldRejectManagedResourceListRequest(c.req.query('scope'), c.get('user'))) {
            return c.json({ error: 'No token provided' }, 401);
        }

        await next();
    };
}
