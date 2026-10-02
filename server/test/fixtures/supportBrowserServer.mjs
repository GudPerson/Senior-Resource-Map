// Disposable browser-UAT harness. Not imported by application code or deployed.
// All identities/resources are synthetic; database transport is local-only.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import { serve } from '@hono/node-server';
import { createSupportRoutes } from '../../src/routes/support.js';
import { createGuideRoutes } from '../../src/routes/guide.js';
import { createHelpArticleRoutes } from '../../src/routes/helpArticles.js';
import { GUIDE_ORACLE_FACTS } from '../../src/utils/guideOracleKnowledge.js';
import { createGuideLiveAiClient, GUIDE_PILOT_GATEWAY_ID } from './guideLiveAiClient.js';
import { createNotificationRoutes } from '../../src/routes/notifications.js';
import { runResourceNotificationBatch } from '../../src/utils/notificationProcessor.js';
import { createSavedSearchRoutes } from '../../src/routes/savedSearches.js';
import { runSavedSearchBatch } from '../../src/utils/savedSearchProcessor.js';
import { createSupportRepository } from '../../src/utils/supportRepository.js';
import { createGuideHistoryRepository } from '../../src/utils/guideHistory.js';
import { getHardAssets, getHardAssetById } from '../../src/controllers/hardAssetsController.js';
import { getSoftAssets, getSoftAssetById, createSoftAsset, updateSoftAsset } from '../../src/controllers/softAssetsController.js';
import { getFavorites, getFavoriteMapUsage, toggleFavorite, bulkRemoveUnusedFavorites } from '../../src/controllers/favoritesController.js';
import { getMyMemberships } from '../../src/controllers/membershipsController.js';
import { getCalendar, createCalendarItem, updateCalendarItem, deleteCalendarItem, getCalendarMapNote,
    acknowledgeCalendarSchedule } from '../../src/controllers/calendarController.js';
import { authorizeResourceOperator } from '../../src/middleware/auth.js';
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
const fixturePort = process.env.CAREAROUND_SUPPORT_FIXTURE_PORT === '8793' ? 8793
    : process.env.CAREAROUND_SUPPORT_FIXTURE_PORT === '8792' ? 8792 : 8791;
const clientPort = fixturePort === 8793 ? 5181 : fixturePort === 8792 ? 5180 : 5179;
const fixtureHost = `127.0.0.1:${fixturePort}`;
const clientOrigin = `http://127.0.0.1:${clientPort}`;
const cleanup = [];
const { pg, env } = await createNeonPostgresFixture({ after: (callback) => cleanup.push(callback) });
// Process-local action signing; never reads an application credential.
env.GUIDE_ACTIONS_ENABLED = 'true';
env.GUIDE_CHAT_ENABLED = 'true';
const liveGuideAi = process.env.CAREAROUND_SUPPORT_FIXTURE_LIVE_AI === 'true';
// Optional HC-09 workflow replay. No live geocoding: the browser and this
// process use the same fictional response; all other server fetches are denied.
const personalLocationReplay = process.env.CAREAROUND_SUPPORT_FIXTURE_PERSONAL_LOCATION === 'true';
if (personalLocationReplay) {
    if (liveGuideAi) throw new Error('Personal location replay cannot use live AI.');
    globalThis.fetch = async (input) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        if (url.origin !== 'https://www.onemap.gov.sg' || url.pathname !== '/api/common/elastic/search')
            throw new Error('External network is disabled in the personal-location replay.');
        const results = url.searchParams.get('searchVal') === '123456'
            ? [{ POSTAL: '123456', ADDRESS: 'FICTIONAL DEMONSTRATION ADDRESS', BUILDING: 'FICTIONAL DEMONSTRATION POINT', LATITUDE: '1.294', LONGITUDE: '103.821' }] : [];
        return Response.json({ found: results.length, totalNumPages: 1, pageNum: 1, results });
    };
}

// Live transport preserves the named Gateway; simulated mode remains local-only.
env.GUIDE_AI_GATEWAY_ID = liveGuideAi ? GUIDE_PILOT_GATEWAY_ID : 'guide-oracle-fixture';
env.GUIDE_CHAT_SIMULATED = liveGuideAi ? 'false' : 'true';
// Opt-in startup only; injected-ID controls below still refuse live mode.
env.GUIDE_SEMANTIC_RETRIEVAL_ENABLED = liveGuideAi
    && process.env.CAREAROUND_SUPPORT_FIXTURE_SEMANTIC_AI === 'true' ? 'true' : 'false';
let semanticFixtureSelection = [];
let semanticFixtureCalls = 0;
env.AI = liveGuideAi ? createGuideLiveAiClient() : { run: async (_model, params) => {
    if (env.GUIDE_SEMANTIC_RETRIEVAL_ENABLED === 'true') {
        semanticFixtureCalls++;
        return { response: JSON.stringify({ factIds: semanticFixtureSelection }) };
    }
    const listed = params?.messages?.[0]?.content?.split('Reviewed CareAround facts ')[1]?.match(/\n([a-z][a-z0-9-]+) — /)?.[1];
    return { response: JSON.stringify({ factIds: listed ? [listed] : [] }) };
} };
env.JWT_SECRET = crypto.randomUUID() + crypto.randomUUID();
let guideFixtureModelAvailable = true;
const fixtureCache = new Map();
env.MAP_CACHE = { put: async (key, value) => fixtureCache.set(key, value), get: async (key, type) => {
    const value = fixtureCache.get(key) ?? null;
    return type === 'json' && value ? JSON.parse(value) : value;
} };
await pg.exec(`INSERT INTO users (id, username, email, password_hash, name, role) VALUES
    (1, 'fixture-user', 'one@example.test', 'fixture-only', 'Demo User', 'standard'),
    (2, 'fixture-other', 'two@example.test', 'fixture-only', 'Other User', 'standard'),
    (3, 'fixture-admin', 'admin@example.test', 'fixture-only', 'Support Reviewer', 'super_admin'),
    (4, 'fixture-place-staff', 'staff@example.test', 'fixture-only', 'Assigned Place Staff', 'standard'),
    (5, 'fixture-other-place-staff', 'otherstaff@example.test', 'fixture-only', 'Other Place Staff', 'standard'),
    (6, 'fixture-region-admin', 'regionadmin@example.test', 'fixture-only', 'Scoped Admin', 'regional_admin'),
    (7, 'fixture-other-region-admin', 'otherregionadmin@example.test', 'fixture-only', 'Other Scoped Admin', 'regional_admin'),
    (8, 'fixture-org-admin', 'orgadmin@example.test', 'fixture-only', 'Fictional Organisation Admin', 'standard'),
    (9, 'fixture-other-org-admin', 'otherorgadmin@example.test', 'fixture-only', 'Other Fictional Organisation Admin', 'standard');
    INSERT INTO partner_organizations (id, name) VALUES (50, 'Fictional Organisation A'), (51, 'Fictional Organisation B');
    INSERT INTO organization_access_memberships (organization_id, user_id, access_role) VALUES (50, 8, 'admin'), (51, 9, 'admin');
    INSERT INTO hard_assets (id, name, lat, lng, address, country, is_hidden) VALUES
        (100, 'Havelock Demo Centre', 1.29, 103.82, '1 Synthetic Fixture Road', 'SG', false),
        (101, 'Havelock Hidden Centre', 1.29, 103.82, 'Hidden fixture address', 'SG', true),
        (103, 'Havelock Unused Centre', 1.291, 103.821, '3 Synthetic Fixture Road', 'SG', false),
        (104, 'Out-of-scope Demo Centre', 1.292, 103.822, '4 Synthetic Fixture Road', 'SG', false);
    INSERT INTO soft_assets (id, name, bucket, description, audience_mode) VALUES
        (200, 'Havelock Demo Activity', 'programmes', 'Synthetic activity for browser testing.', 'public'),
        (201, 'Havelock Restricted Activity', 'programmes', 'Not public.', 'partner_boundary'),
        (202, 'Havelock List-only Service', 'services', 'Synthetic service without a mapped location.', 'public');
    INSERT INTO soft_assets (id, name, bucket, description, audience_mode, asset_mode) VALUES
        (203, 'Havelock Staff Group', 'groups', 'Synthetic assigned group.', 'public', 'group'),
        (204, 'Other Staff Group', 'groups', 'Synthetic group for a different account.', 'public', 'group');
    INSERT INTO soft_asset_locations (soft_asset_id, hard_asset_id) VALUES (200, 100), (201, 100);
    INSERT INTO subregions (id, name) VALUES (10, 'Synthetic region'), (20, 'Other synthetic region');
    INSERT INTO user_subregions (user_id, subregion_id) VALUES (6, 10), (7, 20);
    UPDATE hard_assets SET subregion_id = 10 WHERE id IN (100, 101, 103);
    UPDATE soft_assets SET subregion_id = 10 WHERE id IN (200, 201, 202, 203);
    UPDATE soft_assets SET subregion_id = 20 WHERE id = 204;
    UPDATE hard_assets SET subregion_id = 20 WHERE id = 104;
    INSERT INTO hard_asset_staff_memberships (id, hard_asset_id, user_id, staff_role, created_by_user_id) VALUES
        (1, 100, 4, 'staff', 3), (2, 104, 5, 'staff', 3);
    INSERT INTO soft_asset_staff_memberships (id, soft_asset_id, user_id, staff_role, created_by_user_id) VALUES
        (1, 203, 4, 'staff', 3), (2, 203, 3, 'owner', 3), (3, 204, 5, 'owner', 3);
    SELECT setval(pg_get_serial_sequence('soft_assets', 'id'), (SELECT MAX(id) FROM soft_assets));
    INSERT INTO user_favorites (user_id, resource_type, resource_id) VALUES
        (1, 'hard', 100), (1, 'soft', 202), (1, 'hard', 103), (1, 'soft', 200), (2, 'hard', 103);
    INSERT INTO user_personal_places (user_id, name, lat, lng, address, note) VALUES
        (4, 'Staff Planning Pin', 1.294, 103.821, 'Private fixture staff address', 'Private fixture staff note'),
        (5, 'Other Private Pin', 1.292, 103.824, 'Private fixture other address', 'Private fixture other note');
    INSERT INTO user_calendar_items (user_id, item_type, soft_asset_id, title, starts_at, source_starts_at, status) VALUES
        (4, 'planned_session', 200, 'Staff Future Session', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days', 'planned'),
        (5, 'planned_session', 200, 'Other Private Session', NOW() + INTERVAL '9 days', NOW() + INTERVAL '9 days', 'planned');`);
// Seed the UTC timestamp convention explicitly; the disposable PostgreSQL
// runtime can inherit the host's Singapore session timezone.
await pg.query(`INSERT INTO sensitive_audit_logs (actor_user_id, target_user_id, action_type, resource_type, resource_id, organization_id, metadata, created_at) VALUES
    (4, 1, 'resource_updated', 'soft', 200, 50, '{"privateValue":"fixture-audit-secret"}', $1),
    (5, 2, 'resource_updated', 'soft', 202, 51, '{"privateValue":"fixture-other-audit-secret"}', $1);`,
    [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]);
const identities = { member: { id: 1, role: 'standard', name: 'Demo User' }, other: { id: 2, role: 'standard', name: 'Other User' },
    admin: { id: 3, role: 'super_admin', name: 'Support Reviewer' },
    orgadmin: { id: 8, role: 'standard', name: 'Fictional Organisation Admin' },
    otherorgadmin: { id: 9, role: 'standard', name: 'Other Fictional Organisation Admin' },
    regionadmin: { id: 6, role: 'regional_admin', name: 'Scoped Admin', subregionIds: [10] },
    otherregionadmin: { id: 7, role: 'regional_admin', name: 'Other Scoped Admin', subregionIds: [20] },
    staff: { id: 4, role: 'standard', name: 'Assigned Place Staff', softAssetStaffAccess: [
        { softAssetMembershipId: 1, softAssetId: 203, softAssetName: 'Havelock Staff Group', staffRole: 'staff', subregionId: 10 },
    ], hardAssetStaffAccess: [
        { hardAssetMembershipId: 1, hardAssetId: 100, hardAssetName: 'Havelock Demo Centre', staffRole: 'staff', subregionId: 10 },
    ] },
    otherstaff: { id: 5, role: 'standard', name: 'Other Place Staff', softAssetStaffAccess: [
        { softAssetMembershipId: 3, softAssetId: 204, softAssetName: 'Other Staff Group', staffRole: 'owner', subregionId: 20 },
    ], hardAssetStaffAccess: [
        { hardAssetMembershipId: 2, hardAssetId: 104, hardAssetName: 'Out-of-scope Demo Centre', staffRole: 'staff', subregionId: 20 },
    ] },
    impersonating: { id: 1, role: 'standard', name: 'Demo User', isImpersonating: true } };
const userFor = (c) => identities[getCookie(c, 'carearound_support_fixture')] || null;
const authenticate = async (c, next) => { c.set('user', userFor(c)); await next(); };
const repository = createSupportRepository(async (sql, params) => (await pg.query(sql, params)).rows);
const guideHistory = createGuideHistoryRepository(async (sql, params) => (await pg.query(sql, params)).rows);
let matchingRelease = false;
const sourceRevision = 'a'.repeat(40);
const api = new Hono();
api.use('*', cors({ origin: clientOrigin, credentials: true, allowHeaders: ['Content-Type', 'X-CareAround-Support-Key', 'X-Session-Token'] }));
api.use('*', async (c, next) => {
    if (c.req.header('host') !== fixtureHost) return c.json({ error: 'Local fixture only' }, 403);
    c.header('Cache-Control', 'no-store');
    await next();
});
api.get('/__fixture/session/:role', (c) => {
    setCookie(c, 'carearound_support_fixture', c.req.param('role'), { httpOnly: true, sameSite: 'Lax', path: '/' });
    return c.redirect(`${clientOrigin}/help`);
});
// Inspect only synthetic rows created during the local Guide browser journey.
api.get('/__fixture/guide/state', async (c) => c.json({
    resources: (await pg.query(`SELECT id, name, description, is_hidden, audience_mode, created_by_user_id,
        calendar_enabled, calendar_entries, calendar_revision, schedule FROM soft_assets WHERE created_by_user_id IN (3, 4, 5) ORDER BY id`)).rows,
    links: (await pg.query(`SELECT soft_asset_id, hard_asset_id FROM soft_asset_locations
        WHERE soft_asset_id IN (SELECT id FROM soft_assets WHERE created_by_user_id IN (3, 4, 5)) ORDER BY soft_asset_id, hard_asset_id`)).rows,
    scheduleVersions: (await pg.query(`SELECT soft_asset_id, revision, public_summary, source FROM offering_schedule_versions
        WHERE soft_asset_id IN (SELECT id FROM soft_assets WHERE created_by_user_id IN (3, 4, 5)) ORDER BY soft_asset_id, revision`)).rows,
    favorites: (await pg.query(`SELECT user_id, resource_type, resource_id FROM user_favorites
        WHERE user_id IN (4, 5) ORDER BY user_id, resource_type, resource_id`)).rows,
}));
api.post('/__fixture/guide/model/:mode', (c) => {
    const mode = c.req.param('mode');
    if (!['available', 'unavailable'].includes(mode)) return c.json({ error: 'Unknown fixture model mode' }, 400);
    guideFixtureModelAvailable = mode === 'available';
    return c.json({ fixture: true, mode });
});
// Explicit injected IDs exercise the two-stage pipeline, not model relevance.
// This control cannot enable the paid-model bridge and is never deployed.
api.get('/__fixture/guide/semantic', (c) => c.json({ fixture: true,
    enabled: env.GUIDE_SEMANTIC_RETRIEVAL_ENABLED === 'true', liveAi: liveGuideAi,
    modelCalls: liveGuideAi ? null : semanticFixtureCalls,
    counterSource: liveGuideAi ? 'loopback-bridge-status' : 'simulation' }));
api.post('/__fixture/guide/semantic', async (c) => {
    if (liveGuideAi) return c.json({ error: 'Semantic fixture control requires simulated AI' }, 409);
    const body = await c.req.json();
    const ids = body.factIds || [];
    if (typeof body.enabled !== 'boolean' || !Array.isArray(ids) || ids.length > 3
        || new Set(ids).size !== ids.length || ids.some((id) => !GUIDE_ORACLE_FACTS.some((fact) => fact.id === id)))
        return c.json({ error: 'Invalid injected fact selection' }, 400);
    semanticFixtureSelection = ids;
    semanticFixtureCalls = 0;
    env.GUIDE_SEMANTIC_RETRIEVAL_ENABLED = body.enabled ? 'true' : 'false';
    return c.json({ fixture: true, enabled: body.enabled, modelCalls: 0 });
});
api.post('/__fixture/guide/access/:mode', async (c) => {
    const mode = c.req.param('mode');
    if (!['revoke', 'restore'].includes(mode)) return c.json({ error: 'Unknown fixture access mode' }, 400);
    await pg.query('UPDATE hard_asset_staff_memberships SET revoked_at = $1 WHERE id = 1', [mode === 'revoke' ? new Date() : null]);
    await pg.query('UPDATE soft_asset_staff_memberships SET revoked_at = $1 WHERE id = 1', [mode === 'revoke' ? new Date() : null]);
    identities.staff.hardAssetStaffAccess = mode === 'revoke' ? [] : [
        { hardAssetMembershipId: 1, hardAssetId: 100, hardAssetName: 'Havelock Demo Centre', staffRole: 'staff', subregionId: 10 },
    ];
    identities.staff.softAssetStaffAccess = mode === 'revoke' ? [] : [
        { softAssetMembershipId: 1, softAssetId: 203, softAssetName: 'Havelock Staff Group', staffRole: 'staff', subregionId: 10 },
    ];
    return c.json({ fixture: true, mode });
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
privateResources.get('/memberships/me', authenticate, requireFixtureUser, getMyMemberships);
privateResources.post('/soft-assets', authenticate, requireFixtureUser, authorizeResourceOperator(), createSoftAsset);
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
api.route('/api/help/articles', createHelpArticleRoutes({ authenticate }));
const publicResources = new Hono();
publicResources.use('*', async (c, next) => { c.set('user', userFor(c) || { role: 'guest' }); await next(); });
publicResources.get('/hard-assets', getHardAssets);
publicResources.get('/hard-assets/:id', getHardAssetById);
publicResources.get('/soft-assets', getSoftAssets);
publicResources.get('/soft-assets/:id', getSoftAssetById);
api.route('/api/guide', createGuideRoutes({ authenticate, historyRepositoryForContext: () => guideHistory,
    templates: async (actor) => actor?.id === 3
        ? { totalCount: 1, names: ['Fixture Shared Care Template'] }
        : { totalCount: 0, names: [] },
    actionOptions: { authenticate, draftProgramme: liveGuideAi ? undefined : async ({ message, draft, useAi }) => useAi && guideFixtureModelAvailable ? {
        draft: { ...draft, name: draft.name || 'Guide Fixture Programme',
            description: draft.description || 'A fictional programme created only in the disposable local browser fixture.',
            schedule: /tuesday/i.test(message) ? 'Every Tuesday at 10am' : draft.schedule },
        aiAvailable: true,
        message: 'Fictional draft prepared. Choose your place and confirm the schedule dates before reviewing. Nothing has been created.',
    } : { draft, aiAvailable: false, message: 'Cloudflare AI is off or unavailable here. Complete the editable details below. Nothing has been created.' } },
}));
api.route('/api/notifications', createNotificationRoutes({ authenticate }));
api.route('/api/saved-searches', createSavedSearchRoutes({ authenticate }));
api.route('/api', publicResources);
api.all('*', (c) => c.json({ error: 'Not part of this disposable support fixture.' }, 404));
const background = new Set();
const execution = { waitUntil(promise) { background.add(promise); promise.finally(() => background.delete(promise)); }, passThroughOnException() {} };
const fixtureStart = new Date();
fixtureStart.setUTCDate(fixtureStart.getUTCDate() + 7);
fixtureStart.setUTCHours(1, 0, 0, 0);
const published = await api.request(`http://${fixtureHost}/api/soft-assets/200`, { method: 'PUT',
    headers: { Host: fixtureHost, 'Content-Type': 'application/json', Cookie: 'carearound_support_fixture=admin' },
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
    const created = await api.request(`http://${fixtureHost}/api/my-maps`, { method: 'POST',
        headers: { Host: fixtureHost, 'Content-Type': 'application/json', Cookie: `carearound_support_fixture=${role}` },
        body: JSON.stringify({ name, assets }),
    }, env, execution);
    if (!created.ok) throw new Error(`Synthetic map creation failed (${created.status}): ${await created.text()}`);
}
const server = serve({ hostname: '127.0.0.1', port: fixturePort, fetch: (request) => api.fetch(request, env, execution) });
console.log(`Disposable support browser fixture ready on ${fixtureHost}. No production database connected. Guide AI: ${liveGuideAi ? 'live Cloudflare via local bridge' : 'simulation'}.`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close();
    Promise.all(background).then(() => Promise.all(cleanup.map((callback) => callback()))).finally(() => process.exit(0)); });
