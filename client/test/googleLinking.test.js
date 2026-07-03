import test from 'node:test';
import assert from 'node:assert/strict';

import {
    finishEmailLoginWithPendingGoogleLink,
    getGoogleLinkRequiredMessage,
    isGoogleLinkRequiredError,
} from '../src/lib/googleLinking.js';

test('Google link-required errors get a plain next-step message', () => {
    assert.equal(isGoogleLinkRequiredError({ code: 'google_link_required' }), true);
    assert.equal(isGoogleLinkRequiredError({ code: 'other_error' }), false);
    assert.equal(
        getGoogleLinkRequiredMessage(),
        "That Google account matches your email account. Sign in with email once and we'll link Google for next time.",
    );
});

test('email sign-in completes a pending Google link before the login handoff', async () => {
    const calls = [];
    const emailLoginResult = { user: { id: 10, email: 'user@example.test' } };
    const linkedUser = { id: 10, email: 'user@example.test', googleLinked: true };

    const result = await finishEmailLoginWithPendingGoogleLink({
        apiClient: {
            linkGoogleAuth: async (body) => {
                calls.push(body);
                return { user: linkedUser };
            },
        },
        emailLoginResult,
        pendingGoogleCredential: 'google-credential',
    });

    assert.deepEqual(calls, [{ credential: 'google-credential' }]);
    assert.deepEqual(result, { user: linkedUser, linkedGoogle: true });
});

test('email sign-in skips Google linking when no pending credential exists', async () => {
    const emailLoginResult = { user: { id: 10, email: 'user@example.test' } };

    const result = await finishEmailLoginWithPendingGoogleLink({
        apiClient: {
            linkGoogleAuth: async () => {
                throw new Error('link should not be called');
            },
        },
        emailLoginResult,
        pendingGoogleCredential: '',
    });

    assert.deepEqual(result, { user: emailLoginResult.user, linkedGoogle: false });
});
