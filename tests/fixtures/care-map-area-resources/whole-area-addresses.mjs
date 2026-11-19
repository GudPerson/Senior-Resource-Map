import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { compileAddressSnapshotRecords } from '../../../scripts/build-address-snapshot.mjs';
import { createAddressSnapshotRoutes } from '../../../server/src/routes/addressSnapshot.js';
import { createAddressSnapshotRepository } from '../../../server/src/utils/addressSnapshotRepository.js';
import { createAddressSnapshotScanRepository } from '../../../server/src/utils/addressSnapshotScanRepository.js';
import { createSessionToken, SESSION_HEADER_NAME } from '../../../server/src/utils/sessionAuth.js';

// The grid gives 300 candidate tiles. Entire steps fall into the gap between
// the two parts. The hole and gap are excluded by the independent grid oracle.
const outer = [[1.201, 103.601], [1.201, 103.799], [1.271, 103.799], [1.271, 103.601]];
const hole = [[1.211, 103.621], [1.231, 103.621], [1.231, 103.661], [1.211, 103.661]];
const island = [[1.301, 103.601], [1.301, 103.799], [1.349, 103.799], [1.349, 103.601]];
const geoJsonRing = ring => [...ring, ring[0]].map(([lat, lng]) => [lng, lat]);
export const wholeArea = { type: 'MultiPolygon', coordinates: [[geoJsonRing(outer), geoJsonRing(hole)], [geoJsonRing(island)]] };
export const wholeAreaAnnotation = {
    id: 'fictional-whole-area', type: 'polygon', text: 'Fictional multipart boundary',
    boundarySource: 'kml', boundaryParts: [[4, 4], [4]], points: [...outer, ...hole, ...island],
    controlPoints: [...outer, ...hole, ...island],
};

function createVersion(version) {
    const source = Array.from({ length: 900 }, (_, ordinal) => {
        const tile = 299 - Math.floor(ordinal / 3);
        const row = Math.floor(tile / 20), column = tile % 20;
        const lat = 1.205123456789 + row * .01, lng = 103.605123456789 + column * .01;
        const postalCode = ordinal < 2 ? '012345' : String(100000 + ordinal);
        const block = String(ordinal + 1), roadName = 'Fictional Whole Area Road';
        const building = ordinal === 0 ? 'Fictional, "first" building' : `Fictional building ${block}`;
        const address = `${block} Fictional Whole Area Road ${version}`;
        const inside = (row < 7 || row >= 10) && !(row >= 1 && row <= 2 && column >= 2 && column <= 5);
        return { inside, fields: [postalCode, block, roadName, building, address, String(lat), String(lng)] };
    });
    const records = source.map(row => row.fields);
    const sourceSha256 = createHash('sha256').update(JSON.stringify(records)).digest('hex');
    const artifacts = compileAddressSnapshotRecords(records, { sourceSha256, preparedAt: '2026-11-03T00:00:00.000Z' });
    const oracle = source.filter(row => row.inside).map(({ fields: [postalCode, block, roadName, building, address, lat, lng] }) =>
        ({ postalCode, block, roadName, building, address, lat: Number(lat), lng: Number(lng) }));
    return { artifacts, oracle };
}

export async function createWholeAreaFixture() {
    const versions = ['original', 'revised'].map(createVersion);
    const writes = [];
    const env = { NODE_ENV: 'production', JWT_SECRET: 'fictional-whole-area-browser-only',
        AUTH_TEST_LIVE_SESSION_USER_RESOLVER: async claims => ({ id: claims.id, role: 'standard' }) };
    const token = await createSessionToken({ id: 91103, role: 'standard' }, { env });
    const providers = versions.map(({ artifacts }) => {
        const bucket = {
            async get(key) {
                const object = artifacts.objects.get(key);
                return object ? { etag: object.sha256, size: object.bytes.length,
                    httpMetadata: { contentType: object.contentType }, body: new Response(object.bytes).body } : null;
            },
            async put() { writes.push('put'); throw new Error('Unexpected simulated bucket write'); },
            async delete() { writes.push('delete'); throw new Error('Unexpected simulated bucket delete'); },
        };
        const app = new Hono();
        app.route('/api/address-snapshot', createAddressSnapshotRoutes({
            repositoryForContext: () => createAddressSnapshotRepository(bucket, { config: artifacts.config }),
            scanRepositoryForContext: () => createAddressSnapshotScanRepository(bucket, { config: artifacts.config }),
        }));
        return app;
    });
    return {
        writes,
        versions: versions.map(({ artifacts, oracle }) => ({ snapshot: artifacts.manifest.snapshot, oracle })),
        async request(version, method, pathname, body) {
            const headers = { [SESSION_HEADER_NAME]: token };
            if (body) headers['Content-Type'] = 'application/json';
            return providers[version].fetch(new Request(`http://127.0.0.1${pathname}`, {
                method, headers, ...(body ? { body: JSON.stringify(body) } : {}),
            }), env);
        },
    };
}
