// Fictional browser fixture: real authenticated Hono routes and immutable R2
// repository over in-memory artifacts. No production token, bucket or network.
import { Hono } from 'hono';
import { createAddressSnapshotRoutes } from '../../../server/src/routes/addressSnapshot.js';
import { createAddressSnapshotRepository } from '../../../server/src/utils/addressSnapshotRepository.js';
import { createSessionToken } from '../../../server/src/utils/sessionAuth.js';
import { compileAddressSnapshotRecords } from '../../../scripts/build-address-snapshot.mjs';
import { center, owner } from './fictional-api.mjs';

export function fictionalAddressRows() {
    return Array.from({ length: 225 }, (_, index) => ({ id: `fictional-address-${index}`, postalCode: index < 2 ? '012345' : String(100000 + index), block: String(index + 1), roadName: 'Fictional Preview Road', building: index === 0 ? '=1+1' : `Fictional block ${index + 1}`, address: index === 0 ? '=HYPERLINK("https://invalid.example")' : `${index + 1} Fictional Preview Road`, lat: center[0] + (index % 15) * 0.000005, lng: center[1] + Math.floor(index / 15) * 0.000005 }));
}
export async function createProductionSnapshotFixture() {
    const records = fictionalAddressRows().map(row => [row.postalCode, row.block, row.roadName, row.building, row.address, String(row.lat), String(row.lng)]);
    const artifacts = compileAddressSnapshotRecords(records, { sourceSha256: '0'.repeat(64), preparedAt: '2026-11-03T00:00:00.000Z' });
    const reads = [], requests = [];
    const bucket = { async get(key) {
        reads.push(key);
        const object = artifacts.objects.get(key);
        return object ? { size: object.bytes.length, httpMetadata: { contentType: object.contentType }, body: new Response(object.bytes).body } : null;
    } };
    const repository = createAddressSnapshotRepository(bucket, { config: artifacts.config });
    const app = new Hono();
    app.route('/api/address-snapshot', createAddressSnapshotRoutes({ repositoryForContext: () => repository }));
    const env = { NODE_ENV: 'production', JWT_SECRET: 'fictional-spatial-browser-secret-only',
        AUTH_TEST_LIVE_SESSION_USER_RESOLVER: async claims => ({ id: claims.id, role: 'standard' }) };
    const token = await createSessionToken(owner, { env });
    return {
        async handle(req, body) {
            const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
            if (pathname === '/__preview/address-session') return new Response('{}', { headers: {
                'Content-Type': 'application/json', 'Cache-Control': 'no-store',
                'Set-Cookie': `sc_token=${token}; Path=/; HttpOnly; SameSite=Lax`,
            } });
            if (pathname === '/__preview/address-audit') return Response.json({ provider: 'real Hono auth/routes/repository; fictional signed session and in-memory R2', requestCount: requests.length, requests, r2ReadCount: reads.length, snapshotSha256: artifacts.config.sourceSha256 });
            if (!pathname.startsWith('/api/address-snapshot/')) return null;
            requests.push({ method: req.method, path: pathname, ...(body ? { snapshotSha256: body.snapshotSha256 } : {}), cookiePresent: Boolean(req.headers.cookie) });
            return app.fetch(new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers: req.headers,
                ...(!['GET', 'HEAD'].includes(req.method) ? { body: JSON.stringify(body) } : {}) }), env);
        },
        snapshot: artifacts.manifest.snapshot,
    };
}
