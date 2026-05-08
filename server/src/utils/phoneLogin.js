import { and, eq, isNull } from 'drizzle-orm';

import { phoneLoginAttempts, userPhoneIdentities, users, userSubregions } from '../db/schema.js';
import { normalizeRole } from './roles.js';
import { maskPhoneIdentity } from './phoneIdentityAudit.js';
import { normalizeSingaporePhoneIdentity } from './phoneIdentity.js';

export const PHONE_LOGIN_ATTEMPT_STATUS = Object.freeze({
    pending: 'pending',
    verified: 'verified',
    failed: 'failed',
    expired: 'expired',
    noAccount: 'no_account',
    conflict: 'conflict',
});

export const PHONE_LOGIN_RETURN_URL = 'https://app.carearound.sg/login?gudauth=phone_login';

const PROVIDER_VERIFIED_STATUSES = new Set(['verified', 'approved', 'completed', 'success']);
const PROVIDER_FAILED_STATUSES = new Set(['failed', 'rejected', 'error']);
const PROVIDER_EXPIRED_STATUSES = new Set(['expired', 'timeout']);

function createPhoneLoginError(message, status = 400, code = 'phone_login_error') {
    const err = new Error(message);
    err.status = status;
    err.code = code;
    return err;
}

function getProviderChallengePayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.data?.challenge && typeof payload.data.challenge === 'object') return payload.data.challenge;
    if (payload.challenge && typeof payload.challenge === 'object') return payload.challenge;
    if (payload.data && typeof payload.data === 'object') return payload.data;
    return payload;
}

function getProviderChallengeUrl(payload, challengePayload) {
    const candidates = [
        payload?.data?.deepLink,
        payload?.deepLink,
        challengePayload?.whatsappUrl,
        challengePayload?.whatsAppUrl,
        challengePayload?.url,
    ];
    return candidates.find((value) => typeof value === 'string' && value.trim()) || null;
}

function sanitizeChallenge(challenge) {
    const challengePayload = getProviderChallengePayload(challenge);
    if (!challengePayload || typeof challengePayload !== 'object') return null;
    return {
        id: challengePayload.id || challengePayload.challengeId || null,
        status: challengePayload.status || null,
        expiresAt: challengePayload.expiresAt || challengePayload.expires_at || null,
        phone: challengePayload.phoneMasked || challengePayload.maskedPhone || null,
        whatsappUrl: getProviderChallengeUrl(challenge, challengePayload),
    };
}

function extractChallengeId(challenge) {
    const challengePayload = getProviderChallengePayload(challenge);
    return String(challengePayload?.id || challengePayload?.challengeId || '').trim();
}

function extractProviderPhone(challenge) {
    const challengePayload = getProviderChallengePayload(challenge);
    return challengePayload?.phoneE164
        || challengePayload?.verifiedPhoneE164
        || challengePayload?.phone
        || challengePayload?.msisdn
        || challengePayload?.whatsappPhone
        || null;
}

function getProviderStatus(challenge) {
    const challengePayload = getProviderChallengePayload(challenge);
    return challengePayload?.status || null;
}

function normalizeProviderStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (PROVIDER_VERIFIED_STATUSES.has(normalized)) return PHONE_LOGIN_ATTEMPT_STATUS.verified;
    if (PROVIDER_FAILED_STATUSES.has(normalized)) return PHONE_LOGIN_ATTEMPT_STATUS.failed;
    if (PROVIDER_EXPIRED_STATUSES.has(normalized)) return PHONE_LOGIN_ATTEMPT_STATUS.expired;
    return PHONE_LOGIN_ATTEMPT_STATUS.pending;
}

function normalizeChallengeState(challenge) {
    const challengePayload = getProviderChallengePayload(challenge);
    if (challengePayload?.verified === true) return PHONE_LOGIN_ATTEMPT_STATUS.verified;
    if (challengePayload?.expired === true) return PHONE_LOGIN_ATTEMPT_STATUS.expired;
    return normalizeProviderStatus(challengePayload?.status);
}

function isTerminalAttemptStatus(status) {
    return [
        PHONE_LOGIN_ATTEMPT_STATUS.verified,
        PHONE_LOGIN_ATTEMPT_STATUS.failed,
        PHONE_LOGIN_ATTEMPT_STATUS.expired,
        PHONE_LOGIN_ATTEMPT_STATUS.noAccount,
        PHONE_LOGIN_ATTEMPT_STATUS.conflict,
    ].includes(status);
}

function serializeAttemptStatus(attempt, extra = {}) {
    return {
        attemptId: attempt.id,
        status: attempt.status,
        phone: maskPhoneIdentity(attempt.verifiedPhoneE164 || attempt.requestedPhoneE164),
        reason: attempt.failureReason || null,
        ...extra,
    };
}

async function resolveVerifiedLoginIdentity({ store, attempt, phoneE164 }) {
    const identities = await store.findVerifiedIdentitiesByPhone(phoneE164);

    if (!identities.length) {
        const updated = await store.updateAttempt(attempt.id, {
            status: PHONE_LOGIN_ATTEMPT_STATUS.noAccount,
            verifiedPhoneE164: phoneE164,
            providerStatus: PHONE_LOGIN_ATTEMPT_STATUS.verified,
            failureReason: 'no_verified_account',
        });
        return serializeAttemptStatus(updated, { reason: 'no_verified_account' });
    }

    if (identities.length > 1) {
        const updated = await store.updateAttempt(attempt.id, {
            status: PHONE_LOGIN_ATTEMPT_STATUS.conflict,
            verifiedPhoneE164: phoneE164,
            providerStatus: PHONE_LOGIN_ATTEMPT_STATUS.verified,
            failureReason: 'multiple_verified_accounts',
        });
        return serializeAttemptStatus(updated, { reason: 'multiple_verified_accounts' });
    }

    const identity = identities[0];
    const user = await store.getUserWithSubregions(identity.userId);
    if (!user) {
        const updated = await store.updateAttempt(attempt.id, {
            status: PHONE_LOGIN_ATTEMPT_STATUS.conflict,
            verifiedPhoneE164: phoneE164,
            providerStatus: PHONE_LOGIN_ATTEMPT_STATUS.verified,
            failureReason: 'identity_user_missing',
        });
        return serializeAttemptStatus(updated, { reason: 'identity_user_missing' });
    }

    const updated = await store.updateAttempt(attempt.id, {
        status: PHONE_LOGIN_ATTEMPT_STATUS.verified,
        verifiedPhoneE164: phoneE164,
        providerStatus: PHONE_LOGIN_ATTEMPT_STATUS.verified,
        resolvedUserId: user.id,
    });

    return serializeAttemptStatus(updated, { user });
}

export function createPhoneLoginStore(db) {
    return {
        async createAttempt(values) {
            const [row] = await db.insert(phoneLoginAttempts).values(values).returning();
            return row;
        },
        async getAttemptById(attemptId) {
            const [row] = await db.select()
                .from(phoneLoginAttempts)
                .where(eq(phoneLoginAttempts.id, attemptId))
                .limit(1);
            return row || null;
        },
        async updateAttempt(attemptId, values) {
            const [row] = await db.update(phoneLoginAttempts)
                .set({ ...values, updatedAt: new Date() })
                .where(eq(phoneLoginAttempts.id, attemptId))
                .returning();
            return row;
        },
        async findVerifiedIdentitiesByPhone(phoneE164) {
            return db.select()
                .from(userPhoneIdentities)
                .where(and(
                    eq(userPhoneIdentities.phoneE164, phoneE164),
                    eq(userPhoneIdentities.status, 'verified'),
                    isNull(userPhoneIdentities.revokedAt),
                ));
        },
        async getUserWithSubregions(userId) {
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

            const subregionRows = await db.select()
                .from(userSubregions)
                .where(eq(userSubregions.userId, userId));

            return {
                ...user,
                role: normalizeRole(user.role),
                subregionIds: subregionRows.map((row) => row.subregionId),
            };
        },
    };
}

export async function startPhoneLoginAttempt({ store, gudAuthClient, input = {} }) {
    const phoneE164 = normalizeSingaporePhoneIdentity(input.phone);
    if (!phoneE164) {
        throw createPhoneLoginError('Enter a valid Singapore phone number to continue.', 400, 'invalid_phone');
    }

    const attempt = await store.createAttempt({
        provider: 'gudauth',
        requestedPhoneE164: phoneE164,
        status: PHONE_LOGIN_ATTEMPT_STATUS.pending,
    });

    const challenge = await gudAuthClient.createChallenge({
        phoneNumber: phoneE164,
        returnUrl: PHONE_LOGIN_RETURN_URL,
        referenceId: `carearound-phone-login:${attempt.id}`,
    });
    const providerChallengeId = extractChallengeId(challenge);
    if (!providerChallengeId) {
        await store.updateAttempt(attempt.id, {
            status: PHONE_LOGIN_ATTEMPT_STATUS.failed,
            failureReason: 'provider_missing_challenge_id',
        });
        throw createPhoneLoginError('Phone verification provider did not return a challenge id.', 502, 'provider_missing_challenge_id');
    }

    const sanitizedChallenge = sanitizeChallenge(challenge);
    const updatedAttempt = await store.updateAttempt(attempt.id, {
        providerChallengeId,
        providerStatus: getProviderStatus(challenge),
        expiresAt: sanitizedChallenge?.expiresAt ? new Date(sanitizedChallenge.expiresAt) : null,
    });

    return {
        attemptId: updatedAttempt.id,
        status: updatedAttempt.status,
        phone: maskPhoneIdentity(phoneE164),
        challenge: sanitizedChallenge,
    };
}

export async function pollPhoneLoginAttempt({ store, gudAuthClient, attemptId }) {
    const attempt = await store.getAttemptById(attemptId);
    if (!attempt) {
        throw createPhoneLoginError('Phone sign-in attempt was not found.', 404, 'attempt_not_found');
    }

    if (isTerminalAttemptStatus(attempt.status)) {
        if (attempt.status === PHONE_LOGIN_ATTEMPT_STATUS.verified && attempt.resolvedUserId) {
            const user = await store.getUserWithSubregions(attempt.resolvedUserId);
            return serializeAttemptStatus(attempt, user ? { user } : {});
        }
        return serializeAttemptStatus(attempt);
    }

    if (!attempt.providerChallengeId) {
        throw createPhoneLoginError('Phone sign-in attempt is missing its provider challenge.', 500, 'missing_provider_challenge');
    }

    const challenge = await gudAuthClient.getChallenge(attempt.providerChallengeId);
    const challengeState = normalizeChallengeState(challenge);

    if (challengeState === PHONE_LOGIN_ATTEMPT_STATUS.pending) {
        const updated = await store.updateAttempt(attempt.id, {
            status: PHONE_LOGIN_ATTEMPT_STATUS.pending,
            providerStatus: getProviderStatus(challenge),
        });
        return serializeAttemptStatus(updated, { challenge: sanitizeChallenge(challenge) });
    }

    if (challengeState === PHONE_LOGIN_ATTEMPT_STATUS.failed || challengeState === PHONE_LOGIN_ATTEMPT_STATUS.expired) {
        const updated = await store.updateAttempt(attempt.id, {
            status: challengeState,
            providerStatus: getProviderStatus(challenge),
            failureReason: challengeState,
        });
        return serializeAttemptStatus(updated);
    }

    const verifiedPhoneE164 = normalizeSingaporePhoneIdentity(extractProviderPhone(challenge));
    if (!verifiedPhoneE164) {
        const updated = await store.updateAttempt(attempt.id, {
            status: PHONE_LOGIN_ATTEMPT_STATUS.failed,
            providerStatus: getProviderStatus(challenge),
            failureReason: 'provider_missing_verified_phone',
        });
        return serializeAttemptStatus(updated, { reason: 'provider_missing_verified_phone' });
    }

    return resolveVerifiedLoginIdentity({
        store,
        attempt,
        phoneE164: verifiedPhoneE164,
    });
}
