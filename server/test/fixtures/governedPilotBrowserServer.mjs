// Optional loopback-only browser server, explicitly launched for a rehearsal.
// Serves the compiled client and full application against fictional PostgreSQL.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createGovernedPilotFixture } from './governedPilotFixture.mjs';
import { buildEmbeddedMapResponse } from '../../../client/functions/embed/governed-maps/[token].js';

if (process.env.CAREAROUND_PILOT_FIXTURE !== 'true') throw new Error('Explicit fictional fixture mode is required.');
const cleanup = [];
const f = await createGovernedPilotFixture({ after: (callback) => cleanup.push(callback) });
const limitedRelease = process.env.CAREAROUND_PILOT_RELEASE_DISABLED === 'true';
const releaseStage = limitedRelease ? 'off' : (process.env.CAREAROUND_PILOT_RELEASE_STAGE || 'lifecycle');
const browserTargets = {
    off: { port: 5185, directory: 'limited-dist' },
    onboarding: { port: 5186, directory: 'onboarding-dist' },
    claims: { port: 5187, directory: 'claims-dist' },
    maps: { port: 5188, directory: 'maps-dist' },
    lifecycle: { port: 5183, directory: 'dist' },
};
const target = browserTargets[releaseStage];
if (!target) throw new Error('Browser fixture supports only off, onboarding, claims, maps, or lifecycle release stages.');
const { port } = target;
const dist = fileURLToPath(new URL(`../../../output/playwright/governed-pilot-rehearsal/${target.directory}/`, import.meta.url));
const mime = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
async function asset(url) {
    const requested = path.resolve(dist, '.' + new URL(url).pathname);
    if (!requested.startsWith(dist)) return new Response('Unavailable', { status: 404 });
    try { return new Response(await readFile(requested), { headers: { 'content-type': mime[path.extname(requested)] || 'application/octet-stream', 'cache-control': 'no-store' } }); }
    catch { return new Response(await readFile(path.join(dist, 'index.html')), { headers: { 'content-type': 'text/html', 'cache-control': 'no-store' } }); }
}
const a = f.partners[0];
const claimResourceId = (await f.pg.query(`INSERT INTO hard_assets (
    name, sub_category, lat, lng, address, postal_code, country, description,
    website, logo_url, banner_url, verification_status
) VALUES (
    'Fictional Unclaimed Community Hub', 'Community Centres', 1.3811, 103.7511,
    '18 Fictional Claim Avenue', '680018', 'SG', 'Demonstration description awaiting owner approval.',
    'https://pilot-a.example/community-hub', 'https://pilot-a.example/community-hub-logo.png',
    'https://pilot-a.example/community-hub-banner.png', 'unverified'
) RETURNING id`)).rows[0].id;
let map = (await f.request('/governed-maps', { method: 'POST', cookie: a.cookie, expected: 201,
    body: { regionGroupId: f.groupId, name: 'Fictional browser pilot map' } })).data.map;
for (const p of f.partners) map = (await f.request(`/governed-maps/${map.id}/resources`, { method: 'POST', cookie: a.cookie, expected: 201,
    body: { resourceType: 'hard', resourceId: p.resourceId } })).data.map;
map = (await f.request(`/governed-maps/${map.id}/publish`, { method: 'POST', cookie: a.cookie,
    body: { allowedOrigins: ['https://partner.fixture.example'] } })).data.map;
f.env.GOVERNED_PILOT_RELEASE_STAGE = releaseStage;
f.env.ALLOWED_ORIGINS = `http://localhost:${port}`;

const server = serve({ hostname: '127.0.0.1', port, fetch: async request => {
    const url = new URL(request.url);
    if (![ `localhost:${port}`, `127.0.0.1:${port}` ].includes(url.host)) return new Response('Local fixture only', { status: 403 });
    if (url.pathname.startsWith('/api/')) return f.app.fetch(request, f.env, f.execution);
    if (url.pathname === '/__fixture/info') return Response.json({
        mapId: map.id,
        token: map.publication.shareToken,
        claimResourceId,
        partnerAdminEmail: a.email,
    });
    if (url.pathname.startsWith('/embed/governed-maps/')) return buildEmbeddedMapResponse({
        request, params: { token: url.pathname.split('/').at(-1) },
        env: { CAREAROUND_EMBED_API_BASE_URL: `http://localhost:${port}/api`, ASSETS: { fetch: asset } },
    }, (input, init) => f.app.request(input, init, f.env, f.execution));
    return asset(request.url);
} });
console.log(`Fictional pilot browser rehearsal ready at http://localhost:${port}. No production database.`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
    server.close();
    await Promise.allSettled(cleanup.map(callback => callback()));
    process.exit(0);
});
