// Local framing probe for the real Pages handler and disposable map API.
// This serves a labelled probe document, not the application: use the normal
// support browser harness separately to verify the actual embed UI/payload.
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { onRequest } from '../../../client/functions/embed/maps/[token].js';

if (process.env.CAREAROUND_SUPPORT_FIXTURE !== 'true') throw new Error('Explicit fixture mode is required.');
const apiBase = 'http://127.0.0.1:8791/api';
const mapsResponse = await fetch(`${apiBase}/my-maps`, { headers: { Cookie: 'carearound_support_fixture=member' } });
if (!mapsResponse.ok) throw new Error('Start the disposable support browser fixture first.');
const maps = await mapsResponse.json();
const map = maps.find((item) => item.name === 'Synthetic care map' && item.isShared && item.embedEnabled);
if (!map || !/^[A-Za-z0-9_-]{16,128}$/.test(map.shareToken)) throw new Error('Publish and enable the synthetic map first.');
const embedPath = `/embed/maps/${map.shareToken}`;
const servers = [];

for (const port of [5180, 5181, 5182]) {
    const app = new Hono();
    app.use('*', async (c, next) => {
        if (c.req.header('host') !== `127.0.0.1:${port}`) return c.text('Local fixture only', 403);
        c.header('Cache-Control', 'no-store');
        await next();
    });
    if (port === 5182) {
        app.get('/embed/maps/:token', (c) => onRequest({
            request: c.req.raw,
            params: { token: c.req.param('token') },
            env: {
                CAREAROUND_EMBED_API_BASE_URL: apiBase,
                ASSETS: { fetch: async () => new Response('<!doctype html><html lang="en"><title>Framing probe</title><h1>Approved framing probe loaded</h1><p>Synthetic document. Actual embed UI is tested separately.</p></html>', {
                    headers: { 'Content-Type': 'text/html; charset=UTF-8', 'X-Frame-Options': 'DENY' },
                }) },
            },
        }));
    } else {
        app.get('/', (c) => c.html(`<!doctype html><html lang="en"><title>Local parent ${port}</title><h1>${port === 5180 ? 'Approved' : 'Unapproved'} parent</h1><iframe title="Synthetic framing probe" src="http://127.0.0.1:5182${embedPath}" width="900" height="520"></iframe></html>`));
    }
    servers.push(serve({ hostname: '127.0.0.1', port, fetch: app.fetch }));
}
console.log('Local framing probe: approved parent 5180, unapproved parent 5181, actual Pages handler 5182.');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    for (const server of servers) server.close();
});
