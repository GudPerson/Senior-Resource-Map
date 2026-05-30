import test from 'node:test';
import assert from 'node:assert/strict';

import {
    fetchSessionJsonWithTimeout,
    resolveImpersonationSessionFailure,
    resolveUserAfterSessionCheckFailure,
    SessionRequestTimeoutError,
} from '../src/lib/authSession.js';

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

test('background session check failures preserve the current signed-in user', () => {
    const currentUser = { id: 42, name: 'GudPerson', role: 'super_admin' };

    assert.equal(resolveUserAfterSessionCheckFailure(currentUser), currentUser);
    assert.equal(resolveUserAfterSessionCheckFailure(null), null);
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
