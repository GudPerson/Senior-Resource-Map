import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { sensitiveAuditLogs, users, userSubregions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { normalizeRole } from '../utils/roles.js';
import { canDirectlyManageUser } from '../utils/ownership.js';
import { loadHardAssetStaffAccessForUser } from '../utils/hardAssetStaff.js';
import { loadSoftAssetStaffAccessForUser } from '../utils/softAssetAccess.js';
import { hasAnyPartnerStaffAccess, loadPartnerStaffAccessForUser } from '../utils/partnerStaff.js';
import { loadOrganizationAccessForUser } from '../utils/organizationAccess.js';
import { buildSessionPayload, clearAuthCookie, createSessionToken, getRequestToken, setAuthCookie, verifySessionToken } from '../utils/sessionAuth.js';
import { ensureBoundarySchema, ensureUserPreferenceColumns } from '../utils/boundarySchema.js';
import { normalizePostalCode } from '../utils/postalBoundaries.js';
import { resolveSingleSubregionByPostal, syncUserDerivedSubregion } from '../utils/subregionRouting.js';
import { normalizeChasCard, normalizeDateOfBirth, normalizeGender, normalizePropertyType, normalizeYesNo } from '../utils/profileAttributes.js';
import {
    optionalOneLineTextSchema,
    requiredOneLineTextSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';
import { loginPasswordSchema, newPasswordSchema } from '../utils/passwordPolicy.js';

const IMPERSONATION_SESSION_TTL_SECONDS = 12 * 60 * 60;

const profileRegistrationFieldsSchema = {
    postalCode: optionalOneLineTextSchema(20),
    dateOfBirth: optionalOneLineTextSchema(20),
    chasCard: optionalOneLineTextSchema(40),
    caregiverStatus: optionalOneLineTextSchema(40),
    gender: optionalOneLineTextSchema(40),
    propertyType: optionalOneLineTextSchema(80),
    volunteerInterest: optionalOneLineTextSchema(40),
};

const registerBodySchema = z.object({
    username: optionalOneLineTextSchema(120),
    email: requiredOneLineTextSchema('Email address', 320),
    password: newPasswordSchema,
    name: requiredOneLineTextSchema('Name', 160),
    role: optionalOneLineTextSchema(40),
    ...profileRegistrationFieldsSchema,
});

const loginBodySchema = z.object({
    username: optionalOneLineTextSchema(120),
    email: optionalOneLineTextSchema(320),
    password: loginPasswordSchema,
    isPartnerLogin: z.boolean().optional(),
}).refine((body) => Boolean(body.username || body.email), {
    path: ['email'],
    message: 'Username/email and password are required.',
});

const googleAuthBodySchema = z.object({
    credential: requiredOneLineTextSchema('Google credential', 20000),
    ...profileRegistrationFieldsSchema,
});

function normalizeText(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

export function isVerifiedGoogleEmail(payload) {
    return payload?.email_verified === true || String(payload?.email_verified || '').toLowerCase() === 'true';
}

export function normalizeGoogleSubject(payload) {
    return String(payload?.sub || '').trim();
}

export function shouldRejectGoogleEmailOnlyAccountLink(subjectMatchedUser, emailMatchedUser) {
    return !subjectMatchedUser && Boolean(emailMatchedUser);
}

function normalizeComparableEmail(value) {
    return normalizeText(value).toLowerCase();
}

export function validateAuthenticatedGoogleLink({
    currentDbUser,
    subjectMatchedUser,
    googleEmail,
    googleSubject,
}) {
    if (!currentDbUser?.id) {
        return {
            allowed: false,
            status: 401,
            error: 'Sign in with email before linking Google.',
        };
    }

    if (!googleSubject || !normalizeComparableEmail(googleEmail)) {
        return {
            allowed: false,
            status: 401,
            error: 'Invalid Google token',
        };
    }

    if (subjectMatchedUser && Number(subjectMatchedUser.id) !== Number(currentDbUser.id)) {
        return {
            allowed: false,
            status: 409,
            error: 'This Google account is already linked to another CareAround SG account.',
        };
    }

    if (
        currentDbUser.googleSubject
        && String(currentDbUser.googleSubject) !== String(googleSubject)
    ) {
        return {
            allowed: false,
            status: 409,
            error: 'This CareAround SG account is already linked to another Google account.',
        };
    }

    if (normalizeComparableEmail(currentDbUser.email) !== normalizeComparableEmail(googleEmail)) {
        return {
            allowed: false,
            status: 409,
            error: 'Sign in with the CareAround SG account that matches this Google email before linking.',
        };
    }

    return {
        allowed: true,
        alreadyLinked: String(currentDbUser.googleSubject || '') === String(googleSubject),
    };
}

async function verifyGoogleCredential(c, credential) {
    if (!credential) {
        const error = new Error('No credential provided');
        error.status = 400;
        throw error;
    }

    // Verify with Google's native REST endpoint instead of heavy google-auth-library.
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const payload = await response.json();

    const googleSubject = normalizeGoogleSubject(payload);
    const email = normalizeComparableEmail(payload?.email);

    if (!response.ok
        || !payload
        || payload.aud !== c.env.VITE_GOOGLE_CLIENT_ID
        || !googleSubject
        || !email
        || !isVerifiedGoogleEmail(payload)) {
        const error = new Error('Invalid Google token');
        error.status = 401;
        throw error;
    }

    return {
        payload,
        googleSubject,
        email,
    };
}

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
        const error = new Error('Postal code is required and must be a valid 6-digit code.');
        error.status = 400;
        throw error;
    }
    return postalCode;
}

function normalizeOptionalPostalCode(value) {
    if (value === undefined || value === null || String(value).trim() === '') return '';
    return normalizeRequiredPostalCode(value);
}

export const register = async (c) => {
    try {
        const body = validateRequestBody(await c.req.json(), registerBodySchema, 'Registration details');
        const { email, password, name } = body;
        let { username } = body;

        if (!email || !password || !name) {
            return c.json({ error: 'Email, password, and name are required' }, 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await ensureUserPreferenceColumns(db, c.env);
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
        if (!err.status || err.status >= 500) console.error('Registration Error:', err);
        return c.json({ error: err.message || 'Registration failed' }, err.status || 500);
    }
};

export const login = async (c) => {
    try {
        const body = validateRequestBody(await c.req.json(), loginBodySchema, 'Sign-in details');
        const { username, email, password, isPartnerLogin } = body;

        const loginId = username || email;
        if (!loginId || !password) {
            return c.json({ error: 'Username/email and password are required' }, 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await ensureUserPreferenceColumns(db, c.env);
        const isEmail = loginId.includes('@');
        const normalizedLoginId = loginId.toLowerCase();

        const [user] = await db.select({
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
                isEmail
                    ? sql`lower(${users.email}) = ${normalizedLoginId}`
                    : sql`lower(${users.username}) = ${normalizedLoginId}`
            ).limit(1);

        if (!user) return c.json({ error: 'Invalid credentials' }, 401);

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

        const userSubs = await db.select().from(userSubregions).where(eq(userSubregions.userId, user.id));
        user.subregionIds = userSubs.map(s => s.subregionId);
        user.partnerStaffAccess = await loadPartnerStaffAccessForUser(db, user.id);
        user.hardAssetStaffAccess = await loadHardAssetStaffAccessForUser(db, user.id);
        user.softAssetStaffAccess = await loadSoftAssetStaffAccessForUser(db, user.id);
        user.organizationAccess = await loadOrganizationAccessForUser(db, user.id);

        if (isPartnerLogin === true) {
            const adminRoles = ['super_admin', 'regional_admin', 'partner'];
            if (!adminRoles.includes(user.role) && !hasAnyPartnerStaffAccess(user)) {
                return c.json({ error: 'This login page is for Partners and Admins only.' }, 403);
            }
        }

        const token = await createSessionToken(user, c);
        setAuthCookie(c, token);
        return c.json({ user: buildSessionPayload(user) });
    } catch (err) {
        if (!err.status || err.status >= 500) console.error('Login Error:', err);
        return c.json({ error: err.message || 'Login failed' }, err.status || 500);
    }
};

export const me = async (c) => {
    const token = getRequestToken(c);
    if (!token) return c.json({ user: null });

    let sessionUser;
    try {
        sessionUser = await verifySessionToken(token, c);
    } catch {
        return c.json({ user: null });
    }

    try {
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await ensureUserPreferenceColumns(db, c.env);
        const liveUser = await loadUserWithSubregions(db, sessionUser.id);

        if (!liveUser) {
            return c.json({ user: null });
        }

        liveUser.partnerStaffAccess = await loadPartnerStaffAccessForUser(db, liveUser.id);
        liveUser.hardAssetStaffAccess = await loadHardAssetStaffAccessForUser(db, liveUser.id);
        liveUser.softAssetStaffAccess = await loadSoftAssetStaffAccessForUser(db, liveUser.id);
        liveUser.organizationAccess = await loadOrganizationAccessForUser(db, liveUser.id);

        const extraClaims = {};
        if (sessionUser?.isImpersonating) {
            extraClaims.isImpersonating = true;
            extraClaims.impersonatedBy = sessionUser.impersonatedBy || null;
        }

        return c.json({ user: buildSessionPayload(liveUser, extraClaims) });
    } catch (err) {
        console.error('Session check failed:', err);
        return c.json({ error: 'Session check failed' }, 500);
    }
};

export const logout = (c) => {
    clearAuthCookie(c);
    return c.json({ success: true });
};

export const googleAuth = async (c) => {
    try {
        const body = validateRequestBody(await c.req.json(), googleAuthBodySchema, 'Google sign-in details');
        const { credential } = body;
        const { payload, googleSubject, email } = await verifyGoogleCredential(c, credential);

        const { name } = payload;
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await ensureUserPreferenceColumns(db, c.env);

        let [user] = await db.select().from(users).where(eq(users.googleSubject, googleSubject));

        if (!user) {
            const [emailMatchedUser] = await db.select().from(users).where(eq(users.email, email));
            if (shouldRejectGoogleEmailOnlyAccountLink(user, emailMatchedUser)) {
                return c.json({
                    error: "That Google account matches your email account. Sign in with email once and we'll link Google for next time.",
                    code: 'google_link_required',
                }, 409);
            }

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
                googleSubject,
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
        user.partnerStaffAccess = await loadPartnerStaffAccessForUser(db, user.id);
        user.hardAssetStaffAccess = await loadHardAssetStaffAccessForUser(db, user.id);
        user.softAssetStaffAccess = await loadSoftAssetStaffAccessForUser(db, user.id);
        user.organizationAccess = await loadOrganizationAccessForUser(db, user.id);

        const token = await createSessionToken(user, c);
        setAuthCookie(c, token);
        return c.json({ user: buildSessionPayload(user) });

    } catch (err) {
        if (!err.status || err.status >= 500) console.error('Google Auth Error:', err);
        return c.json({ error: err.status ? err.message : 'Google authentication failed' }, err.status || 500);
    }
};

export const linkGoogleAuth = async (c) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser?.id) {
            return c.json({ error: 'Sign in with email before linking Google.' }, 401);
        }

        const body = validateRequestBody(await c.req.json(), googleAuthBodySchema, 'Google link details');
        const { credential } = body;
        const { googleSubject, email } = await verifyGoogleCredential(c, credential);

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await ensureUserPreferenceColumns(db, c.env);

        const [currentDbUser] = await db.select().from(users).where(eq(users.id, sessionUser.id));
        const [subjectMatchedUser] = await db.select().from(users).where(eq(users.googleSubject, googleSubject));
        const decision = validateAuthenticatedGoogleLink({
            currentDbUser,
            subjectMatchedUser,
            googleEmail: email,
            googleSubject,
        });

        if (!decision.allowed) {
            return c.json({ error: decision.error }, decision.status);
        }

        if (!decision.alreadyLinked) {
            await db.update(users)
                .set({ googleSubject })
                .where(eq(users.id, currentDbUser.id))
                .returning();
        }

        const linkedUser = await loadUserWithSubregions(db, currentDbUser.id);
        if (!linkedUser) {
            return c.json({ error: 'Sign in with email before linking Google.' }, 401);
        }

        linkedUser.partnerStaffAccess = await loadPartnerStaffAccessForUser(db, linkedUser.id);
        linkedUser.hardAssetStaffAccess = await loadHardAssetStaffAccessForUser(db, linkedUser.id);
        linkedUser.softAssetStaffAccess = await loadSoftAssetStaffAccessForUser(db, linkedUser.id);
        linkedUser.organizationAccess = await loadOrganizationAccessForUser(db, linkedUser.id);

        const token = await createSessionToken(linkedUser, c);
        setAuthCookie(c, token);
        return c.json({ user: buildSessionPayload(linkedUser), linkedGoogle: true });
    } catch (err) {
        if (!err.status || err.status >= 500) console.error('Google Link Error:', err);
        return c.json({ error: err.status ? err.message : 'Google link failed' }, err.status || 500);
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

        targetUser.partnerStaffAccess = await loadPartnerStaffAccessForUser(db, targetUser.id);
        targetUser.hardAssetStaffAccess = await loadHardAssetStaffAccessForUser(db, targetUser.id);
        targetUser.softAssetStaffAccess = await loadSoftAssetStaffAccessForUser(db, targetUser.id);
        targetUser.organizationAccess = await loadOrganizationAccessForUser(db, targetUser.id);

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

        try {
            await db.insert(sensitiveAuditLogs).values({
                actorUserId: actor.id,
                targetUserId: targetUser.id,
                actionType: 'user_view_started',
                entityType: 'user',
                entityId: targetUser.id,
                metadata: { actorRole },
            });
        } catch {
            // Do not block an already-authorized user view if the audit table is temporarily unavailable.
        }

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
