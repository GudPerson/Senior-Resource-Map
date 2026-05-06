import test from 'node:test';
import assert from 'node:assert/strict';

import app from '../src/app.js';
import {
    PHONE_LINK_ATTEMPT_STATUS,
    getPhoneIdentitySummary,
    pollPhoneIdentityLinkAttempt,
    startPhoneIdentityLinkAttempt,
} from '../src/utils/phoneIdentityLinking.js';

const DEFAULT_USER = {
    id: 7,
    username: 'jane',
    email: 'jane@example.com',
    role: 'standard',
    name: 'Jane',
    phone: '+65 8368 2962',
};

function createMemoryStore({
    users = [DEFAULT_USER],
    identities = [],
    attempts = [],
} = {}) {
    const state = {
        users: users.map((user) => ({ ...user })),
        identities: identities.map((identity) => ({ ...identity })),
        attempts: attempts.map((attempt) => ({ ...attempt })),
        nextIdentityId: identities.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
        nextAttemptId: attempts.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1,
    };

    return {
        state,
        async getActiveIdentityByUserId(userId) {
            return state.identities.find((identity) => identity.userId === userId && !identity.revokedAt) || null;
        },
        async getActiveIdentityByPhone(phoneE164) {
            return state.identities.find((identity) => identity.phoneE164 === phoneE164 && !identity.revokedAt) || null;
        },
        async getRawPhoneUsersByNormalizedPhone(phoneE164) {
            const { normalizeSingaporePhoneIdentity } = await import('../src/utils/phoneIdentity.js');
            return state.users
                .filter((user) => normalizeSingaporePhoneIdentity(user.phone) === phoneE164)
                .map(({ id, username, role }) => ({ id, username, role }));
        },
        async createAttempt(values) {
            const row = {
                id: state.nextAttemptId++,
                provider: 'gudauth',
                status: PHONE_LINK_ATTEMPT_STATUS.pending,
                createdAt: new Date('2026-05-06T10:00:00.000Z'),
                updatedAt: new Date('2026-05-06T10:00:00.000Z'),
                ...values,
            };
            state.attempts.push(row);
            return row;
        },
        async getAttemptByIdForUser(attemptId, userId) {
            return state.attempts.find((attempt) => attempt.id === attemptId && attempt.userId === userId) || null;
        },
        async updateAttempt(attemptId, values) {
            const attempt = state.attempts.find((item) => item.id === attemptId);
            Object.assign(attempt, values, { updatedAt: new Date('2026-05-06T10:05:00.000Z') });
            return attempt;
        },
        async createVerifiedIdentity(values) {
            const row = {
                id: state.nextIdentityId++,
                countryCode: '+65',
                nationalNumber: values.phoneE164.slice(3),
                status: 'verified',
                source: 'gudauth',
                verifiedAt: new Date('2026-05-06T10:05:00.000Z'),
                revokedAt: null,
                createdAt: new Date('2026-05-06T10:05:00.000Z'),
                updatedAt: new Date('2026-05-06T10:05:00.000Z'),
                ...values,
            };
            state.identities.push(row);
            return row;
        },
        async upgradeIdentityToVerified(identityId, values) {
            const identity = state.identities.find((item) => item.id === identityId);
            Object.assign(identity, {
                status: 'verified',
                source: 'gudauth',
                verifiedAt: new Date('2026-05-06T10:05:00.000Z'),
                updatedAt: new Date('2026-05-06T10:05:00.000Z'),
                ...values,
            });
            return identity;
        },
    };
}

test('phone identity route blocks logged-out link starts before database or GudAuth work', async () => {
    const response = await app.fetch(new Request('https://app.carearound.sg/api/phone-identities/link/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '83682962' }),
    }), { NODE_ENV: 'test' });

    assert.equal(response.status, 401);
    const body = await response.json();
    assert.match(body.error, /No token provided/);
});

test('phone identity summary masks the active identity and never exposes full phone secrets', async () => {
    const store = createMemoryStore({
        identities: [{
            id: 4,
            userId: DEFAULT_USER.id,
            phoneE164: '+6583682962',
            status: 'legacy_unverified',
            source: 'legacy_profile',
            verifiedAt: null,
            revokedAt: null,
        }],
    });

    const summary = await getPhoneIdentitySummary(store, DEFAULT_USER);

    assert.equal(summary.identity.status, 'legacy_unverified');
    assert.equal(summary.identity.phone, '+65****2962');
    assert.equal(summary.profilePhone, '+65****2962');
    assert.doesNotMatch(JSON.stringify(summary), /\+6583682962/);
});

test('starting a link creates a CareAround attempt and calls GudAuth server-side', async () => {
    const store = createMemoryStore();
    const calls = [];
    const gudAuthClient = {
        async createChallenge(payload) {
            calls.push(payload);
            return {
                id: 'gudauth-challenge-1',
                status: 'pending',
                expiresAt: '2026-05-06T10:15:00.000Z',
            };
        },
    };

    const result = await startPhoneIdentityLinkAttempt({
        store,
        gudAuthClient,
        user: DEFAULT_USER,
        input: {},
    });

    assert.equal(result.status, 'pending');
    assert.equal(result.attemptId, 1);
    assert.equal(result.challenge.id, 'gudauth-challenge-1');
    assert.equal(store.state.attempts[0].providerChallengeId, 'gudauth-challenge-1');
    assert.equal(store.state.attempts[0].requestedPhoneE164, '+6583682962');
    assert.deepEqual(calls, [{
        phoneE164: '+6583682962',
        referenceId: 'carearound-phone-link:1',
        externalUserId: '7',
    }]);
});

test('verified GudAuth phone upgrades the current user legacy identity', async () => {
    const store = createMemoryStore({
        identities: [{
            id: 8,
            userId: DEFAULT_USER.id,
            phoneE164: '+6583682962',
            countryCode: '+65',
            nationalNumber: '83682962',
            status: 'legacy_unverified',
            source: 'legacy_profile',
            verifiedAt: null,
            revokedAt: null,
        }],
        attempts: [{
            id: 3,
            userId: DEFAULT_USER.id,
            provider: 'gudauth',
            providerChallengeId: 'gudauth-challenge-3',
            requestedPhoneE164: '+6583682962',
            status: 'pending',
        }],
    });
    const originalUserPhone = store.state.users[0].phone;
    const gudAuthClient = {
        async getChallenge(id) {
            assert.equal(id, 'gudauth-challenge-3');
            return {
                id,
                status: 'verified',
                phoneE164: '+65 8368 2962',
                subject: 'whatsapp:+6583682962',
            };
        },
    };

    const result = await pollPhoneIdentityLinkAttempt({
        store,
        gudAuthClient,
        user: DEFAULT_USER,
        attemptId: 3,
    });

    assert.equal(result.status, 'verified');
    assert.equal(store.state.identities[0].status, 'verified');
    assert.equal(store.state.identities[0].source, 'gudauth');
    assert.equal(store.state.identities[0].providerSubject, 'whatsapp:+6583682962');
    assert.equal(store.state.users[0].phone, originalUserPhone);
});

test('verified phone already owned by another user returns conflict without changing ownership', async () => {
    const store = createMemoryStore({
        identities: [{
            id: 10,
            userId: 99,
            phoneE164: '+6583682962',
            status: 'verified',
            source: 'gudauth',
            revokedAt: null,
        }],
        attempts: [{
            id: 4,
            userId: DEFAULT_USER.id,
            provider: 'gudauth',
            providerChallengeId: 'gudauth-challenge-4',
            requestedPhoneE164: '+6583682962',
            status: 'pending',
        }],
    });
    const gudAuthClient = {
        async getChallenge() {
            return { status: 'verified', phoneE164: '+6583682962' };
        },
    };

    const result = await pollPhoneIdentityLinkAttempt({
        store,
        gudAuthClient,
        user: DEFAULT_USER,
        attemptId: 4,
    });

    assert.equal(result.status, 'conflict');
    assert.equal(result.reason, 'phone_owned_by_another_account');
    assert.equal(store.state.identities.length, 1);
    assert.equal(store.state.identities[0].userId, 99);
});

test('unresolved duplicate raw profile phones require manual review before GudAuth is called', async () => {
    const store = createMemoryStore({
        users: [
            { ...DEFAULT_USER, id: 70, username: 'FYCS-CCK', role: 'partner', phone: '+65 9123 6322' },
            { id: 73, username: 'FYCS-BL', role: 'partner', phone: '91236322' },
        ],
    });
    let gudAuthCalled = false;

    await assert.rejects(
        () => startPhoneIdentityLinkAttempt({
            store,
            gudAuthClient: {
                async createChallenge() {
                    gudAuthCalled = true;
                    return { id: 'should-not-happen' };
                },
            },
            user: { ...DEFAULT_USER, id: 70, phone: '+65 9123 6322' },
            input: {},
        }),
        (err) => err.status === 409 && err.code === 'manual_review_required',
    );

    assert.equal(gudAuthCalled, false);
    assert.equal(store.state.attempts.length, 0);
});
