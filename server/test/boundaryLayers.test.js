import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';

import {
    getBoundaryLayers,
    replaceUnmappedBoundary,
    upsertRegionBoundary,
} from '../src/controllers/boundaryLayersController.js';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';

test('boundary layers reassign safely while operational Subregion routing stays unchanged', async (t) => {
    const { pg, env } = await createNeonPostgresFixture(t);
    await pg.exec(`
        INSERT INTO subregions (id, subregion_code, name, postal_patterns)
            VALUES (1, 'SR-HOU3', 'Hougang-3', '545610');
        INSERT INTO subregion_postal_codes (subregion_id, postal_code)
            VALUES (1, '545610');
    `);

    const appFor = (actor) => {
        const app = new Hono();
        app.use('*', async (c, next) => {
            c.set('user', actor);
            await next();
        });
        app.get('/api/boundary-layers', getBoundaryLayers);
        app.post('/api/boundary-layers/regions', upsertRegionBoundary);
        app.post('/api/boundary-layers/unmapped', replaceUnmappedBoundary);
        return app;
    };
    const request = async (path, body, actor = { id: 1, role: 'super_admin' }, method = 'POST') => {
        const response = await appFor(actor).request(path, {
            method,
            ...(body === undefined ? {} : {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }),
        }, env);
        return { status: response.status, data: await response.json() };
    };
    const putRegion = (name, postalCodes, mode = 'replace') => request('/api/boundary-layers/regions', {
        name,
        postalCodes,
        subregionIds: [1],
        mode,
    });

    assert.equal((await putRegion('Serangoon', '545610')).status, 200);
    assert.equal((await putRegion('Hougang', '545610')).status, 200);
    assert.equal((await putRegion('hougang', '545611', 'append')).status, 200);

    assert.deepEqual((await pg.query(`
        SELECT r.name, rpc.postal_code
        FROM region_postal_codes rpc
        JOIN regions r ON r.id = rpc.region_id
        ORDER BY rpc.postal_code
    `)).rows, [
        { name: 'Hougang', postal_code: '545610' },
        { name: 'Hougang', postal_code: '545611' },
    ]);
    assert.deepEqual((await pg.query(`
        SELECT r.name, rs.subregion_id
        FROM region_subregions rs
        JOIN regions r ON r.id = rs.region_id
    `)).rows, [{ name: 'Hougang', subregion_id: 1 }]);
    assert.equal((await pg.query("SELECT count(*)::int AS count FROM regions WHERE lower(name) = 'hougang'")).rows[0].count, 1);

    assert.equal((await request('/api/boundary-layers/unmapped', {
        postalCodes: '545611',
        mode: 'replace',
    })).status, 200);
    const summary = await request('/api/boundary-layers?includeUnmappedPostalCodes=true', undefined, undefined, 'GET');
    assert.equal(summary.status, 200);
    assert.deepEqual(summary.data.unmapped, {
        name: 'Unmapped',
        postalCodeCount: 1,
        postalCodesList: ['545611'],
    });
    assert.deepEqual(summary.data.regions.find((region) => region.name === 'Hougang').subregionIds, [1]);
    assert.equal(summary.data.regions.find((region) => region.name === 'Hougang').postalCodeCount, 1);

    assert.deepEqual((await pg.query(`
        SELECT subregion_id, postal_code
        FROM subregion_postal_codes
        ORDER BY subregion_id, postal_code
    `)).rows, [{ subregion_id: 1, postal_code: '545610' }]);
    assert.equal((await putRegion('Hougang', '545610-545611')).status, 200);
    assert.equal((await pg.query('SELECT count(*)::int AS count FROM unmapped_postal_codes')).rows[0].count, 0);

    const forbidden = await request('/api/boundary-layers/regions', {
        name: 'Forbidden', postalCodes: '600001', subregionIds: [1], mode: 'replace',
    }, { id: 2, role: 'regional_admin' });
    assert.equal(forbidden.status, 403);
});
