import { normalizeRole } from '../utils/roles.js';
import { getDb } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { users, userSubregions } from '../db/schema.js';
import {
    getActiveHardAssetStaffAccess,
    hasAnyHardAssetStaffAccess,
    loadHardAssetStaffAccessForUser,
} from '../utils/hardAssetStaff.js';
import {
    getPrimaryPartnerStaffAccess,
    hasAnyPartnerStaffAccess,
    loadPartnerStaffAccessForUser,
} from '../utils/partnerStaff.js';
import {
    hasAnySoftAssetStaffAccess,
    loadSoftAssetStaffAccessForUser,
} from '../utils/softAssetAccess.js';
import { loadOrganizationAccessForUser } from '../utils/organizationAccess.js';
import { getRequestToken, SESSION_HEADER_NAME, verifySessionToken } from '../utils/sessionAuth.js';

export async function hydrateLiveAccessForUser(user, options = {}) {
    if (!user?.id) return user;

    const {
        db,
        loadPartnerStaffAccess = loadPartnerStaffAccessForUser,
        loadHardAssetStaffAccess = loadHardAssetStaffAccessForUser,
        loadSoftAssetStaffAccess = loadSoftAssetStaffAccessForUser,
        loadOrganizationAccess = loadOrganizationAccessForUser,
    } = options;

    if (!db) return user;

    const [
        partnerStaffAccess,
        hardAssetStaffAccess,
        softAssetStaffAccess,
        organizationAccess,
    ] = await Promise.all([
        loadPartnerStaffAccess(db, user.id),
        loadHardAssetStaffAccess(db, user.id),
        loadSoftAssetStaffAccess(db, user.id),
        loadOrganizationAccess(db, user.id),
    ]);

    return {
        ...user,
        partnerStaffAccess,
        hardAssetStaffAccess,
        softAssetStaffAccess,
        organizationAccess,
    };
}

export async function hydrateRequestUserFromDb(user, options = {}) {
    if (!user?.id) throw new Error('Session user is missing.');
    const { db = null } = options;
    if (!db) throw new Error('Session user lookup is unavailable.');

    const liveUser = await db.query.users.findFirst({
        where: eq(users.id, user.id),
    });

    if (!liveUser) throw new Error('Session user no longer exists.');

    const subregionRows = await db.query.userSubregions.findMany({
        where: eq(userSubregions.userId, liveUser.id),
    });

    const extraClaims = {};
    if (user?.isImpersonating) {
        extraClaims.isImpersonating = true;
        extraClaims.impersonatedBy = user.impersonatedBy || null;
    }

    return hydrateLiveAccessForUser({
        ...liveUser,
        subregionIds: subregionRows.map((row) => row.subregionId),
        ...extraClaims,
    }, options);
}

async function hydrateRequestUser(c, user) {
    if (typeof c.env?.AUTH_TEST_LIVE_SESSION_USER_RESOLVER === 'function') {
        const liveUser = await c.env.AUTH_TEST_LIVE_SESSION_USER_RESOLVER(user, c);
        return {
            ...liveUser,
            ...(user?.isImpersonating ? {
                isImpersonating: true,
                impersonatedBy: user.impersonatedBy || null,
            } : {}),
        };
    }

    return hydrateRequestUserFromDb(user, { db: getDb(c.env) });
}

export async function authenticateToken(c, next) {
    const token = getRequestToken(c);
    const hasSessionHeader = Boolean(c.req.header(SESSION_HEADER_NAME));

    if (!token) return c.json({ error: 'No token provided' }, 401);

    try {
        const user = await hydrateRequestUser(c, await verifySessionToken(token, c));
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
            const user = await hydrateRequestUser(c, await verifySessionToken(token, c));
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
        const normalizedAllowedRoles = allowedRoles.map(normalizeRole);
        const { subregionId, subregionIds } = user;
        const hasEffectivePartnerAccess = normalizedAllowedRoles.includes('partner')
            && (hasAnyPartnerStaffAccess(user) || hasAnyHardAssetStaffAccess(user));

        if (!normalizedAllowedRoles.includes(role) && !hasEffectivePartnerAccess) {
            return c.json({ error: 'Insufficient permissions' }, 403);
        }

        if (role === 'super_admin') {
            await next();
            return;
        }

        if (hasEffectivePartnerAccess && role !== 'regional_admin' && role !== 'partner') {
            const primaryStaffAccess = getPrimaryPartnerStaffAccess(user);
            const primaryAssetAccess = getActiveHardAssetStaffAccess(user)[0] || null;
            const scopedSubregionId = primaryStaffAccess?.subregionIds?.[0] || primaryAssetAccess?.subregionId;
            if (!scopedSubregionId) {
                return c.json({ error: 'Account missing required scope (subregion_id)' }, 403);
            }
            c.set('subregionScope', scopedSubregionId);
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

export function hasDirectResourceOperatorAccess(user) {
    const role = normalizeRole(user?.role);
    if (['super_admin', 'admin', 'regional_admin'].includes(role)) return true;
    return hasAnyHardAssetStaffAccess(user) || hasAnySoftAssetStaffAccess(user);
}

export function authorizeResourceOperator() {
    return async (c, next) => {
        const user = c.get('user');
        if (!user) return c.json({ error: 'Unauthorized' }, 401);
        if (!hasDirectResourceOperatorAccess(user)) {
            return c.json({ error: 'Insufficient permissions' }, 403);
        }

        const role = normalizeRole(user.role);
        if (role === 'regional_admin') {
            const scopedSubregionId = user.subregionId || user.subregionIds?.[0];
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
    if (!user || (!['super_admin', 'regional_admin', 'partner'].includes(normalizeRole(user.role)) && !hasAnyPartnerStaffAccess(user))) {
        return c.json({ error: 'Requires admin privileges' }, 403);
    }
    await next();
}
