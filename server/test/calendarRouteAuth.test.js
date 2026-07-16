import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/worker.js';

test('Care Calendar endpoints require an authenticated user', async () => {
    const response = await worker.fetch(
        new Request('http://localhost/api/calendar'),
        {},
        { waitUntil() {} },
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'No token provided' });
});
