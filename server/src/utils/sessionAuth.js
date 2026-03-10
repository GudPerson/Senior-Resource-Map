import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { normalizeRole } from './roles.js';

export const SESSION_COOKIE_NAME = 'sc_token';
export const SESSION_HEADER_NAME = 'x-session-token';
const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export function getSessionSecret(c) {
    return c.env.JWT_SECRET || 'seniorcare-secret-key';
}

export function getRequestToken(c) {
    const headerToken = c.req.header(SESSION_HEADER_NAME);
    if (typeof headerToken === 'string' && headerToken.trim()) {
        return headerToken.trim();
    }

    return getCookie(c, SESSION_COOKIE_NAME) || null;
}

export function buildSessionPayload(user, extraClaims = {}) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: normalizeRole(user.role),
        name: user.name,
        phone: user.phone ?? null,
        postalCode: user.postalCode ?? '',
        managerUserId: user.managerUserId ?? null,
        subregionIds: Array.isArray(user.subregionIds) ? user.subregionIds : [],
        ...extraClaims,
    };
}

export async function createSessionToken(user, c, options = {}) {
    const {
        expiresInSeconds = DEFAULT_SESSION_TTL_SECONDS,
        extraClaims = {},
    } = options;

    return await sign(
        {
            ...buildSessionPayload(user, extraClaims),
            exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
        },
        getSessionSecret(c),
        'HS256'
    );
}

export async function verifySessionToken(token, c) {
    return await verify(token, getSessionSecret(c), 'HS256');
}

export function setAuthCookie(c, token) {
    setCookie(c, SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: c.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: DEFAULT_SESSION_TTL_SECONDS,
        path: '/',
    });
}

export function clearAuthCookie(c) {
    deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
}
