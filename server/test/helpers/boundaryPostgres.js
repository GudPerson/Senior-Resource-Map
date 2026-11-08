import { createNeonPostgresFixture } from '../fixtures/neonPostgresFixture.mjs';
import { createSessionToken } from '../../src/utils/sessionAuth.js';
import app from '../../src/app.js';

// The existing test transport sends actual parameterized Neon HTTP SQL to one
// ephemeral PostgreSQL/WASM engine. No socket, remote database or .env loading.
export async function createBoundaryPostgres(t) {
    const { pg, statements, env } = await createNeonPostgresFixture(t, { shape: 'fresh' });
    await pg.exec(`
        INSERT INTO users(id, username, email, password_hash, name, role) VALUES
            (11,'cedar','cedar@example.test','unused','Cedar','standard'),
            (12,'birch','birch@example.test','unused','Birch','super_admin'),
            (13,'guest','guest@example.test','unused','Guest','guest');
        INSERT INTO hard_assets(id,name,lat,lng,address) VALUES
            (21,'Fictional Cedar Place',1.31,103.81,'One Example Way'),
            (22,'Fictional Birch Place',1.32,103.82,'Two Example Way'),
            (23,'Unlocated Place','NaN',103.83,'Unknown');
        INSERT INTO hard_asset_staff_memberships(user_id, hard_asset_id, staff_role)
            VALUES (11,21,'owner'),(11,22,'staff'),(11,23,'owner');
        INSERT INTO my_maps(id,user_id,name) VALUES (41,11,'Private source');
    `);
    const source = { mapId: 41, annotationId: 'source-shape', revision: 7 };
    const annotations = [{ id: source.annotationId, name: 'Original shape', groupName: 'Original group',
        type: 'circle', points: [[1.31,103.81],[1.32,103.82]], text: 'Label', isShared: true,
        resourceLinks: [{type:'hard',id:21}], image: {assetId:'exclude'} },
        { id: 'line', type: 'line', points: [[1.31,103.81],[1.32,103.82]] }];
    await pg.query('INSERT INTO my_map_print_annotation_documents(map_id,revision,annotations) VALUES(41,7,$1)',
        [JSON.stringify(annotations)]);
    const requestEnv = { ...env, JWT_SECRET: 'fictional-boundary-test-secret' };
    async function request(path, { user = 11, method = 'GET', body } = {}, overrides = {}) {
        const headers = {};
        if (user) headers['X-Session-Token'] = await createSessionToken({ id: user }, { env: requestEnv });
        if (body) headers['Content-Type'] = 'application/json';
        const response = await (overrides.app || app).request('http://localhost/api/' + path, {
            method, headers, body: body ? JSON.stringify(body) : undefined,
        }, { ...requestEnv, ...overrides.env });
        const raw = await response.text();
        return { status: response.status, json: response.headers.get('content-type')?.includes('json') ? JSON.parse(raw) : raw };
    }
    return { pg, statements, source, request };
}
