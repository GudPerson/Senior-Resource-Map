import { Hono } from 'hono';
import { createBoundaryZoneJobRoutes } from '../../src/routes/boundaryZoneJobs.js';
import { compileAddressSnapshotRecords } from '../../../scripts/build-address-snapshot.mjs';
import { createBoundaryPostgres } from './boundaryPostgres.js';

export function snapshot(points) {
    const data = compileAddressSnapshotRecords(points.map(([code, lat, lng], i) => [code, String(i), 'Fictional street', '', 'Fictional address', String(lat), String(lng)]), { sourceSha256: 'b'.repeat(64), preparedAt: '2026-11-03T00:00:00.000Z' });
    const bucket = { async get(key) {
            const object = data.objects.get(key);
            if (!object)
                return null;
            return { size: object.bytes.length, etag: object.sha256, httpMetadata: { contentType: object.contentType }, body: new Response(object.bytes).body };
        } };
    return { ...data, bucket };
}
export const path = 'boundary-zone-jobs';

export async function jobsFixture(t) {
    const db = await createBoundaryPostgres(t);
    const data = snapshot([['001234', 1.311, 103.811], ['001234', 1.312, 103.812], ['001235', 1.313, 103.813]]);
    const app = new Hono().route('/api/' + path, createBoundaryZoneJobRoutes({ config: data.config }));
    const request = (p, opts) => db.request(p, opts, { app, env: { HELP_CMS_BUCKET: data.bucket } });
    const row = { rowKey: 'first', source: db.source, hardAssetId: 21, name: 'Zone one', zoneCode: '  MiX   7 ', saveToLibrary: true };
    const post = (rows = [row], requestId = 'batch') => request(path, { method: 'POST', body: { requestId, rows } });
    const act = (job, action, extra = {}) => request(path + '/' + job.id + '/' + action, { method: 'POST', body: { expectedRevision: job.revision, ...extra } });
    const advance = async (job) => {
        for (let i = 0; ['preparing', 'committing'].includes(job.state) && i < 80; i++) {
            const res = await act(job, 'advance');
            if (res.status !== 200)
                throw Error(JSON.stringify(res));
            job = res.json;
        }
        return job;
    };
    const rows = async (sql) => (await db.pg.query(sql)).rows;
    return { ...db, originalRequest: db.request, request, post, act, advance, row, rows, data };
}
