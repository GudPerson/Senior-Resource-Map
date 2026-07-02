import test from 'node:test';
import assert from 'node:assert/strict';

import { Hono } from 'hono';

import {
    isVerifiedGoogleEmail,
    me,
    normalizeGoogleSubject,
    shouldRejectGoogleEmailOnlyAccountLink,
} from '../src/controllers/authController.js';
import { createSessionToken, SESSION_HEADER_NAME } from '../src/utils/sessionAuth.js';

const TEST_ENV = {
    NODE_ENV: 'development',
    JWT_SECRET: 'auth-controller-test-secret',
};

test('/auth/me returns a server error instead of clearing the session when live user lookup fails', async () => {
    const app = new Hono();
    app.get('/api/auth/me', me);
    const token = await createSessionToken({
        id: 1,
        username: 'gudperson',
        email: 'gudperson@example.com',
        role: 'super_admin',
        name: 'GudPerson',
        postalCode: '',
        subregionIds: [],
    }, { env: TEST_ENV });
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        const response = await app.fetch(new Request('http://localhost/api/auth/me', {
            headers: {
                [SESSION_HEADER_NAME]: token,
            },
        }), TEST_ENV, { waitUntil() {} });
        const payload = await response.json();

        assert.equal(response.status, 500);
        assert.equal(payload.error, 'Session check failed');
    } finally {
        console.error = originalConsoleError;
    }
});

test('Google sign-in policy requires verified stable subject identity', () => {
    assert.equal(normalizeGoogleSubject({ sub: ' google-sub-123 ' }), 'google-sub-123');
    assert.equal(normalizeGoogleSubject({ email: 'user@example.test' }), '');
    assert.equal(isVerifiedGoogleEmail({ email_verified: true }), true);
    assert.equal(isVerifiedGoogleEmail({ email_verified: 'true' }), true);
    assert.equal(isVerifiedGoogleEmail({ email_verified: false }), false);
});

test('Google sign-in rejects email-only linking to an existing account', () => {
    const existingEmailUser = { id: 10, email: 'user@example.test' };
    const existingSubjectUser = { id: 11, googleSubject: 'google-sub-123' };

    assert.equal(shouldRejectGoogleEmailOnlyAccountLink(null, existingEmailUser), true);
    assert.equal(shouldRejectGoogleEmailOnlyAccountLink(existingSubjectUser, existingEmailUser), false);
    assert.equal(shouldRejectGoogleEmailOnlyAccountLink(null, null), false);
});
