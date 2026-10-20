import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createPrivateMapMediaRepository } from '../src/utils/privateMapMedia.js';
import { attachMapNoteImages, createMapNoteImageRepository } from '../src/utils/mapNoteImages.js';
import { createMapNoteImageHandlers } from '../src/controllers/mapNoteImagesController.js';
import { requestBodyGuard, cookieSessionCsrfGuard } from '../src/middleware/security.js';
import { SESSION_COOKIE_NAME } from '../src/utils/sessionAuth.js';
import { MapMediaBucket, png, whereValues } from './helpers/mapAnnotationFixtures.js';

async function setup() {
    const bucket = new MapMediaBucket(), media = createPrivateMapMediaRepository(bucket, 7);
    const first = await media.saveAsset(png(), 'image/png'), second = await media.saveAsset(png({ variant: 1 }), 'image/png');
    return { bucket, first, second, repo: createMapNoteImageRepository(bucket, 7) };
}

test('note images survive text-row replacement and attach only to the same map membership', async () => {
    const { repo, first } = await setup();
    const saved = await repo.replace(3, 'asset:31', { revision: 0, images: [{ assetId: first.assetId, isShared: false }] });
    assert.equal(saved.revision, 1);
    assert.deepEqual(saved.images, [{ ...first, isShared: false }]);
    const directory = { assets: [{ resourceType: 'hard', resourceId: 11, notes: { items: [{ id: 998, text: 'new text row' }] } }], places: [] };
    const { document } = await repo.read(3);
    const same = attachMapNoteImages(directory, { assets: [{ id: 31, resourceType: 'hard', resourceId: 11 }] }, document);
    assert.equal(same.assets[0].notes.items[0].text, 'new text row');
    assert.equal(same.assets[0].notes.images[0].assetId, first.assetId);
    const readded = attachMapNoteImages(directory, { assets: [{ id: 32, resourceType: 'hard', resourceId: 11 }] }, document);
    assert.equal(readded.assets[0].notes.images, undefined);
    assert.equal((await repo.read(4)).document.entries.length, 0);
    assert.equal((await createMapNoteImageRepository((await setup()).bucket, 8).read(3)).document.entries.length, 0);
});

test('compare-and-set refuses stale sessions, confirms uncertain retries and retains immutable byte quota', async () => {
    const { repo, bucket, first, second } = await setup();
    const one = { revision: 0, images: [{ assetId: first.assetId, isShared: false }] };
    await repo.replace(3, 'asset:31', one);
    assert.equal((await repo.replace(3, 'asset:31', one)).revision, 1);
    await assert.rejects(repo.replace(3, 'asset:31', { revision: 0, images: [{ assetId: second.assetId, isShared: false }] }), { status: 409 });
    const raced = { revision: 1, images: [{ assetId: first.assetId, isShared: true }] };
    bucket.beforePut = async key => { if (key.includes('note-images')) { const object = bucket.objects.get(key); object.etag = 'changed'; } };
    await assert.rejects(repo.replace(3, 'asset:31', raced), { status: 409 });
    bucket.beforePut = null;
    assert.equal((await repo.read(3)).document.entries[0].images[0].isShared, false);
    await repo.replace(3, 'asset:31', { revision: 1, images: [] });
    const ledger = await (await bucket.get('care-map-media/v1/owners/7/quota.json')).json();
    assert.equal(ledger.assets.length, 2, 'detaching preserves reusable immutable assets');
});

test('a forged or foreign image reference cannot consume a gallery revision', async () => {
    const { repo, bucket, first } = await setup();
    for (const body of [{ revision: 0, images: [{ ...first, assetId: 'f'.repeat(64), isShared: true }] },
        { revision: 0, images: [{ assetId: first.assetId, isShared: 'yes' }] },
        { revision: 0, images: Array(21).fill({ assetId: first.assetId, isShared: false }) }]) {
        await assert.rejects(repo.replace(3, 'asset:31', body));
    }
    await assert.rejects(createMapNoteImageRepository(bucket, 8).replace(3, 'asset:31', { revision: 0, images: [{ assetId: first.assetId, isShared: true }] }), { status: 404 });
    assert.equal((await repo.read(3)).document.revision, 0);
});

test('publication selects only explicitly shared images and freezes the image list; personal places never publish', async () => {
    const { repo, first, second } = await setup();
    await repo.replace(3, 'asset:31', { revision: 0, images: [{ assetId: first.assetId, isShared: false }, { assetId: second.assetId, isShared: true }] });
    await repo.replace(3, 'personal:71', { revision: 1, images: [{ assetId: first.assetId, isShared: false }] });
    const { document } = await repo.read(3);
    const map = { assets: [{ id: 31, resourceType: 'hard', resourceId: 11 }], personalPlaceLinks: [{ id: 71, personalPlaceId: 9 }] };
    const directory = { assets: [{ resourceType: 'hard', resourceId: 11 }], places: [{ rows: [{ resourceType: 'hard', resourceId: 11 }, { resourceType: 'personal_place', resourceId: 9 }] }] };
    const frozen = attachMapNoteImages(directory, map, document, { shared: true });
    assert.deepEqual(frozen.assets[0].notes.images, [{ ...second, isShared: true }]);
    assert.equal(frozen.places[0].rows[1].notes, undefined);
    await repo.replace(3, 'asset:31', { revision: 2, images: [] });
    assert.equal(frozen.assets[0].notes.images[0].assetId, second.assetId);
    const updated = attachMapNoteImages(directory, map, (await repo.read(3)).document, { shared: true });
    assert.equal(updated.assets[0].notes, undefined);
    assert.equal(JSON.stringify(frozen).includes('owners/'), false);
});

test('owner map duplication remaps membership ids and starts image sharing private', async () => {
    const { repo, first } = await setup();
    await repo.replace(3, 'asset:31', { revision: 0, images: [{ assetId: first.assetId, isShared: true }] });
    await repo.replace(3, 'personal:71', { revision: 1, images: [{ assetId: first.assetId, isShared: false }] });
    await repo.copy((await repo.read(3)).document, 4, new Map([['asset:31', 'asset:41'], ['personal:71', 'personal:81']]));
    const copied = (await repo.read(4)).document;
    assert.deepEqual(copied.entries.map(entry => entry.membershipKey), ['asset:41', 'personal:81']);
    assert.equal(copied.entries.every(entry => entry.images.every(image => image.isShared === false)), true);
});

function fixture({ bucket, user = { id: 7, role: 'standard' }, shared = null } = {}) {
    const db = { query: {
        myMaps: { findFirst: async ({ where }) => {
            const values = whereValues(where);
            if (values[0] === 3 && values[1] === 7) return { id: 3 };
            if (values[0] === 'shared-token' && values[1] === true && shared) return { userId: 7 };
            return null;
        } },
        myMapAssets: { findFirst: async ({ where }) => JSON.stringify(whereValues(where)) === '[3,"hard",11]' ? { id: 31 } : null },
        userPersonalPlaces: { findFirst: async ({ where }) => JSON.stringify(whereValues(where)) === '[9,7]' ? { id: 9 } : null },
        myMapPersonalPlaceLinks: { findFirst: async ({ where }) => JSON.stringify(whereValues(where)) === '[3,9]' ? { id: 71 } : null },
    } };
    const handlers = createMapNoteImageHandlers({ dbForContext: () => db, bucketForContext: () => bucket,
        sharedDirectory: async () => { if (!shared) throw Object.assign(new Error('revoked'), { status: 404 }); return shared; } });
    const app = new Hono(); app.use('*', requestBodyGuard); app.use('*', cookieSessionCsrfGuard);
    app.use('*', async (c, next) => { c.set('user', user); await next(); });
    app.get('/api/my-maps/:id/note-images/:resourceType/:resourceId', handlers.read);
    app.put('/api/my-maps/:id/note-images/:resourceType/:resourceId', handlers.replace);
    app.get('/api/shared-maps/:token/note-images/:assetId', handlers.sharedRead);
    return app;
}
const put = (app, body, path = '/api/my-maps/3/note-images/hard/11', headers = {}) => app.request(path, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
}, { NODE_ENV: 'production' });

test('owner HTTP routes reject guests, anonymous contexts, impersonation, foreign maps and foreign membership', async () => {
    const { bucket } = await setup();
    for (const user of [null, { id: 7, role: 'guest' }, { id: 7, role: 'standard', isImpersonating: true }]) {
        assert.equal((await fixture({ bucket, user }).request('/api/my-maps/3/note-images/hard/11')).status, 403);
    }
    const app = fixture({ bucket });
    for (const path of ['/api/my-maps/4/note-images/hard/11', '/api/my-maps/3/note-images/hard/12', '/api/my-maps/3/note-images/hard/11oops']) {
        assert.equal((await app.request(path)).status, 404);
    }
    const response = await app.request('/api/my-maps/3/note-images/hard/11');
    assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('image sharing never grants personal-place publication and cookie writes keep the existing CSRF guard', async () => {
    const { bucket, first } = await setup(), app = fixture({ bucket });
    const body = { revision: 0, images: [{ assetId: first.assetId, isShared: true }] };
    assert.equal((await put(app, body, '/api/my-maps/3/note-images/personal_place/9')).status, 400);
    assert.equal((await put(app, body, undefined, { Cookie: `${SESSION_COOKIE_NAME}=fixture` })).status, 403);
    assert.equal((await put(app, { ...body, images: [{ assetId: first.assetId, isShared: false }] }, '/api/my-maps/3/note-images/personal_place/9')).status, 200);
});

test('shared download streams exact published bytes and rejects private, withdrawn, invisible or revoked references', async () => {
    const { bucket, first, second } = await setup();
    const shared = { assets: [{ resourceType: 'hard', resourceId: 11, notes: { images: [{ ...first, isShared: true }] } }], places: [] };
    const app = fixture({ bucket, shared });
    const response = await app.request(`/api/shared-maps/shared-token/note-images/${first.assetId}`);
    assert.equal(response.status, 200); assert.equal(response.headers.get('Content-Type'), 'image/png');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png());
    assert.equal((await app.request(`/api/shared-maps/shared-token/note-images/${second.assetId}`)).status, 404);
    for (const directory of [null, { assets: [], places: [] }, { assets: [{ notes: { images: [{ ...first, isShared: false }] } }], places: [] }]) {
        assert.equal((await fixture({ bucket, shared: directory }).request(`/api/shared-maps/shared-token/note-images/${first.assetId}`)).status, 404);
    }
});


test('three resources can each keep 20 distinct images in one map, with independent galleries in another map', async () => {
    const bucket = new MapMediaBucket(), media = createPrivateMapMediaRepository(bucket, 7), repo = createMapNoteImageRepository(bucket, 7);
    const images = [];
    for (let i = 0; i < 60; i++) images.push({ ...await media.saveAsset(png({ variant: i }), 'image/png'), isShared: false });
    for (let i = 0; i < 3; i++) await repo.replace(3, 'asset:' + (31 + i), { revision: i, images: images.slice(i * 20, i * 20 + 20) });
    const document = (await repo.read(3)).document;
    assert.deepEqual(document.entries.map(entry => entry.images.length), [20, 20, 20]);
    await assert.rejects(repo.replace(3, 'asset:31', { revision: 3, images: images.slice(0, 21) }));
    assert.equal((await repo.read(3)).document.revision, 3);
    await repo.replace(4, 'asset:41', { revision: 0, images: images.slice(20, 40) });
    assert.equal((await repo.read(4)).document.entries[0].images.length, 20);
    assert.deepEqual((await repo.read(3)).document, document);
    await repo.replace(3, 'asset:31', { revision: 3, images: images.slice(0, 19) });
    await repo.replace(3, 'asset:31', { revision: 4, images: [...images.slice(0, 19), images[20]] });
    assert.equal((await repo.read(3)).document.entries[0].images.length, 20, 'removing an image frees a slot in this resource gallery');
});

test('a map with many resources exceeds the former 100-gallery and 500-reference document caps', async () => {
    const { repo, first } = await setup();
    for (let i = 0; i < 110; i++) await repo.replace(3, 'asset:' + (i + 1), { revision: i, images: [{ ...first, isShared: false }] });
    const { bucket } = await setup();
    const media = createPrivateMapMediaRepository(bucket, 7), larger = createMapNoteImageRepository(bucket, 7), images = [];
    for (let i = 0; i < 20; i++) images.push({ ...await media.saveAsset(png({ variant: i }), 'image/png'), isShared: false });
    for (let i = 0; i < 30; i++) await larger.replace(3, 'asset:' + (i + 1), { revision: i, images });
    const { document } = await larger.read(3);
    assert.equal(document.entries.reduce((count, entry) => count + entry.images.length, 0), 600);
});

test('owner gallery responses include only that account storage usage', async () => {
    const { bucket, first, second } = await setup(), app = fixture({ bucket });
    const read = await (await app.request('/api/my-maps/3/note-images/hard/11')).json();
    assert.deepEqual(read.storage, { usedBytes: first.size + second.size, limitBytes: 1024 * 1024 * 1024 });
    const saved = await (await put(app, { revision: 0, images: [{ assetId: first.assetId, isShared: false }] })).json();
    assert.deepEqual(saved.storage, read.storage);
    assert.equal(saved.images.length, 1);
});
