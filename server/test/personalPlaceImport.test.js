import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';

import { getDb } from '../src/db/index.js';
import { createMyMapPersonalPlacesImportHandler, importMyMapPersonalPlaces,
    personalPlaceImportBodySchema } from '../src/controllers/personalPlaceImportController.js';
import { patchPersonalPlace, resolvePersonalPlaceUpdateLocation, serializePersonalPlace, updatePersonalPlace } from '../src/controllers/personalPlacesController.js';
import { patchMyMapPersonalPlace } from '../src/controllers/myMapsController.js';
import { resolvePersonalPlaceLocation } from '../src/utils/personalPlaceLocation.js';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';

const owner = { id: 1, role: 'standard' };
const other = { id: 2, role: 'standard' };
const baseRow = (overrides = {}) => ({ name: 'Fictional pickup', postalCode: '012345',
    address: 'FICTIONAL BASE ADDRESS #02-03', shortDescription: 'Meet at the door.', categoryId: null, ...overrides });
const lookupFetch = async (url) => {
    const postalCode = new URL(url).searchParams.get('searchVal');
    return Response.json({ results: [{ POSTAL: postalCode,
        ADDRESS: postalCode === '012345' ? 'FICTIONAL BASE ADDRESS' : 'SECOND FICTIONAL ADDRESS',
        LATITUDE: '1.29412345', LONGITUDE: '103.82112345' }] });
};
const resolveLocation = (body) => resolvePersonalPlaceLocation(body, lookupFetch);

test('owner place import metadata retains raw SQL description semantics without changing displayed text', () => {
    const serialize = (shortDescription, note) => serializePersonalPlace({ id: 1, name: 'Fictional',
        shortDescription, note, lat: '1.3', lng: '103.8' });
    for (const raw of [' Legacy ', '\nLegacy\n', 'Legacy\n description']) {
        assert.equal(serialize(null, raw).importShortDescription, raw);
        assert.equal(serialize(raw, 'Older note').importShortDescription, raw);
    }
    const explicitEmpty = serialize('', 'Older note');
    assert.equal(explicitEmpty.importShortDescription, '');
    assert.equal(explicitEmpty.shortDescription, 'Older note');
    assert.equal(serialize(null, null).importShortDescription, '');
});

test('personal-place import rejects oversized, malformed or extra fields without truncating them', () => {
    assert.equal(personalPlaceImportBodySchema.safeParse({ rows: [baseRow()] }).success, true);
    assert.equal(personalPlaceImportBodySchema.safeParse({ rows: [baseRow({ shortDescription: undefined, categoryId: undefined })] }).success, true);
    for (const row of [baseRow({ name: '' }), baseRow({ name: 'a'.repeat(161) }),
        baseRow({ postalCode: 12345 }), baseRow({ postalCode: '12345' }), baseRow({ postalCode: '1234567' }),
        baseRow({ shortDescription: 'a'.repeat(241) }), baseRow({ shortDescription: {} }),
        baseRow({ address: '' }), baseRow({ address: 'a'.repeat(501) }),
        baseRow({ categoryId: 1.5 }), baseRow({ categoryId: '1' }), baseRow({ categoryId: 2147483648 }),
        baseRow({ lat: 1.2 }), baseRow({ userId: 2 }), baseRow({ personalPlaceId: 5 })]) {
        assert.equal(personalPlaceImportBodySchema.safeParse({ rows: [row] }).success, false);
    }
    for (const body of [{ rows: [] }, { rows: Array(26).fill(baseRow()) }, { rows: [baseRow()], userId: 2 }]) {
        assert.equal(personalPlaceImportBodySchema.safeParse(body).success, false);
    }
});

test('personal-place import uses actual Neon HTTP transaction SQL over disposable PostgreSQL', async (t) => {
    const { pg, env, statements } = await createNeonPostgresFixture(t);
    const db = getDb(env);
    await pg.exec(`INSERT INTO users (id, username, email, password_hash, name, role) VALUES
        (1, 'import-one', 'import-one@example.test', 'fictional', 'Import one', 'standard'),
        (2, 'import-two', 'import-two@example.test', 'fictional', 'Import two', 'standard');
        INSERT INTO my_maps (id, user_id, name) VALUES (1, 1, 'First'), (2, 1, 'Second'), (3, 2, 'Other');
        INSERT INTO user_personal_place_categories (id, user_id, name, normalized_name, is_archived) VALUES
        (1, 1, 'Own active', 'own active', false), (2, 1, 'Own archived', 'own archived', true),
        (3, 2, 'Other active', 'other active', false);`);
    const clear = async () => pg.exec('TRUNCATE user_personal_places RESTART IDENTITY CASCADE');
    const places = async () => (await pg.query('SELECT * FROM user_personal_places ORDER BY id')).rows;
    const links = async () => (await pg.query('SELECT * FROM my_map_personal_place_links ORDER BY id')).rows;
    const run = (rows = [baseRow()], mapId = 1, user = owner, options = {}) =>
        importMyMapPersonalPlaces(db, user, mapId, { rows }, { resolveLocation, ...options });

    await t.test('guest and foreign-map requests cannot trigger postal lookups or writes', async () => {
        let calls = 0;
        const resolve = async () => { calls++; throw new Error('Should not look up'); };
        await assert.rejects(run([baseRow()], 1, { ...owner, role: 'guest' }, { resolveLocation: resolve }), { status: 403 });
        await assert.rejects(run([baseRow()], 1, other, { resolveLocation: resolve }), { status: 404 });
        await assert.rejects(run([baseRow()], 3, owner, { resolveLocation: resolve }), { status: 404 });
        await assert.rejects(run([baseRow()], 1, { ...other, role: 'super_admin' }, { resolveLocation: resolve }), { status: 404 });
        assert.equal(calls, 0);
        assert.equal((await places()).length, 0);
    });

    await t.test('verified pins retain unit details, generic category and leading postal zero', async () => {
        const result = await run();
        assert.deepEqual(result, { results: [{ index: 0, status: 'created', placeId: 1 }],
            createdCount: 1, attachedCount: 0, skippedCount: 0 });
        const [place] = await places();
        assert.equal(place.address, baseRow().address);
        assert.equal(place.postal_code, '012345');
        assert.equal(place.category_id, null);
        assert.equal(place.lat, '1.2941235');
        assert.equal(place.lng, '103.8211235');
        assert.equal(place.short_description, 'Meet at the door.');
        assert.equal((await links())[0].short_descriptors[0].text, 'Meet at the door.');
        assert.equal((await pg.query('SELECT count(*)::integer count FROM user_personal_place_categories')).rows[0].count, 3);
    });

    await t.test('replay skips the existing link and reuse attaches to another owned map without overwriting', async () => {
        await pg.exec(`UPDATE my_map_personal_place_links SET short_descriptors =
            '[{"text":"Map-only customised context","textColor":"#112233"}]'::jsonb WHERE map_id = 1`);
        const repeat = await run();
        assert.equal(repeat.results[0].status, 'already_added');
        const reused = await run([baseRow()], 2);
        assert.equal(reused.results[0].status, 'attached');
        assert.equal(reused.createdCount, 0);
        assert.equal((await places()).length, 1);
        assert.equal((await links()).length, 2);
        assert.equal((await links())[0].short_descriptors[0].text, 'Map-only customised context');
    });

    await t.test('different unit addresses stay separate while exact duplicate input rows collapse', async () => {
        await clear();
        const result = await run([baseRow(), baseRow(), baseRow({ address: 'FICTIONAL BASE ADDRESS #03-04' })]);
        assert.deepEqual(result.results.map((row) => row.status), ['created', 'already_added', 'created']);
        assert.equal(result.results[0].placeId, result.results[1].placeId);
        assert.notEqual(result.results[0].placeId, result.results[2].placeId);
        assert.equal((await places()).length, 2);
        assert.equal((await links()).length, 2);
    });

    await t.test('active owner categories are accepted; archived, foreign and unknown categories reject every batch row', async () => {
        await clear();
        await run([baseRow({ categoryId: 1 })]);
        assert.equal((await places())[0].category_id, 1);
        for (const categoryId of [2, 3, 999]) {
            const before = await places();
            await assert.rejects(run([baseRow({ name: 'Valid new place' }), baseRow({ name: 'Invalid category', categoryId })]),
                (error) => error.status === 409 && error.rowErrors[0].index === 1);
            assert.deepEqual(await places(), before);
        }
    });

    await t.test('existing description or category conflicts do not overwrite a place or create other batch rows', async () => {
        const before = await places();
        for (const changed of [baseRow({ categoryId: null }), baseRow({ categoryId: 1, shortDescription: 'Changed' })]) {
            await assert.rejects(run([baseRow({ name: 'Would otherwise create' }), changed]),
                (error) => error.status === 409 && error.rowErrors[0].index === 1);
            assert.deepEqual(await places(), before);
        }
    });

    await t.test('duplicate input conflicts and ambiguous existing records block the complete batch', async () => {
        await clear();
        await assert.rejects(run([baseRow(), baseRow({ shortDescription: 'Different' })]),
            (error) => error.status === 409 && error.rowErrors.length === 2);
        assert.equal((await places()).length, 0);
        await run();
        await pg.exec(`INSERT INTO user_personal_places (user_id, name, address, postal_code, lat, lng, short_description)
            SELECT user_id, name, address, postal_code, lat, lng, short_description FROM user_personal_places`);
        await assert.rejects(run(), (error) => error.status === 409 && /More than one/.test(error.rowErrors[0].error));
        assert.equal((await places()).length, 2);
        assert.equal((await links()).length, 1);
    });

    await t.test('legacy category labels and private description fallback are not silently treated as empty generic data', async () => {
        await clear();
        await run();
        await pg.exec("UPDATE user_personal_places SET legacy_category_label = 'Family'");
        await assert.rejects(run(), { status: 409 });
        await pg.exec("UPDATE user_personal_places SET legacy_category_label = 'Personal place', short_description = NULL, note = 'Legacy description'");
        await assert.rejects(run(), { status: 409 });
        const reused = await run([baseRow({ shortDescription: 'Legacy description' })]);
        assert.equal(reused.results[0].status, 'already_added');
    });

    await t.test('each distinct postal is verified once per batch and verification failures save nothing', async () => {
        await clear();
        const calls = [];
        await run([baseRow(), baseRow({ name: 'Second' }), baseRow({ name: 'Third', postalCode: '654321' })], 1, owner,
            { resolveLocation: async (body) => { calls.push(body.postalCode); return resolveLocation(body); } });
        assert.deepEqual(calls, ['012345', '654321']);
        await clear();
        for (const resolve of [async () => { throw Object.assign(new Error('Unknown postal'), { status: 400 }); },
            async () => { throw new Error('Fictional outage'); },
            async () => ({ postalCode: '999999', address: 'Wrong', lat: 1.2, lng: 103.7 }),
            async () => ({ postalCode: '012345', address: 'Wrong', lat: 91, lng: 103.7 })]) {
            await assert.rejects(run(undefined, 1, owner, { resolveLocation: resolve }),
                (error) => [400, 503].includes(error.status) && error.rowErrors[0].index === 0);
            assert.equal((await places()).length, 0);
        }
    });

    await t.test('the owned map is rechecked after lookup inside the locked transaction', async () => {
        await clear();
        await assert.rejects(run(undefined, 1, owner, { resolveLocation: async (body) => {
            await pg.exec('UPDATE my_maps SET user_id = 2 WHERE id = 1');
            return resolveLocation(body);
        } }), { status: 404 });
        assert.equal((await places()).length, 0);
        await pg.exec('UPDATE my_maps SET user_id = 1 WHERE id = 1');
    });

    await t.test('a link-write failure rolls back newly inserted library places', async () => {
        await clear();
        await pg.exec(`CREATE FUNCTION reject_import_link() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'Fictional link failure'; END $$;
            CREATE TRIGGER reject_import_link BEFORE INSERT ON my_map_personal_place_links
                FOR EACH ROW EXECUTE FUNCTION reject_import_link();`);
        await assert.rejects(run(), /Fictional link failure/);
        assert.equal((await places()).length, 0);
        assert.equal((await links()).length, 0);
        await pg.exec('DROP TRIGGER reject_import_link ON my_map_personal_place_links; DROP FUNCTION reject_import_link()');
    });

    await t.test('simultaneous imports reuse the committed content and take the owner lock before matching', async () => {
        await clear();
        const start = statements.length;
        const results = await Promise.all([run(), run()]);
        assert.deepEqual(results.map((result) => result.results[0].status).sort(), ['already_added', 'created']);
        assert.equal((await places()).length, 1);
        assert.equal((await links()).length, 1);
        const writes = statements.slice(start).filter((statement) => /pg_advisory_xact_lock|WITH input AS MATERIALIZED/.test(statement));
        assert.equal(writes.length, 4);
        assert.match(writes[0], /pg_advisory_xact_lock/);
        assert.match(writes[1], /WITH input AS MATERIALIZED/);
        assert.match(writes[2], /pg_advisory_xact_lock/);
        assert.match(writes[3], /WITH input AS MATERIALIZED/);
    });

    await t.test('the largest accepted batch creates and links all 25 rows in one atomic write set', async () => {
        await clear();
        const rows = Array.from({ length: 25 }, (_, index) => baseRow({ name: `Fictional place ${index}` }));
        const result = await run(rows);
        assert.equal(result.createdCount, 25);
        assert.equal(result.results.length, 25);
        assert.deepEqual(result.results.map((row) => row.index), Array.from({ length: 25 }, (_, index) => index));
        assert.equal((await places()).length, 25);
        assert.equal((await links()).length, 25);
        await clear();
        await run();
    });

    await t.test('lost or malformed post-commit responses stay unconfirmed and content-safe retries skip them', async () => {
        for (const lostResponse of [true, false]) {
            await clear();
            const uncertainDb = Object.create(db);
            uncertainDb.batch = async (queries) => {
                await db.batch(queries);
                if (lostResponse) throw new Error('Fictional lost response after commit');
                return [];
            };
            const app = new Hono();
            app.use('*', async (c, next) => { c.set('user', owner); await next(); });
            app.post('/my-maps/:id/personal-places/import', createMyMapPersonalPlacesImportHandler({
                dbForContext: () => uncertainDb, ensureSchema: async () => {}, resolveLocation,
            }));
            const response = await app.request('/my-maps/1/personal-places/import', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: [baseRow()] }),
            }, env);
            assert.equal(response.status, lostResponse ? 500 : 503);
            assert.match((await response.json()).error, /could not be confirmed/);
            assert.equal((await places()).length, 1);
            assert.equal((await run()).results[0].status, 'already_added');
            assert.equal((await places()).length, 1);
        }
    });

    await t.test('ordinary library and map edits preserve custom address and an omitted description; blank explicitly clears', async () => {
        t.mock.method(globalThis, 'fetch', lookupFetch);
        const place = (await places())[0];
        const body = { name: 'Renamed', postalCode: '012345', address: 'FICTIONAL BASE ADDRESS',
            lat: 0, lng: 0, categoryId: null, categoryLabel: '', locationMode: 'addressed' };
        const app = new Hono();
        app.use('*', async (c, next) => { c.set('user', owner); await next(); });
        app.patch('/places/:placeId', patchPersonalPlace);
        app.patch('/maps/:id/personal-places/:placeId', patchMyMapPersonalPlace);
        for (const path of [`/places/${place.id}`, `/maps/1/personal-places/${place.id}`]) {
            const response = await app.request(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body) }, env);
            assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
            const saved = (await places())[0];
            assert.equal(saved.address, baseRow().address);
            assert.equal(saved.short_description, baseRow().shortDescription);
            assert.equal(saved.category_id, null);
            assert.equal(saved.lat, '1.2941235');
            assert.equal((await pg.query('SELECT count(*)::integer count FROM user_personal_place_categories')).rows[0].count, 3);
        }
        await updatePersonalPlace(db, owner, place.id, { ...body, shortDescription: '' });
        assert.equal((await places())[0].short_description, null);
        const changed = await resolvePersonalPlaceUpdateLocation(db, owner, place.id,
            { ...body, postalCode: '654321' }, lookupFetch);
        assert.equal(changed.address, 'SECOND FICTIONAL ADDRESS');
        assert.equal(changed.postalCode, '654321');
        await assert.rejects(resolvePersonalPlaceUpdateLocation(db, other, place.id, body, lookupFetch), { status: 404 });
    });

    await t.test('HTTP reports batch-relative errors, bounded requests, and private role denial', async () => {
        const app = new Hono();
        let user = owner;
        app.use('*', async (c, next) => { c.set('user', user); await next(); });
        app.post('/my-maps/:id/personal-places/import', createMyMapPersonalPlacesImportHandler({ resolveLocation }));
        const request = (body, id = '1') => app.request(`/my-maps/${id}/personal-places/import`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, env);
        let response = await request({ rows: [baseRow(), baseRow({ postalCode: 'bad' })] });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).rowErrors[0].index, 1);
        response = await request({ rows: Array(26).fill(baseRow()) });
        assert.equal(response.status, 400);
        response = await request({ rows: [baseRow()] }, '1junk');
        assert.equal(response.status, 400);
        user = { ...owner, role: 'guest' };
        response = await request({ rows: [baseRow()] });
        assert.equal(response.status, 403);
        user = other;
        response = await request({ rows: [baseRow()] });
        assert.equal(response.status, 404);
    });
});

test('an import fails closed when atomic batch support is absent', async () => {
    await assert.rejects(importMyMapPersonalPlaces({}, owner, 1, { rows: [baseRow()] }), { status: 503 });
});
