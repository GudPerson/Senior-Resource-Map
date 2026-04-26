import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { users, userSubregions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { normalizeRole } from '../utils/roles.js';
import { canDirectlyManageUser } from '../utils/ownership.js';
import { buildSessionPayload, clearAuthCookie, createSessionToken, getRequestToken, setAuthCookie, verifySessionToken } from '../utils/sessionAuth.js';
import { ensureBoundarySchema, ensureUserPreferenceColumns } from '../utils/boundarySchema.js';
import { normalizePostalCode } from '../utils/postalBoundaries.js';
import { resolveSingleSubregionByPostal, syncUserDerivedSubregion } from '../utils/subregionRouting.js';
import { normalizeChasCard, normalizeDateOfBirth, normalizeGender, normalizePropertyType, normalizeYesNo } from '../utils/profileAttributes.js';

const IMPERSONATION_SESSION_TTL_SECONDS = 12 * 60 * 60;

function parseSubregionIds(rawSubregionIds) {
    const input = Array.isArray(rawSubregionIds)
        ? rawSubregionIds
        : [rawSubregionIds].filter(Boolean);

    return [...new Set(
        input
            .flatMap((value) => typeof value === 'string' ? value.split(',') : [value])
            .map((value) => Number.parseInt(String(value).trim(), 10))
            .filter(Number.isInteger)
    )];
}

function getScopedSubregionIds(user) {
    return parseSubregionIds(user?.subregionIds || []);
}

async function loadUserWithSubregions(db, userId) {
    const [user] = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        name: users.name,
        phone: users.phone,
        postalCode: users.postalCode,
        dateOfBirth: users.dateOfBirth,
        chasCard: users.chasCard,
        caregiverStatus: users.caregiverStatus,
        gender: users.gender,
        propertyType: users.propertyType,
        volunteerInterest: users.volunteerInterest,
        managerUserId: users.managerUserId,
    }).from(users).where(eq(users.id, userId));

    if (!user) return null;

    const subregionRows = await db.select().from(userSubregions).where(eq(userSubregions.userId, userId));

    return {
        ...user,
        role: normalizeRole(user.role),
        subregionIds: subregionRows.map((row) => row.subregionId),
    };
}

function canImpersonateUser(actor, targetUser) {
    const actorRole = normalizeRole(actor.role);

    if (actorRole === 'super_admin') {
        return true;
    }

    return canDirectlyManageUser(actor, targetUser);
}

function normalizeRequiredPostalCode(value) {
    const postalCode = normalizePostalCode(value);
    if (!postalCode) {
        throw new Error('Postal code is required and must be a valid 6-digit code.');
    }
    return postalCode;
}

function normalizeOptionalPostalCode(value) {
    if (value === undefined || value === null || String(value).trim() === '') return '';
    return normalizeRequiredPostalCode(value);
}

export const register = async (c) => {
    try {
        const body = await c.req.json();
        const { email, password, name } = body;
        let { username } = body;

        if (!email || !password || !name) {
            return c.json({ error: 'Email, password, and name are required' }, 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await ensureUserPreferenceColumns(db);
        const postalCode = normalizeOptionalPostalCode(body.postalCode);
        const dateOfBirth = normalizeDateOfBirth(body.dateOfBirth);
        const chasCard = normalizeChasCard(body.chasCard);
        const caregiverStatus = normalizeYesNo(body.caregiverStatus, 'Caregiver status');
        const gender = normalizeGender(body.gender);
        const propertyType = normalizePropertyType(body.propertyType);
        const volunteerInterest = normalizeYesNo(body.volunteerInterest, 'Volunteer interest');
        const derivedSubregion = postalCode
            ? await resolveSingleSubregionByPostal(db, postalCode, 'Postal code')
            : null;

        // Auto-generate username from email if not provided
        if (!username) {
            const baseUsername = email.split('@')[0];
            let finalUsername = baseUsername;
            let counter = 1;
            while (true) {
                const [existing] = await db.select().from(users).where(eq(users.username, finalUsername));
                if (!existing) break;
                finalUsername = `${baseUsername}${counter++}`;
            }
            username = finalUsername;
        }

        // Check if email already exists
        const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
        if (existingEmail) {
            return c.json({ error: 'Email already exists' }, 400);
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [user] = await db.insert(users).values({
            username,
            email,
            passwordHash,
            name,
            role: 'standard',
            postalCode,
            dateOfBirth,
            chasCard,
            caregiverStatus,
            gender,
            propertyType,
            volunteerInterest,
            managerUserId: null,
        }).returning();

        if (derivedSubregion) {
            await syncUserDerivedSubregion(db, user.id, derivedSubregion.id);
        }

        user.subregionIds = derivedSubregion ? [derivedSubregion.id] : [];

        const token = await createSessionToken(user, c);
        setAuthCookie(c, token);

        return c.json({ user: buildSessionPayload(user) });
    } catch (err) {
        console.error('Registration Error:', err);
        return c.json({ error: err.message || 'Registration failed' }, 500);
    }
};

export const login = async (c) => {
    try {
        const body = await c.req.json();
        const { username, email, password, isPartnerLogin } = body;

        const loginId = username || email;
        if (!loginId || !password) {
            return c.json({ error: 'Username/email and password are required' }, 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await ensureUserPreferenceColumns(db);
        const isEmail = loginId.includes('@');

        // Try exact match first
        let [user] = await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            passwordHash: users.passwordHash,
                name: users.name,
                role: users.role,
                phone: users.phone,
                postalCode: users.postalCode,
                dateOfBirth: users.dateOfBirth,
                chasCard: users.chasCard,
                caregiverStatus: users.caregiverStatus,
                gender: users.gender,
                propertyType: users.propertyType,
                volunteerInterest: users.volunteerInterest,
                managerUserId: users.managerUserId,
            }).from(users).where(
                isEmail ? eq(users.email, loginId) : eq(users.username, loginId)
        );

        // Fallback: case-insensitive lookup
        if (!user) {
            [user] = await db.select({
                id: users.id,
                username: users.username,
                email: users.email,
                passwordHash: users.passwordHash,
                name: users.name,
                role: users.role,
                phone: users.phone,
                postalCode: users.postalCode,
                dateOfBirth: users.dateOfBirth,
                chasCard: users.chasCard,
                caregiverStatus: users.caregiverStatus,
                gender: users.gender,
                propertyType: users.propertyType,
                volunteerInterest: users.volunteerInterest,
                managerUserId: users.managerUserId,
            }).from(users).where(
                isEmail ? eq(users.email, loginId.toLowerCase()) : eq(users.username, loginId)
            );
        }

        // Last resort: fetch by lowercase comparison
        if (!user) {
            const allUsers = await db.select().from(users);
            user = allUsers.find(u =>
                isEmail
                    ? u.email.toLowerCase() === loginId.toLowerCase()
                    : u.username.toLowerCase() === loginId.toLowerCase()
            );
        }

        if (!user) return c.json({ error: 'Invalid credentials' }, 401);

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

        if (isPartnerLogin === true) {
            const adminRoles = ['super_admin', 'regional_admin', 'partner'];
            if (!adminRoles.includes(user.role)) {
                return c.json({ error: 'This login page is for Partners and Admins only.' }, 403);
            }
        }

        const userSubs = await db.select().from(userSubregions).where(eq(userSubregions.userId, user.id));
        user.subregionIds = userSubs.map(s => s.subregionId);

        const token = await createSessionToken(user, c);
        setAuthCookie(c, token);
        return c.json({ user: buildSessionPayload(user) });
    } catch (err) {
        console.error('Login Error:', err);
        return c.json({ error: err.message || 'Login failed' }, 500);
    }
};

export const me = async (c) => {
    const token = getRequestToken(c);
    if (!token) return c.json({ user: null });

    try {
        const sessionUser = await verifySessionToken(token, c);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await ensureUserPreferenceColumns(db);
        const liveUser = await loadUserWithSubregions(db, sessionUser.id);

        if (!liveUser) {
            return c.json({ user: null });
        }

        const extraClaims = {};
        if (sessionUser?.isImpersonating) {
            extraClaims.isImpersonating = true;
            extraClaims.impersonatedBy = sessionUser.impersonatedBy || null;
        }

        return c.json({ user: buildSessionPayload(liveUser, extraClaims) });
    } catch {
        return c.json({ user: null });
    }
};

export const logout = (c) => {
    clearAuthCookie(c);
    return c.json({ success: true });
};

export const googleAuth = async (c) => {
    try {
        const body = await c.req.json();
        const { credential } = body;
        if (!credential) return c.json({ error: 'No credential provided' }, 400);

        // Verify with Google's native REST endpoint instead of heavy google-auth-library
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        const payload = await response.json();

        if (!response.ok || !payload || payload.aud !== c.env.VITE_GOOGLE_CLIENT_ID) {
            return c.json({ error: 'Invalid Google token' }, 401);
        }

        const { email, name } = payload;
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await ensureUserPreferenceColumns(db);

        let [user] = await db.select().from(users).where(eq(users.email, email));

        if (!user) {
            const postalCode = normalizeOptionalPostalCode(body.postalCode);
            const dateOfBirth = normalizeDateOfBirth(body.dateOfBirth);
            const chasCard = normalizeChasCard(body.chasCard);
            const caregiverStatus = normalizeYesNo(body.caregiverStatus, 'Caregiver status');
            const gender = normalizeGender(body.gender);
            const propertyType = normalizePropertyType(body.propertyType);
            const volunteerInterest = normalizeYesNo(body.volunteerInterest, 'Volunteer interest');
            const derivedSubregion = postalCode
                ? await resolveSingleSubregionByPostal(db, postalCode, 'Postal code')
                : null;
            const dummyPassword = crypto.getRandomValues(new Uint8Array(16)).join('');
            const passwordHash = await bcrypt.hash(dummyPassword, 10);

            const baseUsername = email.split('@')[0];
            let finalUsername = baseUsername;
            let counter = 1;

            while (true) {
                const [existing] = await db.select().from(users).where(eq(users.username, finalUsername));
                if (!existing) break;
                finalUsername = `${baseUsername}${counter++}`;
            }

            [user] = await db.insert(users).values({
                username: finalUsername,
                email,
                name: name || baseUsername,
                passwordHash,
                role: 'standard',
                postalCode,
                dateOfBirth,
                chasCard,
                caregiverStatus,
                gender,
                propertyType,
                volunteerInterest,
                managerUserId: null,
            }).returning();

            if (derivedSubregion) {
                await syncUserDerivedSubregion(db, user.id, derivedSubregion.id);
            }
        }

        const userSubs = await db.select().from(userSubregions).where(eq(userSubregions.userId, user.id));
        user.subregionIds = userSubs.map((row) => row.subregionId);

        const token = await createSessionToken(user, c);
        setAuthCookie(c, token);
        return c.json({ user: buildSessionPayload(user) });

    } catch (err) {
        console.error('Google Auth Error:', err);
        return c.json({ error: 'Google authentication failed' }, 500);
    }
};

export const impersonate = async (c) => {
    try {
        const actor = c.get('user');
        const actorRole = normalizeRole(actor?.role);

        if (!['super_admin', 'regional_admin', 'partner'].includes(actorRole)) {
            return c.json({ error: 'Insufficient permissions to enter another account.' }, 403);
        }

        if (actor?.isImpersonating) {
            return c.json({ error: 'Exit the current user view before opening another account.' }, 403);
        }

        const targetUserId = Number.parseInt(c.req.param('id'), 10);
        if (!Number.isInteger(targetUserId)) {
            return c.json({ error: 'Invalid user id.' }, 400);
        }

        if (targetUserId === actor.id) {
            return c.json({ error: 'You are already signed in as this account.' }, 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const targetUser = await loadUserWithSubregions(db, targetUserId);

        if (!targetUser) {
            return c.json({ error: 'User not found.' }, 404);
        }

        if (!canImpersonateUser(actor, targetUser)) {
            return c.json({ error: 'You can only enter accounts directly below your role within your scope.' }, 403);
        }

        const token = await createSessionToken(targetUser, c, {
            expiresInSeconds: IMPERSONATION_SESSION_TTL_SECONDS,
            extraClaims: {
                isImpersonating: true,
                impersonatedBy: {
                    id: actor.id,
                    username: actor.username,
                    name: actor.name,
                    role: actorRole,
                },
            },
        });

        return c.json({
            token,
            user: buildSessionPayload(targetUser, {
                isImpersonating: true,
                impersonatedBy: {
                    id: actor.id,
                    username: actor.username,
                    name: actor.name,
                    role: actorRole,
                },
            }),
        });
    } catch (err) {
        console.error('Impersonation Error:', err);
        return c.json({ error: err.message || 'Unable to enter the selected account.' }, 500);
    }
};
