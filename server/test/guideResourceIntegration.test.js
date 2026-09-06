import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createGuideResourceLoader, createGuideRoutes } from '../src/routes/guide.js';
import { getHardAssetById, getHardAssets } from '../src/controllers/hardAssetsController.js';
import { getSoftAssetById, getSoftAssets } from '../src/controllers/softAssetsController.js';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';

test('Guide uses actual resource controllers and PostgreSQL visibility/search rules', async (t) => {
    const { pg, env, statements } = await createNeonPostgresFixture(t);
    await pg.exec(`
        INSERT INTO users (id, username, email, password_hash, name, role) VALUES
            (1, 'fixture-member', 'member@example.test', 'not-a-password', 'Fixture member', 'standard'),
            (2, 'fixture-admin', 'admin@example.test', 'not-a-password', 'Fixture reviewer', 'super_admin');
        INSERT INTO hard_assets (id, name, lat, lng, address, country)
            SELECT id, 'Havelock fixture place ' || id, 1.29, 103.82, '1 Fixture Road', 'SG' FROM generate_series(100, 111) id;
        INSERT INTO hard_assets (id, name, lat, lng, address, country, is_hidden, is_deleted) VALUES
            (200, 'Havelock hidden place', 1.29, 103.82, 'Private fixture address', 'SG', true, false),
            (201, 'Havelock deleted place', 1.29, 103.82, 'Deleted fixture address', 'SG', false, true),
            (202, 'Unrelated place', 1.29, 103.82, '2 Fixture Road', 'SG', false, false);
        INSERT INTO soft_assets (id, name, bucket, audience_mode, asset_mode, is_hidden, is_deleted) VALUES
            (300, 'Havelock public activity', 'programmes', 'public', 'standalone', false, false),
            (301, 'Havelock hidden activity', 'programmes', 'public', 'standalone', true, false),
            (302, 'Havelock deleted activity', 'programmes', 'public', 'standalone', false, true),
            (303, 'Havelock private audience', 'services', 'partner_boundary', 'standalone', false, false),
            (304, 'Havelock private zone', 'services', 'audience_zones', 'standalone', false, false),
            (305, 'Havelock private region', 'services', 'target_regions', 'standalone', false, false),
            (306, 'Havelock group', 'programmes', 'public', 'group', false, false),
            (307, 'Havelock hidden host activity', 'programmes', 'public', 'standalone', false, false);
        INSERT INTO soft_asset_locations (soft_asset_id, hard_asset_id)
            SELECT id, 100 FROM soft_assets WHERE id <> 307;
        INSERT INTO soft_asset_locations (soft_asset_id, hard_asset_id) VALUES (307, 200);
    `);
    const search = createGuideResourceLoader();
    const directory = new Hono();
    directory.use('*', async (c, next) => { c.set('user', { role: 'guest' }); await next(); });
    directory.get('/hard-assets', getHardAssets);
    directory.get('/soft-assets', getSoftAssets);
    directory.get('/hard-assets/:id', getHardAssetById);
    directory.get('/soft-assets/:id', getSoftAssetById);

    await t.test('search returns current database rows, correctly paginated, without private results', async () => {
        const first = await search({ query: 'Havelock', type: 'all', page: 1 }, env);
        const second = await search({ query: 'Havelock', type: 'all', page: 2 }, env);
        assert.equal(first.hasMore, true);
        assert.equal(second.hasMore, false);
        const all = [...first.results, ...second.results];
        assert.equal(all.filter((r) => r.type === 'hard').length, 12);
        assert.deepEqual(all.filter((r) => r.type === 'soft').map((r) => r.id), [300]);
        assert.equal(new Set(all.map((r) => `${r.type}:${r.id}`)).size, 13);
        assert.doesNotMatch(JSON.stringify(all), /private|hidden|deleted|password_hash|partnerId|permissions|eligibilityRules/i);
        assert.equal(first.discoverRoute, '/discover?q=Havelock');
        const empty = await search({ query: 'no such fixture', type: 'all', page: 1 }, env);
        assert.deepEqual(empty.results, []);
        assert.equal(empty.hasMore, false);
    });

    await t.test('Guide matches existing public directory filtering and its detail links resolve', async () => {
        const results = await search({ query: 'Havelock', type: 'all', page: 1 }, env);
        for (const type of ['hard', 'soft']) {
            const response = await directory.request(`/${type}-assets?q=Havelock&scope=visible&page=1&pageSize=10&${type === 'hard' ? 'summary=true' : 'assetMode=offerings'}`, {}, env);
            assert.equal(response.status, 200);
            assert.deepEqual(results.results.filter((r) => r.type === type).map((r) => r.id), (await response.json()).data.map((r) => r.id));
        }
        for (const item of results.results) {
            assert.equal(item.route, `/resource/${item.type}/${item.id}`);
            const detail = await directory.request(`/${item.type}-assets/${item.id}`, {}, env);
            assert.equal(detail.status, 200);
            assert.equal((await detail.json()).name, item.name);
        }
    });

    await t.test('signed-in staff Guide never inherits privileged catalog visibility', async () => {
        const router = createGuideRoutes({ authenticate: async (c, next) => {
            c.set('user', { id: 2, role: 'super_admin', subregionIds: [1] }); await next();
        } });
        const post = (body) => router.request('/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, env);
        const response = await post({ query: 'Havelock' });
        assert.equal(response.status, 200);
        assert.doesNotMatch(JSON.stringify((await response.json()).results), /private|hidden|deleted/i);
        assert.equal((await post({ query: 'Havelock', scope: 'managed' })).status, 400);
    });

    await t.test('withdrawn visibility is rechecked by search and detail without stale result reuse', async () => {
        await pg.exec('UPDATE hard_assets SET is_hidden = true WHERE id = 111; UPDATE soft_assets SET is_hidden = true WHERE id = 300;');
        const current = await search({ query: 'Havelock', type: 'all', page: 1 }, env);
        assert.ok(current.results.every((r) => !(r.type === 'hard' && r.id === 111) && !(r.type === 'soft' && r.id === 300)));
        assert.equal((await directory.request('/hard-assets/111', {}, env)).status, 404);
        assert.equal((await directory.request('/soft-assets/300', {}, env)).status, 404);
    });
    assert.ok(statements.length > 0);
    assert.ok(statements.every((sql) => /^\s*select\b/i.test(sql)), 'Guide search/detail must not mutate data or bootstrap schema');
});
