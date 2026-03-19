import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/worker.js';

test('worker entry exposes the Hono app fetch handler', async () => {
    const response = await worker.fetch(new Request('http://localhost/api/health'), {}, { waitUntil() {} });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, 'ok');
    assert.ok(payload.timestamp);
});
