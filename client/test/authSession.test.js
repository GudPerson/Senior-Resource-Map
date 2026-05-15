import test from 'node:test';
import assert from 'node:assert/strict';

import {
    fetchSessionJsonWithTimeout,
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
