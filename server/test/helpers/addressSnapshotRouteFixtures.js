import { Hono } from 'hono';
import application from '../../src/app.js';
import { createAddressSnapshotRoutes, addressSnapshotResponseHeaders } from '../../src/routes/addressSnapshot.js';
import { cookieSessionCsrfGuard, securityHeaders } from '../../src/middleware/security.js';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_HEADER_NAME } from '../../src/utils/sessionAuth.js';

export const TEST_SNAPSHOT_SHA = 'a'.repeat(64);
export const TEST_AREA = { type: 'circle', center: [1.38, 103.75], radiusMeters: 500 };
export const validAreaQuery = (extra = {}) => ({ area: TEST_AREA, snapshotSha256: TEST_SNAPSHOT_SHA, ...extra });
export const validNearbyQuery = (extra = {}) => ({ lat: 1.38, lng: 103.75, snapshotSha256: TEST_SNAPSHOT_SHA, ...extra });

export class AddressSnapshotTestBucket {
    objects = new Map(); calls = []; writes = []; beforeGet = null; deliveredBytes = 0; cancelled = [];
    activeReads = 0; peakReads = 0;
    constructor(objects = new Map()) {
        for (const [key, value] of objects) this.objects.set(key, { ...value, bytes: new Uint8Array(value.bytes) });
    }
    async get(key) {
        this.calls.push(key); this.activeReads++; this.peakReads = Math.max(this.peakReads, this.activeReads);
        try {
            await this.beforeGet?.(key);
            const entry = this.objects.get(key); if (!entry) return null;
            const bytes = entry.bytes.slice(), bucket = this;
            let offset = 0;
            const stream = new ReadableStream({
                pull(controller) {
                    if (offset === bytes.length) { controller.close(); return; }
                    const end = Math.min(bytes.length, offset + (entry.chunkBytes || 65536));
                    const chunk = bytes.slice(offset, end); offset = end; bucket.deliveredBytes += chunk.length; controller.enqueue(chunk);
                },
                cancel() { bucket.cancelled.push(key); },
            }, { highWaterMark: 0 });
            const response = new Response(stream);
            return { key, etag: entry.etag || 'fictional-etag', size: entry.reportedSize ?? bytes.length,
                httpMetadata: { contentType: entry.contentType, cacheControl: 'private, no-store' },
                body: response.body, get bodyUsed() { return response.bodyUsed; },
                json: () => response.json(), text: () => response.text(), arrayBuffer: () => response.arrayBuffer() };
        } finally { this.activeReads--; }
    }
    async put(key) { this.writes.push({ method: 'put', key }); throw Error('Query attempted a write'); }
    async delete(key) { this.writes.push({ method: 'delete', key }); throw Error('Query attempted a delete'); }
    async list() { throw Error('Query attempted an unbounded list'); }
}

export function routeFixture({ repository, bucket = new AddressSnapshotTestBucket(), fullApp = false } = {}) {
    const liveUsers = new Map(), calls = { repositories: 0, metadata: 0, nearby: [], area: [] };
    const snapshot = { label: 'Fictional route test snapshot', sha256: TEST_SNAPSHOT_SHA, recordCount: 0, postalCodeCount: 0 };
    const defaultRepository = {
        metadata: async () => { calls.metadata++; return { ready: true, snapshot }; },
        nearby: async input => { calls.nearby.push(input); return { snapshot, total: 0, rows: [], offset: 0, limit: input.limit || 10, truncated: false }; },
        area: async input => { calls.area.push(input); return { snapshot, total: 0, rows: [], offset: input.offset || 0, limit: input.limit || 200, truncated: false }; },
    };
    const env = { NODE_ENV: 'production', JWT_SECRET: 'fictional-address-route-tests-only', HELP_CMS_BUCKET: bucket,
        AUTH_TEST_LIVE_SESSION_USER_RESOLVER: async claims => {
            if (!liveUsers.has(claims.id)) throw Error('Synthetic session user no longer exists');
            return { ...liveUsers.get(claims.id) };
        } };
    const app = fullApp ? application : new Hono();
    if (!fullApp) {
        app.use('*', addressSnapshotResponseHeaders);
        app.use('*', securityHeaders);
        app.use('*', cookieSessionCsrfGuard);
        app.route('/api/address-snapshot', createAddressSnapshotRoutes({ repositoryForContext: () => { calls.repositories++; return repository || defaultRepository; } }));
    }
    const tokenFor = async (actor = { id: 91103, role: 'standard' }, options = {}) => {
        liveUsers.set(actor.id, actor);
        return createSessionToken(actor, { env }, options);
    };
    async function request(path, { method = path.endsWith('/metadata') ? 'GET' : 'POST', body, rawBody, actor, token, cookie = false, headers = {}, cloneSpy } = {}) {
        if (actor) token = await tokenFor(actor);
        const values = { Origin: 'https://app.carearound.sg', ...headers };
        if (token) values[cookie ? 'Cookie' : SESSION_HEADER_NAME] = cookie ? `${SESSION_COOKIE_NAME}=${token}` : token;
        const payload = rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined;
        if (payload !== undefined && !Object.keys(values).some(key => key.toLowerCase() === 'content-type')) values['Content-Type'] = 'application/json';
        const req = new Request(`https://api.carearound.sg${path}`, { method, headers: values,
            ...(payload !== undefined ? { body: payload } : {}), ...(payload instanceof ReadableStream ? { duplex: 'half' } : {}) });
        if (cloneSpy) { const clone = req.clone.bind(req); req.clone = () => { cloneSpy(); return clone(); }; }
        return app.fetch(req, env);
    }
    return { app, env, liveUsers, bucket, calls, tokenFor, request };
}

export function assertPrivateHeaders(assert, response) {
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    const vary = response.headers.get('Vary')?.toLowerCase().split(',').map(value => value.trim());
    for (const value of ['origin', 'cookie', 'authorization', 'x-session-token']) assert.ok(vary?.includes(value), `Vary includes ${value}`);
}
