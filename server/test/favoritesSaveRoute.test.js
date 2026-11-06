import test from 'node:test';
import assert from 'node:assert/strict';
import favoritesRoutes from '../src/routes/favorites.js';

test('explicit Save endpoint and existing toggle both require the established authenticated session', async () => {
    for (const path of ['/save', '/toggle']) {
        const response = await favoritesRoutes.request(`http://localhost${path}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resourceType: 'hard', resourceId: 29 }),
        }, {});
        assert.equal(response.status, 401);
        const body = await response.json();
        assert.equal(Object.hasOwn(body, 'saved'), false);
    }
    assert.equal((await favoritesRoutes.request('http://localhost/save')).status, 404);
});
