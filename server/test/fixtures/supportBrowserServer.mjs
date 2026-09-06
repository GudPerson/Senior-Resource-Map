// Disposable browser-UAT harness. Not imported by application code or deployed.
// All identities/resources are synthetic; database transport is local-only.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import { serve } from '@hono/node-server';
import { createSupportRoutes } from '../../src/routes/support.js';
import { createGuideRoutes } from '../../src/routes/guide.js';
import { createNotificationRoutes } from '../../src/routes/notifications.js';
import { runResourceNotificationBatch } from '../../src/utils/notificationProcessor.js';
import { createSavedSearchRoutes } from '../../src/routes/savedSearches.js';
import { runSavedSearchBatch } from '../../src/utils/savedSearchProcessor.js';
import { createSupportRepository } from '../../src/utils/supportRepository.js';
import { createGuideHistoryRepository } from '../../src/utils/guideHistory.js';
import { getHardAssets, getHardAssetById } from '../../src/controllers/hardAssetsController.js';
import { getSoftAssets, getSoftAssetById, updateSoftAsset } from '../../src/controllers/softAssetsController.js';
import { getFavorites, getFavoriteMapUsage, toggleFavorite, bulkRemoveUnusedFavorites } from '../../src/controllers/favoritesController.js';
import { getCalendar, createCalendarItem, updateCalendarItem, deleteCalendarItem, getCalendarMapNote,
    acknowledgeCalendarSchedule } from '../../src/controllers/calendarController.js';
import { createNeonPostgresFixture } from './neonPostgresFixture.mjs';
import { getMyMaps, postMyMap, getMyMap, postMyMapShare, deleteMyMapShare, patchMyMapEmbed,
    postMyMapAsset, deleteMyMapAsset, patchMyMapAssetNotes, postMyMapPersonalPlace } from '../../src/controllers/myMapsController.js';
import { getMyMapStudio, putMyMapStudio } from '../../src/controllers/mapStudioController.js';
import { getMyMapPrintAnnotations } from '../../src/controllers/printAnnotationsController.js';
import { getPersonalPlaces, getPersonalPlaceCategories } from '../../src/controllers/personalPlacesController.js';
import { getSharedMap, getEmbeddedMapConfigRoute, getEmbeddedMap, getSharedMapNoteTranslations } from '../../src/controllers/sharedMapsController.js';
import { getDiscoveryLocationIndicators } from '../../src/controllers/discoveryController.js';
import publicCacheRoutes from '../../src/routes/public.js';

if (process.env.CAREAROUND_SUPPORT_FIXTURE !== 'true') throw new Error('This disposable harness requires explicit fixture mode.');
const cleanup = [];
const { pg, env } = await createNeonPostgresFixture({ after: (callback) => cleanup.push(callback) });
const fixtureCache = new Map();
env.MAP_CACHE = { put: async (key, value) => fixtureCache.set(key, value), get: async (key, type) => {
    const value = fixtureCache.get(key) ?? null;
    return type === 'json' && value ? JSON.parse(value) : value;
} };
await pg.exec(`INSERT INTO users (id, username, email, password_hash, name, role) VALUES
    (1, 'fixture-user', 'one@example.test', 'fixture-only', 'Demo User', 'standard'),
    (2, 'fixture-other', 'two@example.test', 'fixture-only', 'Other User', 'standard'),
    (3, 'fixture-admin', 'admin@example.test', 'fixture-only', 'Support Reviewer', 'super_admin');
    INSERT INTO hard_assets (id, name, lat, lng, address, country, is_hidden) VALUES
        (100, 'Havelock Demo Centre', 1.29, 103.82, '1 Synthetic Fixture Road', 'SG', false),
        (101, 'Havelock Hidden Centre', 1.29, 103.82, 'Hidden fixture address', 'SG', true),
        (103, 'Havelock Unused Centre', 1.291, 103.821, '3 Synthetic Fixture Road', 'SG', false);
    INSERT INTO soft_assets (id, name, bucket, description, audience_mode) VALUES
        (200, 'Havelock Demo Activity', 'programmes', 'Synthetic activity for browser testing.', 'public'),
        (201, 'Havelock Restricted Activity', 'programmes', 'Not public.', 'partner_boundary'),
        (202, 'Havelock List-only Service', 'services', 'Synthetic service without a mapped location.', 'public');
    INSERT INTO soft_asset_locations (soft_asset_id, hard_asset_id) VALUES (200, 100), (201, 100);
    INSERT INTO subregions (id, name) VALUES (10, 'Synthetic region');
    UPDATE hard_assets SET subregion_id = 10 WHERE id IN (100, 101, 103);
    UPDATE soft_assets SET subregion_id = 10 WHERE id IN (200, 201, 202);
    INSERT INTO user_favorites (user_id, resource_type, resource_id) VALUES
        (1, 'hard', 100), (1, 'soft', 202), (1, 'hard', 103), (1, 'soft', 200), (2, 'hard', 103);`);
const identities = { member: { id: 1, role: 'standard', name: 'Demo User' }, other: { id: 2, role: 'standard', name: 'Other User' },
    admin: { id: 3, role: 'super_admin', name: 'Support Reviewer' },
    impersonating: { id: 1, role: 'standard', name: 'Demo User', isImpersonating: true } };
const userFor = (c) => identities[getCookie(c, 'carearound_support_fixture')] || null;
const authenticate = async (c, next) => { c.set('user', userFor(c)); await next(); };
const repository = createSupportRepository(async (sql, params) => (await pg.query(sql, params)).rows);
const guideHistory = createGuideHistoryRepository(async (sql, params) => (await pg.query(sql, params)).rows);
let matchingRelease = false;
const sourceRevision = 'a'.repeat(40);
const api = new Hono();
api.use('*', cors({ origin: 'http://127.0.0.1:5179', credentials: true, allowHeaders: ['Content-Type', 'X-CareAround-Support-Key', 'X-Session-Token'] }));
api.use('*', async (c, next) => {
    if (!['127.0.0.1:8791'].includes(c.req.header('host'))) return c.json({ error: 'Local fixture only' }, 403);
    c.header('Cache-Control', 'no-store');
    await next();
});
api.get('/__fixture/session/:role', (c) => {
    setCookie(c, 'carearound_support_fixture', c.req.param('role'), { httpOnly: true, sameSite: 'Lax', path: '/' });
    return c.redirect('http://127.0.0.1:5179/help');
});
api.post('/__fixture/release/:mode', (c) => { matchingRelease = c.req.param('mode') === 'match'; return c.json({ fixture: true, matchingRelease }); });
api.post('/__fixture/notifications/:action', async (c) => {
    const action = c.req.param('action');
    if (!['tick', 'change', 'hide', 'restore'].includes(action)) return c.json({ error: 'Unknown fixture action' }, 400);
    if (action === 'change') await pg.exec(`UPDATE hard_assets SET hours = 'Fixture changed hours' WHERE id = 100;
        UPDATE soft_assets SET calendar_revision = calendar_revision + 1, calendar_status = 'cancelled' WHERE id = 200;`);
    if (action === 'hide') await pg.exec('UPDATE soft_assets SET is_hidden = true WHERE id = 200;');
    if (action === 'restore') await pg.exec('UPDATE soft_assets SET is_hidden = false WHERE id = 200;');
    await pg.exec('UPDATE notification_resource_jobs SET next_scan_at = NOW();');
    return c.json({ fixture: true, result: await runResourceNotificationBatch(env) });
});
api.get('/api/auth/me', (c) => c.json({ user: userFor(c) }));
api.post('/__fixture/searches/:action', async (c) => {
    const action = c.req.param('action');
    if (!['tick', 'new', 'second', 'empty', 'restore'].includes(action)) return c.json({ error: 'Unknown fixture action' }, 400);
    if (action === 'new' || action === 'second') {
        const id = action === 'new' ? 500 : 501;
        await pg.query(`INSERT INTO hard_assets (id, name, lat, lng, address, country)
            VALUES ($1, $2, 1.29, 103.82, '2 Synthetic Fixture Road', 'SG') ON CONFLICT DO NOTHING`, [id, `Havelock New Fixture Centre ${id}`]);
    }
    if (action === 'empty' || action === 'restore') {
        await pg.query('UPDATE hard_assets SET is_hidden = $1 WHERE id IN (100, 500, 501)', [action === 'empty']);
        await pg.query('UPDATE soft_assets SET is_hidden = $1 WHERE id = 200', [action === 'empty']);
    }
    await pg.exec('UPDATE saved_searches SET next_scan_at = NOW()');
    return c.json({ fixture: true, result: await runSavedSearchBatch(env) });
});
const privateResources = new Hono();
const requireFixtureUser = async (c, next) => {
    if (!c.get('user')?.id) return c.json({ error: 'Please sign in.' }, 401);
    await next();
};
privateResources.get('/favorites', authenticate, requireFixtureUser, getFavorites);
privateResources.get('/favorites/map-usage', authenticate, requireFixtureUser, getFavoriteMapUsage);
privateResources.post('/favorites/toggle', authenticate, requireFixtureUser, toggleFavorite);
privateResources.post('/favorites/bulk-remove-unused', authenticate, requireFixtureUser, bulkRemoveUnusedFavorites);
privateResources.get('/calendar', authenticate, requireFixtureUser, getCalendar);
privateResources.get('/calendar/map-notes/:noteId', authenticate, requireFixtureUser, getCalendarMapNote);
privateResources.post('/calendar/items', authenticate, requireFixtureUser, createCalendarItem);
privateResources.patch('/calendar/items/:itemId', authenticate, requireFixtureUser, updateCalendarItem);
privateResources.delete('/calendar/items/:itemId', authenticate, requireFixtureUser, deleteCalendarItem);
privateResources.post('/calendar/schedule-states/acknowledge', authenticate, requireFixtureUser, acknowledgeCalendarSchedule);
privateResources.get('/personal-places', authenticate, requireFixtureUser, getPersonalPlaces);
privateResources.get('/personal-places/categories', authenticate, requireFixtureUser, getPersonalPlaceCategories);
privateResources.put('/soft-assets/:id', authenticate, requireFixtureUser, updateSoftAsset);
privateResources.get('/my-maps', authenticate, requireFixtureUser, getMyMaps);
privateResources.post('/my-maps', authenticate, requireFixtureUser, postMyMap);
privateResources.get('/my-maps/:id', authenticate, requireFixtureUser, getMyMap);
privateResources.get('/my-maps/:id/studio', authenticate, requireFixtureUser, getMyMapStudio);
privateResources.put('/my-maps/:id/studio', authenticate, requireFixtureUser, putMyMapStudio);
privateResources.get('/my-maps/:id/print-annotations', authenticate, requireFixtureUser, getMyMapPrintAnnotations);
privateResources.post('/my-maps/:id/share', authenticate, requireFixtureUser, postMyMapShare);
privateResources.delete('/my-maps/:id/share', authenticate, requireFixtureUser, deleteMyMapShare);
privateResources.patch('/my-maps/:id/embed', authenticate, requireFixtureUser, patchMyMapEmbed);
privateResources.post('/my-maps/:id/assets', authenticate, requireFixtureUser, postMyMapAsset);
privateResources.delete('/my-maps/:id/assets/:resourceType/:resourceId', authenticate, requireFixtureUser, deleteMyMapAsset);
privateResources.patch('/my-maps/:id/assets/:resourceType/:resourceId/notes', authenticate, requireFixtureUser, patchMyMapAssetNotes);
privateResources.post('/my-maps/:id/personal-places', authenticate, requireFixtureUser, postMyMapPersonalPlace);
api.route('/api', privateResources);
api.post('/api/discovery/location-indicators', authenticate, getDiscoveryLocationIndicators);
api.route('/api/public', publicCacheRoutes);
api.get('/api/shared-maps/:token/embed-config', getEmbeddedMapConfigRoute);
api.get('/api/shared-maps/:token/embed', getEmbeddedMap);
api.get('/api/shared-maps/:token/note-translations', authenticate, getSharedMapNoteTranslations);
api.get('/api/shared-maps/:token', authenticate, getSharedMap);
api.get('/api/subregions', async (c) => c.json((await pg.query('SELECT id, name FROM subregions')).rows));
// Non-mutating picker data for the normal Offering editor. These fixture-only
// empty collections are not proof of membership, template or audience-zone UAT.
api.get('/api/sub-categories', (c) => c.json([{ id: 1, name: 'Programmes', type: 'soft' },
    { id: 2, name: 'Active Ageing Centres', type: 'hard' }]));
api.get('/api/tags', (c) => c.json([]));
api.get('/api/users', (c) => c.json([]));
api.get('/api/soft-asset-parents', (c) => c.json([]));
api.get('/api/audience-zones', (c) => c.json([]));
api.route('/api/support', createSupportRoutes({ authenticate, repositoryForContext: () => repository,
    verifyProduction: async (target) => Object.fromEntries((target === 'both' ? ['client', 'server'] : [target])
        .map((item) => [item, { sourceRevision: matchingRelease ? sourceRevision : 'b'.repeat(40), healthy: true, checkedAt: new Date().toISOString() }])) }));
const publicResources = new Hono();
publicResources.use('*', async (c, next) => { c.set('user', userFor(c) || { role: 'guest' }); await next(); });
publicResources.get('/hard-assets', getHardAssets);
publicResources.get('/hard-assets/:id', getHardAssetById);
publicResources.get('/soft-assets', getSoftAssets);
publicResources.get('/soft-assets/:id', getSoftAssetById);
api.route('/api/guide', createGuideRoutes({ authenticate, historyRepositoryForContext: () => guideHistory }));
api.route('/api/notifications', createNotificationRoutes({ authenticate }));
api.route('/api/saved-searches', createSavedSearchRoutes({ authenticate }));
api.route('/api', publicResources);
api.all('*', (c) => c.json({ error: 'Not part of this disposable support fixture.' }, 404));
const background = new Set();
const execution = { waitUntil(promise) { background.add(promise); promise.finally(() => background.delete(promise)); }, passThroughOnException() {} };
const fixtureStart = new Date();
fixtureStart.setUTCDate(fixtureStart.getUTCDate() + 7);
fixtureStart.setUTCHours(1, 0, 0, 0);
const published = await api.request('http://127.0.0.1:8791/api/soft-assets/200', { method: 'PUT',
    headers: { Host: '127.0.0.1:8791', 'Content-Type': 'application/json', Cookie: 'carearound_support_fixture=admin' },
    body: JSON.stringify({ expectedScheduleRevision: 0, schedulePlanAction: 'publish', schedulePlan: {
        enabled: true, entries: [{ key: 'fixture-session', type: 'once', startsAt: fixtureStart.toISOString(),
            endsAt: new Date(fixtureStart.getTime() + 3600000).toISOString(), timezone: 'Asia/Singapore', status: 'active' }],
    } }),
}, env, execution);
if (!published.ok) throw new Error(`Synthetic schedule publication failed (${published.status}): ${await published.text()}`);
await Promise.all(background);
// Exercise the actual map creation/ownership path; no canned map directory.
for (const [role, name, assets] of [
    ['member', 'Synthetic care map', [{ resourceType: 'hard', resourceId: 100 }, { resourceType: 'soft', resourceId: 202 }]],
    ['other', 'Other account private map', [{ resourceType: 'hard', resourceId: 103 }]],
]) {
    const created = await api.request('http://127.0.0.1:8791/api/my-maps', { method: 'POST',
        headers: { Host: '127.0.0.1:8791', 'Content-Type': 'application/json', Cookie: `carearound_support_fixture=${role}` },
        body: JSON.stringify({ name, assets }),
    }, env, execution);
    if (!created.ok) throw new Error(`Synthetic map creation failed (${created.status}): ${await created.text()}`);
}
const server = serve({ hostname: '127.0.0.1', port: 8791, fetch: (request) => api.fetch(request, env, execution) });
console.log('Disposable support browser fixture ready on 127.0.0.1:8791. No production database connected.');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close();
    Promise.all(background).then(() => Promise.all(cleanup.map((callback) => callback()))).finally(() => process.exit(0)); });
