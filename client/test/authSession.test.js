import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ACTIVE_SESSION_EMPTY_RECHECK_ATTEMPTS,
    clearSessionContinuityMarker,
    EMPTY_SESSION_RECHECK_ATTEMPTS,
    fetchSessionJsonWithTimeout,
    getAmbiguousEmptySessionRecheckAttempts,
    hasSessionContinuityMarker,
    isAmbiguousEmptySessionResponse,
    markSessionContinuity,
    resolveImpersonationSessionFailure,
    resolveUserAfterAmbiguousEmptySession,
    resolveUserAfterSessionCheckFailure,
    SessionRequestTimeoutError,
} from '../src/lib/authSession.js';

function createMemoryStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
    };
}

test('session fetch rejects instead of waiting forever when auth endpoint stalls', async () => {
    const stalledFetch = () => new Promise(() => {});

    await assert.rejects(
        fetchSessionJsonWithTimeout('https://api.example.test/auth/me', { fetchImpl: stalledFetch, timeoutMs: 5 }),
        SessionRequestTimeoutError
    );
});

test('session fetch returns parsed JSON when auth endpoint responds in time', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ user: null }), {
        headers: { 'content-type': 'application/json' },
    });

    const result = await fetchSessionJsonWithTimeout('https://api.example.test/auth/me', { fetchImpl, timeoutMs: 50 });

    assert.equal(result.isJson, true);
    assert.deepEqual(result.data, { user: null });
});

test('successful empty session responses are ambiguous and should be rechecked', () => {
    assert.equal(
        isAmbiguousEmptySessionResponse(
            new Response(JSON.stringify({ user: null }), { status: 200 }),
            { user: null },
        ),
        true,
    );
    assert.equal(
        isAmbiguousEmptySessionResponse(
            new Response(JSON.stringify({ error: 'No token provided' }), { status: 401 }),
            { error: 'No token provided' },
        ),
        false,
    );
    assert.equal(
        isAmbiguousEmptySessionResponse(
            new Response(JSON.stringify({ user: { id: 42 } }), { status: 200 }),
            { user: { id: 42 } },
        ),
        false,
    );
    assert.ok(EMPTY_SESSION_RECHECK_ATTEMPTS >= 1);
});

test('background session check failures preserve the current signed-in user', () => {
    const currentUser = { id: 42, name: 'GudPerson', role: 'super_admin' };

    assert.equal(resolveUserAfterSessionCheckFailure(currentUser), currentUser);
    assert.equal(resolveUserAfterSessionCheckFailure(null), null);
});

test('exhausted ambiguous empty session responses preserve the current signed-in user', () => {
    const currentUser = { id: 42, name: 'GudPerson', role: 'super_admin' };

    assert.equal(resolveUserAfterAmbiguousEmptySession(currentUser), currentUser);
    assert.equal(resolveUserAfterAmbiguousEmptySession(null), null);
});

test('active or recently active sessions get a longer ambiguous empty retry window', () => {
    const currentUser = { id: 42, name: 'GudPerson', role: 'super_admin' };

    assert.equal(
        getAmbiguousEmptySessionRecheckAttempts({ currentUser }),
        ACTIVE_SESSION_EMPTY_RECHECK_ATTEMPTS,
    );
    assert.equal(
        getAmbiguousEmptySessionRecheckAttempts({ hasSessionContinuityMarker: true }),
        ACTIVE_SESSION_EMPTY_RECHECK_ATTEMPTS,
    );
    assert.equal(
        getAmbiguousEmptySessionRecheckAttempts(),
        EMPTY_SESSION_RECHECK_ATTEMPTS,
    );
    assert.ok(ACTIVE_SESSION_EMPTY_RECHECK_ATTEMPTS > EMPTY_SESSION_RECHECK_ATTEMPTS);
});

test('session continuity marker stores only a tab-local presence signal', () => {
    const storage = createMemoryStorage();

    assert.equal(hasSessionContinuityMarker(storage), false);
    markSessionContinuity(storage);
    assert.equal(hasSessionContinuityMarker(storage), true);
    clearSessionContinuityMarker(storage);
    assert.equal(hasSessionContinuityMarker(storage), false);
});

test('definitive signed-out session responses clear the current user', () => {
    const currentUser = { id: 42, name: 'GudPerson', role: 'super_admin' };

    assert.equal(
        resolveUserAfterSessionCheckFailure(currentUser, {
            response: new Response(JSON.stringify({ error: 'No token provided' }), { status: 401 }),
            data: { error: 'No token provided' },
        }),
        null
    );
    assert.equal(
        resolveUserAfterSessionCheckFailure(currentUser, {
            response: new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403 }),
            data: { error: 'Invalid token' },
        }),
        null
    );
});

test('server session check failures still preserve the current user', () => {
    const currentUser = { id: 42, name: 'GudPerson', role: 'super_admin' };

    assert.equal(
        resolveUserAfterSessionCheckFailure(currentUser, {
            response: new Response(JSON.stringify({ error: 'Database temporarily unavailable' }), { status: 500 }),
            data: { error: 'Database temporarily unavailable' },
        }),
        currentUser
    );
});

test('transient user-view session failures do not fall back to the admin cookie', () => {
    const selectedUser = { id: 77, name: 'Selected User', role: 'standard', isImpersonating: true };

    assert.deepEqual(
        resolveImpersonationSessionFailure(selectedUser, {
            error: new SessionRequestTimeoutError(5),
        }),
        {
            clearToken: false,
            retryNormalSession: false,
            user: selectedUser,
        }
    );
});

test('expired user-view tokens can exit back to the normal admin session', () => {
    const selectedUser = { id: 77, name: 'Selected User', role: 'standard', isImpersonating: true };

    assert.deepEqual(
        resolveImpersonationSessionFailure(selectedUser, {
            response: new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 }),
            data: { error: 'Invalid token' },
        }),
        {
            clearToken: true,
            retryNormalSession: true,
            user: null,
        }
    );
});
