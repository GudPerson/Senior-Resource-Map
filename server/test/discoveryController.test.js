import test from 'node:test';
import assert from 'node:assert/strict';

import app from '../src/app.js';

test('discovery location indicator route returns an empty map before database work when no resources are sent', async () => {
    const response = await app.fetch(
        new Request('https://app.carearound.sg/api/discovery/location-indicators', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'https://app.carearound.sg',
            },
            body: JSON.stringify({ resources: [] }),
        }),
        { NODE_ENV: 'test' },
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.carearound.sg');
    assert.deepEqual(await response.json(), { indicators: {} });
});
