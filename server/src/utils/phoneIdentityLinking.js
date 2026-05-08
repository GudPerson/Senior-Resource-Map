import { and, eq, isNull } from 'drizzle-orm';

import { phoneVerificationAttempts, userPhoneIdentities, users } from '../db/schema.js';
import { maskPhoneIdentity } from './phoneIdentityAudit.js';
import { normalizeSingaporePhoneIdentity } from './phoneIdentity.js';

export const PHONE_LINK_ATTEMPT_STATUS = Object.freeze({
    pending: 'pending',
    verified: 'verified',
    failed: 'failed',
    expired: 'expired',
    conflict: 'conflict',
    manualReview: 'manual_review',
});

const PROVIDER_VERIFIED_STATUSES = new Set(['verified', 'approved', 'completed', 'success']);
const PROVIDER_FAILED_STATUSES = new Set(['failed', 'rejected', 'error']);
const PROVIDER_EXPIRED_STATUSES = new Set(['expired', 'timeout']);
export const PHONE_LINK_RETURN_URL = 'https://app.carearound.sg/dashboard/profile?gudauth=phone_link';

function createPhoneLinkError(message, status = 400, code = 'phone_link_error') {
    const err = new Error(message);
    err.status = status;
    err.code = code;
    return err;
}

function serializeIdentity(identity) {
    if (!identity) return null;
    return {
        id: identity.id,
        status: identity.status,
        source: identity.source,
        phone: maskPhoneIdentity(identity.phoneE164),
        verifiedAt: identity.verifiedAt || null,
    };
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
        message: challengePayload.message || null,
        whatsappUrl: getProviderChallengeUrl(challenge, challengePayload),
    };
}

function extractChallengeId(challenge) {
    const challengePayload = getProviderChallengePayload(challenge);
    return String(challengePayload?.id || challengePayload?.challengeId || '').trim();
}

function extractProviderSubject(challenge) {
    const challengePayload = getProviderChallengePayload(challenge);
    return String(challengePayload?.subject || challengePayload?.providerSubject || challengePayload?.verifiedSubject || '').trim() || null;
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

function normalizeProviderStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (PROVIDER_VERIFIED_STATUSES.has(normalized)) return PHONE_LINK_ATTEMPT_STATUS.verified;
    if (PROVIDER_FAILED_STATUSES.has(normalized)) return PHONE_LINK_ATTEMPT_STATUS.failed;
    if (PROVIDER_EXPIRED_STATUSES.has(normalized)) return PHONE_LINK_ATTEMPT_STATUS.expired;
    return PHONE_LINK_ATTEMPT_STATUS.pending;
}

function normalizeChallengeState(challenge) {
    const challengePayload = getProviderChallengePayload(challenge);
    if (challengePayload?.verified === true) return PHONE_LINK_ATTEMPT_STATUS.verified;
    if (challengePayload?.expired === true) return PHONE_LINK_ATTEMPT_STATUS.expired;
    return normalizeProviderStatus(challengePayload?.status);
}

function splitSingaporeE164(phoneE164) {
    return {
        countryCode: '+65',
        nationalNumber: String(phoneE164 || '').replace(/^\+65/, ''),
    };
}

function isSameActiveIdentity(identity, userId, phoneE164) {
    return identity && identity.userId === userId && identity.phoneE164 === phoneE164 && !identity.revokedAt;
}

function isTerminalAttemptStatus(status) {
    return [
        PHONE_LINK_ATTEMPT_STATUS.verified,
        PHONE_LINK_ATTEMPT_STATUS.failed,
        PHONE_LINK_ATTEMPT_STATUS.expired,
        PHONE_LINK_ATTEMPT_STATUS.conflict,
        PHONE_LINK_ATTEMPT_STATUS.manualReview,
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

async function findDuplicateRawPhoneUsers(store, phoneE164) {
    const matchingUsers = await store.getRawPhoneUsersByNormalizedPhone(phoneE164);
    return Array.isArray(matchingUsers) ? matchingUsers : [];
}

async function assertNoUnresolvedRawPhoneDuplicate(store, phoneE164, currentUserId, ownerIdentity = null) {
    if (isSameActiveIdentity(ownerIdentity, currentUserId, phoneE164)) return;

    const duplicateUsers = await findDuplicateRawPhoneUsers(store, phoneE164);
    if (duplicateUsers.length > 1) {
        throw createPhoneLinkError(
            'This phone is used by more than one account and needs manual review before it can be verified.',
            409,
            'manual_review_required',
        );
    }
}

export function createPhoneIdentityLinkStore(db) {
    return {
        async getActiveIdentityByUserId(userId) {
            const [row] = await db.select()
                .from(userPhoneIdentities)
                .where(and(eq(userPhoneIdentities.userId, userId), isNull(userPhoneIdentities.revokedAt)))
                .limit(1);
            return row || null;
        },
        async getActiveIdentityByPhone(phoneE164) {
            const [row] = await db.select()
                .from(userPhoneIdentities)
                .where(and(eq(userPhoneIdentities.phoneE164, phoneE164), isNull(userPhoneIdentities.revokedAt)))
                .limit(1);
            return row || null;
        },
        async getRawPhoneUsersByNormalizedPhone(phoneE164) {
            const rows = await db.select({
                id: users.id,
                username: users.username,
                role: users.role,
                phone: users.phone,
            }).from(users);

            return rows
                .filter((row) => normalizeSingaporePhoneIdentity(row.phone) === phoneE164)
                .map(({ id, username, role }) => ({ id, username, role }));
        },
        async createAttempt(values) {
            const [row] = await db.insert(phoneVerificationAttempts).values(values).returning();
            return row;
        },
        async getAttemptByIdForUser(attemptId, userId) {
            const [row] = await db.select()
                .from(phoneVerificationAttempts)
                .where(and(
                    eq(phoneVerificationAttempts.id, attemptId),
                    eq(phoneVerificationAttempts.userId, userId),
                ))
                .limit(1);
            return row || null;
        },
        async updateAttempt(attemptId, values) {
            const [row] = await db.update(phoneVerificationAttempts)
                .set({ ...values, updatedAt: new Date() })
                .where(eq(phoneVerificationAttempts.id, attemptId))
                .returning();
            return row;
        },
        async createVerifiedIdentity(values) {
            const phoneParts = splitSingaporeE164(values.phoneE164);
            const [row] = await db.insert(userPhoneIdentities).values({
                userId: values.userId,
                phoneE164: values.phoneE164,
                countryCode: phoneParts.countryCode,
                nationalNumber: phoneParts.nationalNumber,
                status: 'verified',
                source: 'gudauth',
                providerSubject: values.providerSubject || null,
                verifiedAt: new Date(),
                createdByUserId: values.userId,
            }).returning();
            return row;
        },
        async upgradeIdentityToVerified(identityId, values) {
            const [row] = await db.update(userPhoneIdentities)
                .set({
                    status: 'verified',
                    source: 'gudauth',
                    providerSubject: values.providerSubject || null,
                    verifiedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(userPhoneIdentities.id, identityId))
                .returning();
            return row;
        },
    };
}

export async function getPhoneIdentitySummary(store, user) {
    const identity = await store.getActiveIdentityByUserId(user.id);
    const normalizedProfilePhone = normalizeSingaporePhoneIdentity(user.phone);

    return {
        identity: serializeIdentity(identity),
        profilePhone: normalizedProfilePhone ? maskPhoneIdentity(normalizedProfilePhone) : null,
        canStartLink: Boolean(normalizedProfilePhone),
    };
}

export async function startPhoneIdentityLinkAttempt({ store, gudAuthClient, user, input = {} }) {
    const phoneE164 = normalizeSingaporePhoneIdentity(input.phone ?? user.phone);
    if (!phoneE164) {
        throw createPhoneLinkError('Enter a valid Singapore phone number before verifying WhatsApp.', 400, 'invalid_phone');
    }

    const activeForUser = await store.getActiveIdentityByUserId(user.id);
    if (activeForUser && activeForUser.phoneE164 !== phoneE164) {
        throw createPhoneLinkError(
            'This account already has a different phone identity. Please contact support before changing it.',
            409,
            'different_active_phone',
        );
    }

    const activeForPhone = await store.getActiveIdentityByPhone(phoneE164);
    if (activeForPhone && activeForPhone.userId !== user.id) {
        throw createPhoneLinkError(
            'This phone is already linked to another account.',
            409,
            'phone_owned_by_another_account',
        );
    }

    await assertNoUnresolvedRawPhoneDuplicate(store, phoneE164, user.id, activeForPhone);

    if (isSameActiveIdentity(activeForPhone, user.id, phoneE164) && activeForPhone.status === 'verified') {
        return {
            status: PHONE_LINK_ATTEMPT_STATUS.verified,
            identity: serializeIdentity(activeForPhone),
        };
    }

    const attempt = await store.createAttempt({
        userId: user.id,
        provider: 'gudauth',
        requestedPhoneE164: phoneE164,
        status: PHONE_LINK_ATTEMPT_STATUS.pending,
    });
    const challenge = await gudAuthClient.createChallenge({
        phoneNumber: phoneE164,
        returnUrl: PHONE_LINK_RETURN_URL,
        referenceId: `carearound-phone-link:${attempt.id}`,
        externalUserId: String(user.id),
    });
    const providerChallengeId = extractChallengeId(challenge);
    if (!providerChallengeId) {
        await store.updateAttempt(attempt.id, {
            status: PHONE_LINK_ATTEMPT_STATUS.failed,
            failureReason: 'provider_missing_challenge_id',
        });
        throw createPhoneLinkError('Phone verification provider did not return a challenge id.', 502, 'provider_missing_challenge_id');
    }

    const updatedAttempt = await store.updateAttempt(attempt.id, {
        providerChallengeId,
        providerStatus: challenge.status || null,
        expiresAt: challenge.expiresAt ? new Date(challenge.expiresAt) : null,
    });

    return {
        attemptId: updatedAttempt.id,
        status: updatedAttempt.status,
        phone: maskPhoneIdentity(phoneE164),
        challenge: sanitizeChallenge(challenge),
    };
}

async function finalizeVerifiedPhone({ store, user, attempt, phoneE164, providerSubject }) {
    const activeForPhone = await store.getActiveIdentityByPhone(phoneE164);
    if (activeForPhone && activeForPhone.userId !== user.id) {
        const updated = await store.updateAttempt(attempt.id, {
            status: PHONE_LINK_ATTEMPT_STATUS.conflict,
            verifiedPhoneE164: phoneE164,
            failureReason: 'phone_owned_by_another_account',
        });
        return serializeAttemptStatus(updated, { reason: 'phone_owned_by_another_account' });
    }

    try {
        await assertNoUnresolvedRawPhoneDuplicate(store, phoneE164, user.id, activeForPhone);
    } catch (err) {
        if (err.code !== 'manual_review_required') throw err;
        const updated = await store.updateAttempt(attempt.id, {
            status: PHONE_LINK_ATTEMPT_STATUS.manualReview,
            verifiedPhoneE164: phoneE164,
            failureReason: 'manual_review_required',
        });
        return serializeAttemptStatus(updated, { reason: 'manual_review_required' });
    }

    const activeForUser = activeForPhone || await store.getActiveIdentityByUserId(user.id);
    let identity = null;

    if (activeForUser) {
        if (activeForUser.phoneE164 !== phoneE164) {
            const updated = await store.updateAttempt(attempt.id, {
                status: PHONE_LINK_ATTEMPT_STATUS.conflict,
                verifiedPhoneE164: phoneE164,
                failureReason: 'different_active_phone',
            });
            return serializeAttemptStatus(updated, { reason: 'different_active_phone' });
        }

        identity = activeForUser.status === 'verified'
            ? activeForUser
            : await store.upgradeIdentityToVerified(activeForUser.id, { providerSubject });
    } else {
        identity = await store.createVerifiedIdentity({
            userId: user.id,
            phoneE164,
            providerSubject,
        });
    }

    const updated = await store.updateAttempt(attempt.id, {
        status: PHONE_LINK_ATTEMPT_STATUS.verified,
        verifiedPhoneE164: phoneE164,
        providerStatus: PHONE_LINK_ATTEMPT_STATUS.verified,
    });

    return serializeAttemptStatus(updated, {
        identity: serializeIdentity(identity),
    });
}

export async function pollPhoneIdentityLinkAttempt({ store, gudAuthClient, user, attemptId }) {
    const attempt = await store.getAttemptByIdForUser(attemptId, user.id);
    if (!attempt) {
        throw createPhoneLinkError('Phone verification attempt was not found.', 404, 'attempt_not_found');
    }

    if (isTerminalAttemptStatus(attempt.status)) {
        return serializeAttemptStatus(attempt);
    }

    if (!attempt.providerChallengeId) {
        throw createPhoneLinkError('Phone verification attempt is missing its provider challenge.', 500, 'missing_provider_challenge');
    }

    const challenge = await gudAuthClient.getChallenge(attempt.providerChallengeId);
    const challengeState = normalizeChallengeState(challenge);

    if (challengeState === PHONE_LINK_ATTEMPT_STATUS.pending) {
        const updated = await store.updateAttempt(attempt.id, {
            status: PHONE_LINK_ATTEMPT_STATUS.pending,
            providerStatus: challenge.status || null,
        });
        return serializeAttemptStatus(updated, { challenge: sanitizeChallenge(challenge) });
    }

    if (challengeState === PHONE_LINK_ATTEMPT_STATUS.failed || challengeState === PHONE_LINK_ATTEMPT_STATUS.expired) {
        const updated = await store.updateAttempt(attempt.id, {
            status: challengeState,
            providerStatus: challenge.status || null,
            failureReason: challengeState,
        });
        return serializeAttemptStatus(updated);
    }

    const verifiedPhoneE164 = normalizeSingaporePhoneIdentity(extractProviderPhone(challenge));
    if (!verifiedPhoneE164) {
        const updated = await store.updateAttempt(attempt.id, {
            status: PHONE_LINK_ATTEMPT_STATUS.failed,
            providerStatus: challenge.status || null,
            failureReason: 'provider_missing_verified_phone',
        });
        return serializeAttemptStatus(updated, { reason: 'provider_missing_verified_phone' });
    }

    return finalizeVerifiedPhone({
        store,
        user,
        attempt,
        phoneE164: verifiedPhoneE164,
        providerSubject: extractProviderSubject(challenge),
    });
}
