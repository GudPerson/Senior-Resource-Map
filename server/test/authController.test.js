import test from 'node:test';
import assert from 'node:assert/strict';

import { Hono } from 'hono';

import { me } from '../src/controllers/authController.js';
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
