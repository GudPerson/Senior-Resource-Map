import test from 'node:test';
import assert from 'node:assert/strict';
import { sign } from 'hono/jwt';

import app from '../src/app.js';

test('direct resource operators cannot create global sub-categories', async () => {
    const token = await sign({
        id: 55,
        username: 'direct-staff',
        email: 'staff@example.com',
        role: 'standard',
        name: 'Direct Staff',
        hardAssetStaffAccess: [{ hardAssetId: 10, staffRole: 'staff' }],
        exp: Math.floor(Date.now() / 1000) + 60,
    }, 'unit-secret', 'HS256');

    const response = await app.fetch(new Request('https://app.carearound.sg/api/sub-categories', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': token,
        },
        body: JSON.stringify({ name: 'Global Test Category', type: 'hard' }),
    }), {
        JWT_SECRET: 'unit-secret',
        AUTH_TEST_LIVE_SESSION_USER_RESOLVER: async (user) => user,
    });

    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, 'Insufficient permissions');
});
