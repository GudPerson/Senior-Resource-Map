import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { normalizeRole } from './roles.js';
import { normalizePostalCode } from './postalBoundaries.js';

export const SESSION_COOKIE_NAME = 'sc_token';
export const SESSION_HEADER_NAME = 'x-session-token';
const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function isProduction(c) {
    return c.env.NODE_ENV === 'production';
}

function buildCookieOptions(c) {
    const production = isProduction(c);
    return {
        httpOnly: true,
        secure: production,
        sameSite: production ? 'None' : 'Lax',
        maxAge: DEFAULT_SESSION_TTL_SECONDS,
        path: '/',
    };
}

export function getSessionSecret(c) {
    return c.env.JWT_SECRET || 'seniorcare-secret-key';
}

export function needsPostalCodeCompletion(user) {
    return normalizeRole(user?.role) === 'standard' && !normalizePostalCode(user?.postalCode);
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
        dateOfBirth: user.dateOfBirth ?? null,
        chasCard: user.chasCard ?? null,
        caregiverStatus: user.caregiverStatus ?? null,
        gender: user.gender ?? null,
        propertyType: user.propertyType ?? null,
        volunteerInterest: user.volunteerInterest ?? null,
        needsPostalCode: needsPostalCodeCompletion(user),
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
    setCookie(c, SESSION_COOKIE_NAME, token, buildCookieOptions(c));
}

export function clearAuthCookie(c) {
    const { path, sameSite, secure } = buildCookieOptions(c);
    deleteCookie(c, SESSION_COOKIE_NAME, { path, sameSite, secure });
}
