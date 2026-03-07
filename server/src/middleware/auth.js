import { verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';

const getSecret = (c) => c.env.JWT_SECRET || 'seniorcare-secret-key';

export async function authenticateToken(c, next) {
    const token = getCookie(c, 'sc_token');

    if (!token) {
        console.log('[Auth] No token cookie found');
        return c.json({ error: 'No token provided' }, 401);
    }

    try {
        const secret = getSecret(c);
        // console.log('[Auth] Verifying token with secret length:', secret?.length);
        const user = await verify(token, secret);
        c.set('user', user);
        await next();
    } catch (err) {
        console.error('[Auth] JWT Verification failed:', err.message);
        // Temporarily expose the error message to the client for debugging
        return c.json({ error: `Invalid token: ${err.message}` }, 403);
    }
}

export async function optionalAuth(c, next) {
    const token = getCookie(c, 'sc_token');

    if (token) {
        try {
            const user = await verify(token, getSecret(c));
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

        const { role, subregionId } = user;

        if (!allowedRoles.includes(role)) {
            return c.json({ error: 'Insufficient permissions' }, 403);
        }

        if (role === 'super_admin') {
            await next();
            return;
        }

        if (role === 'regional_admin' || role === 'partner') {
            if (!subregionId) {
                return c.json({ error: 'Account missing required scope (subregion_id)' }, 403);
            }
            c.set('subregionScope', subregionId);
        }

        await next();
    };
}

export async function isAdmin(c, next) {
    const user = c.get('user');
    if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
        return c.json({ error: 'Requires admin privileges' }, 403);
    }
    await next();
}
