import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PHONE_LOGIN_ATTEMPT_STATUS,
    pollPhoneLoginAttempt,
    startPhoneLoginAttempt,
} from '../src/utils/phoneLogin.js';

const BASE_USER = {
    id: 45,
    username: 'joshua',
    email: 'joshua@example.com',
    role: 'standard',
    name: 'Joshua',
    phone: '83682962',
    postalCode: '160024',
    subregionIds: [],
};

function createMemoryStore({
    users = [BASE_USER],
    identities = [],
    attempts = [],
} = {}) {
    const state = {
        users: users.map((user) => ({ ...user })),
        identities: identities.map((identity) => ({ ...identity })),
        attempts: attempts.map((attempt) => ({ ...attempt })),
        nextAttemptId: attempts.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
    };

    return {
        state,
        async createAttempt(values) {
            const row = {
                id: state.nextAttemptId++,
                provider: 'gudauth',
                status: PHONE_LOGIN_ATTEMPT_STATUS.pending,
                createdAt: new Date('2026-05-08T10:00:00.000Z'),
                updatedAt: new Date('2026-05-08T10:00:00.000Z'),
                ...values,
            };
            state.attempts.push(row);
            return row;
        },
        async getAttemptById(attemptId) {
            return state.attempts.find((attempt) => attempt.id === attemptId) || null;
        },
        async updateAttempt(attemptId, values) {
            const attempt = state.attempts.find((item) => item.id === attemptId);
            Object.assign(attempt, values, { updatedAt: new Date('2026-05-08T10:05:00.000Z') });
            return attempt;
        },
        async findVerifiedIdentitiesByPhone(phoneE164) {
            return state.identities
                .filter((identity) => (
                    identity.phoneE164 === phoneE164
                    && identity.status === 'verified'
                    && !identity.revokedAt
                ))
                .map((identity) => ({ ...identity }));
        },
        async getUserWithSubregions(userId) {
            const user = state.users.find((item) => item.id === userId);
            return user ? { ...user } : null;
        },
    };
}

test('phone login start creates a GudAuth challenge without a browser-side GudAuth call', async () => {
    const store = createMemoryStore();
    const calls = [];
    const result = await startPhoneLoginAttempt({
        store,
        gudAuthClient: {
            async createChallenge(payload) {
                calls.push(payload);
                return {
                    ok: true,
                    data: {
                        challenge: {
                            id: 'login-challenge-1',
                            status: 'pending',
                            expiresAt: '2026-05-08T10:15:00.000Z',
                        },
                        deepLink: 'https://wa.me/6587651901?text=WAP-111222',
                    },
                };
            },
        },
        input: { phone: '83682962' },
    });

    assert.equal(result.status, 'pending');
    assert.equal(result.attemptId, 1);
    assert.equal(result.phone, '+65****2962');
    assert.equal(result.challenge.id, 'login-challenge-1');
    assert.equal(result.challenge.whatsappUrl, 'https://wa.me/6587651901?text=WAP-111222');
    assert.deepEqual(calls, [{
        phoneNumber: '+6583682962',
        returnUrl: 'https://app.carearound.sg/login?gudauth=phone_login',
        referenceId: 'carearound-phone-login:1',
    }]);
});

test('verified phone login resolves exactly one active verified phone identity', async () => {
    const store = createMemoryStore({
        identities: [{
            id: 5,
            userId: BASE_USER.id,
            phoneE164: '+6583682962',
            status: 'verified',
            source: 'gudauth',
            revokedAt: null,
        }],
        attempts: [{
            id: 2,
            provider: 'gudauth',
            providerChallengeId: 'login-challenge-2',
            requestedPhoneE164: '+6583682962',
            status: 'pending',
        }],
    });

    const result = await pollPhoneLoginAttempt({
        store,
        gudAuthClient: {
            async getChallenge(id) {
                assert.equal(id, 'login-challenge-2');
                return {
                    id,
                    status: 'verified',
                    phoneE164: '+65 8368 2962',
                    subject: 'whatsapp:+6583682962',
                };
            },
        },
        attemptId: 2,
    });

    assert.equal(result.status, 'verified');
    assert.equal(result.user.id, BASE_USER.id);
    assert.equal(store.state.attempts[0].resolvedUserId, BASE_USER.id);
    assert.equal(store.state.attempts[0].verifiedPhoneE164, '+6583682962');
});

test('phone login never trusts raw users.phone without a verified identity', async () => {
    const store = createMemoryStore({
        users: [{ ...BASE_USER, phone: '83682962' }],
        identities: [],
        attempts: [{
            id: 3,
            provider: 'gudauth',
            providerChallengeId: 'login-challenge-3',
            requestedPhoneE164: '+6583682962',
            status: 'pending',
        }],
    });

    const result = await pollPhoneLoginAttempt({
        store,
        gudAuthClient: {
            async getChallenge() {
                return { status: 'verified', phoneE164: '+6583682962' };
            },
        },
        attemptId: 3,
    });

    assert.equal(result.status, 'no_account');
    assert.equal(result.user, undefined);
    assert.equal(result.reason, 'no_verified_account');
    assert.doesNotMatch(JSON.stringify(result), /\+6583682962/);
});

test('legacy unverified phone identities cannot be used for phone login', async () => {
    const store = createMemoryStore({
        identities: [{
            id: 6,
            userId: BASE_USER.id,
            phoneE164: '+6583682962',
            status: 'legacy_unverified',
            source: 'legacy_profile',
            revokedAt: null,
        }],
        attempts: [{
            id: 4,
            provider: 'gudauth',
            providerChallengeId: 'login-challenge-4',
            requestedPhoneE164: '+6583682962',
            status: 'pending',
        }],
    });

    const result = await pollPhoneLoginAttempt({
        store,
        gudAuthClient: {
            async getChallenge() {
                return { status: 'verified', phoneE164: '+6583682962' };
            },
        },
        attemptId: 4,
    });

    assert.equal(result.status, 'no_account');
    assert.equal(result.reason, 'no_verified_account');
});

test('revoked phone identities cannot be used for phone login', async () => {
    const store = createMemoryStore({
        identities: [{
            id: 7,
            userId: BASE_USER.id,
            phoneE164: '+6583682962',
            status: 'verified',
            source: 'gudauth',
            revokedAt: new Date('2026-05-08T10:00:00.000Z'),
        }],
        attempts: [{
            id: 5,
            provider: 'gudauth',
            providerChallengeId: 'login-challenge-5',
            requestedPhoneE164: '+6583682962',
            status: 'pending',
        }],
    });

    const result = await pollPhoneLoginAttempt({
        store,
        gudAuthClient: {
            async getChallenge() {
                return { status: 'verified', phoneE164: '+6583682962' };
            },
        },
        attemptId: 5,
    });

    assert.equal(result.status, 'no_account');
    assert.equal(result.reason, 'no_verified_account');
});

test('defensive phone login conflict blocks multiple verified identities for one phone', async () => {
    const store = createMemoryStore({
        identities: [
            {
                id: 8,
                userId: BASE_USER.id,
                phoneE164: '+6583682962',
                status: 'verified',
                source: 'gudauth',
                revokedAt: null,
            },
            {
                id: 9,
                userId: 99,
                phoneE164: '+6583682962',
                status: 'verified',
                source: 'gudauth',
                revokedAt: null,
            },
        ],
        attempts: [{
            id: 6,
            provider: 'gudauth',
            providerChallengeId: 'login-challenge-6',
            requestedPhoneE164: '+6583682962',
            status: 'pending',
        }],
    });

    const result = await pollPhoneLoginAttempt({
        store,
        gudAuthClient: {
            async getChallenge() {
                return { status: 'verified', phoneE164: '+6583682962' };
            },
        },
        attemptId: 6,
    });

    assert.equal(result.status, 'conflict');
    assert.equal(result.reason, 'multiple_verified_accounts');
    assert.equal(result.user, undefined);
});
