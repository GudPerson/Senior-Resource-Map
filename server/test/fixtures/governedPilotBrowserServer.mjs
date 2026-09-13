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
const port = limitedRelease ? 5185 : 5183;
const dist = fileURLToPath(new URL(`../../../output/playwright/governed-pilot-rehearsal/${limitedRelease ? 'limited-dist' : 'dist'}/`, import.meta.url));
const mime = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
async function asset(url) {
    const requested = path.resolve(dist, '.' + new URL(url).pathname);
    if (!requested.startsWith(dist)) return new Response('Unavailable', { status: 404 });
    try { return new Response(await readFile(requested), { headers: { 'content-type': mime[path.extname(requested)] || 'application/octet-stream', 'cache-control': 'no-store' } }); }
    catch { return new Response(await readFile(path.join(dist, 'index.html')), { headers: { 'content-type': 'text/html', 'cache-control': 'no-store' } }); }
}
const a = f.partners[0];
let map = (await f.request('/governed-maps', { method: 'POST', cookie: a.cookie, expected: 201,
    body: { regionGroupId: f.groupId, name: 'Fictional browser pilot map' } })).data.map;
for (const p of f.partners) map = (await f.request(`/governed-maps/${map.id}/resources`, { method: 'POST', cookie: a.cookie, expected: 201,
    body: { resourceType: 'hard', resourceId: p.resourceId } })).data.map;
map = (await f.request(`/governed-maps/${map.id}/publish`, { method: 'POST', cookie: a.cookie,
    body: { allowedOrigins: ['https://partner.fixture.example'] } })).data.map;
if (limitedRelease) f.env.GOVERNED_PILOT_ENABLED = 'false';
f.env.ALLOWED_ORIGINS = `http://localhost:${port}`;

const server = serve({ hostname: '127.0.0.1', port, fetch: async request => {
    const url = new URL(request.url);
    if (![ `localhost:${port}`, `127.0.0.1:${port}` ].includes(url.host)) return new Response('Local fixture only', { status: 403 });
    if (url.pathname.startsWith('/api/')) return f.app.fetch(request, f.env, f.execution);
    if (url.pathname === '/__fixture/info') return Response.json({ mapId: map.id, token: map.publication.shareToken });
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
