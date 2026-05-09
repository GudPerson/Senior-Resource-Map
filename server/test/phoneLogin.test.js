import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PHONE_LOGIN_ATTEMPT_STATUS,
    completePhoneLoginSignup,
    createPhoneLoginStore,
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
        nextUserId: users.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextIdentityId: identities.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
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
        async findActiveIdentitiesByPhone(phoneE164) {
            return state.identities
                .filter((identity) => (
                    identity.phoneE164 === phoneE164
                    && !identity.revokedAt
                ))
                .map((identity) => ({ ...identity }));
        },
        async resolveDerivedSubregion(postalCode) {
            return postalCode ? { id: 12 } : null;
        },
        async createVerifiedPhoneSignupUser(values) {
            const user = {
                id: state.nextUserId++,
                username: values.username,
                email: values.email,
                passwordHash: values.passwordHash || 'test-password-hash',
                name: values.name,
                role: 'standard',
                phone: values.phone,
                postalCode: values.postalCode || '',
                managerUserId: null,
                subregionIds: values.derivedSubregionId ? [values.derivedSubregionId] : [],
            };
            state.users.push(user);
            state.identities.push({
                id: state.nextIdentityId++,
                userId: user.id,
                phoneE164: values.phoneE164,
                countryCode: values.countryCode,
                nationalNumber: values.nationalNumber,
                status: 'verified',
                source: 'gudauth',
                providerSubject: values.providerSubject,
                verifiedAt: values.verifiedAt,
                revokedAt: null,
            });
            return { ...user };
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
        returnUrl: 'https://app.carearound.sg/phone-login-return?attempt=1&returnTo=%2Fdashboard',
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

    assert.equal(result.status, 'signup_required');
    assert.equal(result.user, undefined);
    assert.equal(result.reason, 'signup_required');
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

    assert.equal(result.status, 'conflict');
    assert.equal(result.reason, 'phone_identity_not_verified');
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

    assert.equal(result.status, 'signup_required');
    assert.equal(result.reason, 'signup_required');
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

test('phone-first signup creates a standard user and verified phone identity after provider verification', async () => {
    const store = createMemoryStore({
        users: [],
        identities: [],
        attempts: [{
            id: 7,
            provider: 'gudauth',
            providerChallengeId: 'login-challenge-7',
            requestedPhoneE164: '+6590011859',
            verifiedPhoneE164: '+6590011859',
            status: 'signup_required',
            providerStatus: 'verified',
            failureReason: 'signup_required',
        }],
    });

    const result = await completePhoneLoginSignup({
        store,
        attemptId: 7,
        input: {
            name: 'Cynthia Peace',
            postalCode: '160024',
        },
    });

    assert.equal(result.status, 'verified');
    assert.equal(result.user.name, 'Cynthia Peace');
    assert.equal(result.user.role, 'standard');
    assert.equal(result.user.phone, '90011859');
    assert.equal(result.user.postalCode, '160024');
    assert.equal(result.user.email, 'phone+6590011859.7@phone.carearound.invalid');
    assert.equal(result.user.username, 'phone_6590011859_7');
    assert.deepEqual(result.user.subregionIds, [12]);

    const identity = store.state.identities.find((item) => item.userId === result.user.id);
    assert.equal(identity.phoneE164, '+6590011859');
    assert.equal(identity.nationalNumber, '90011859');
    assert.equal(identity.status, 'verified');
    assert.equal(identity.source, 'gudauth');
});

test('phone-first signup store avoids unsupported Neon HTTP transactions', async () => {
    const inserted = [];
    const db = {
        transaction() {
            throw new Error('No transactions support in neon-http driver');
        },
        insert(table) {
            return {
                values(values) {
                    inserted.push({ table, values });
                    return {
                        async returning() {
                            return [{
                                id: 101,
                                username: values.username,
                                email: values.email,
                                passwordHash: values.passwordHash,
                                name: values.name,
                                role: values.role,
                                phone: values.phone,
                                postalCode: values.postalCode,
                                managerUserId: values.managerUserId,
                            }];
                        },
                    };
                },
            };
        },
    };
    const store = createPhoneLoginStore(db);

    const user = await store.createVerifiedPhoneSignupUser({
        username: 'phone_6590011859_7',
        email: 'phone+6590011859.7@phone.carearound.invalid',
        passwordHash: 'hash',
        name: 'Cynthia Peace',
        phone: '90011859',
        postalCode: '160024',
        phoneE164: '+6590011859',
        countryCode: '+65',
        nationalNumber: '90011859',
        providerSubject: 'whatsapp:+6590011859',
        verifiedAt: new Date('2026-05-09T10:00:00.000Z'),
        derivedSubregionId: null,
    });

    assert.equal(user.id, 101);
    assert.equal(user.email, 'phone+6590011859.7@phone.carearound.invalid');
    assert.equal(inserted.length, 2);
    assert.equal(inserted[0].values.username, 'phone_6590011859_7');
    assert.equal(inserted[1].values.phoneE164, '+6590011859');
    assert.equal(inserted[1].values.status, 'verified');
    assert.equal(inserted[1].values.source, 'gudauth');
});

test('phone-first signup rejects attempts that are not ready for signup', async () => {
    for (const status of [
        PHONE_LOGIN_ATTEMPT_STATUS.pending,
        PHONE_LOGIN_ATTEMPT_STATUS.failed,
        PHONE_LOGIN_ATTEMPT_STATUS.expired,
        PHONE_LOGIN_ATTEMPT_STATUS.verified,
        PHONE_LOGIN_ATTEMPT_STATUS.conflict,
    ]) {
        const store = createMemoryStore({
            attempts: [{
                id: 8,
                provider: 'gudauth',
                verifiedPhoneE164: '+6590011859',
                status,
            }],
        });

        await assert.rejects(
            () => completePhoneLoginSignup({
                store,
                attemptId: 8,
                input: { name: 'Test User' },
            }),
            /not ready/i,
        );
    }
});

test('phone-first signup refuses if the verified phone becomes linked before completion', async () => {
    const store = createMemoryStore({
        users: [{ ...BASE_USER, id: 99 }],
        identities: [{
            id: 10,
            userId: 99,
            phoneE164: '+6590011859',
            status: 'verified',
            source: 'gudauth',
            revokedAt: null,
        }],
        attempts: [{
            id: 9,
            provider: 'gudauth',
            providerChallengeId: 'login-challenge-9',
            requestedPhoneE164: '+6590011859',
            verifiedPhoneE164: '+6590011859',
            status: 'signup_required',
            providerStatus: 'verified',
            failureReason: 'signup_required',
        }],
    });

    const result = await completePhoneLoginSignup({
        store,
        attemptId: 9,
        input: { name: 'New User' },
    });

    assert.equal(result.status, 'conflict');
    assert.equal(result.user, undefined);
    assert.equal(result.reason, 'phone_identity_already_linked');
    assert.equal(store.state.users.length, 1);
    assert.equal(store.state.identities.length, 1);
});
