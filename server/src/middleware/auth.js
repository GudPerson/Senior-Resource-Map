import { normalizeRole } from '../utils/roles.js';
import { getRequestToken, SESSION_HEADER_NAME, verifySessionToken } from '../utils/sessionAuth.js';

export async function authenticateToken(c, next) {
    const token = getRequestToken(c);
    const hasSessionHeader = Boolean(c.req.header(SESSION_HEADER_NAME));

    if (!token) return c.json({ error: 'No token provided' }, 401);

    try {
        const user = await verifySessionToken(token, c);
        c.set('user', user);
        await next();
    } catch (err) {
        const message = String(err?.message || '').toLowerCase();
        const isExpired = message.includes('expired') || message.includes('exp');

        if (hasSessionHeader) {
            return c.json({
                error: isExpired
                    ? 'User view session expired. Exit User View and reopen the account.'
                    : 'User view token is invalid. Exit User View and reopen the account.',
            }, isExpired ? 401 : 403);
        }

        return c.json({ error: 'Invalid token' }, 403);
    }
}

export async function optionalAuth(c, next) {
    const token = getRequestToken(c);

    if (token) {
        try {
            const user = await verifySessionToken(token, c);
            c.set('user', user);
        } catch {
            // Ignore error
        }
    }

    if (!c.get('user')) {
        c.set('user', { role: 'guest' });
    }

    await next();
}

export function authorize(...allowedRoles) {
    return async (c, next) => {
        const user = c.get('user');
        if (!user) return c.json({ error: 'Unauthorized' }, 401);

        const role = normalizeRole(user.role);
        const { subregionId, subregionIds } = user;

        if (!allowedRoles.map(normalizeRole).includes(role)) {
            return c.json({ error: 'Insufficient permissions' }, 403);
        }

        if (role === 'super_admin') {
            await next();
            return;
        }

        if (role === 'regional_admin' || role === 'partner') {
            const scopedSubregionId = subregionId || subregionIds?.[0];
            if (!scopedSubregionId) {
                return c.json({ error: 'Account missing required scope (subregion_id)' }, 403);
            }
            c.set('subregionScope', scopedSubregionId);
        }

        await next();
    };
}

export async function isAdmin(c, next) {
    const user = c.get('user');
    if (!user || !['super_admin', 'regional_admin', 'partner'].includes(normalizeRole(user.role))) {
        return c.json({ error: 'Requires admin privileges' }, 403);
    }
    await next();
}
