import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createPrivateMapMediaRepository, MAP_MEDIA_MAX_BYTES, MAP_MEDIA_MAX_OWNER_BYTES, validateMapMediaImage } from '../src/utils/privateMapMedia.js';
import { createMapAnnotationMediaHandlers } from '../src/controllers/mapAnnotationMediaController.js';
import { cookieSessionCsrfGuard, requestBodyGuard } from '../src/middleware/security.js';
import { SESSION_COOKIE_NAME } from '../src/utils/sessionAuth.js';
import { MapMediaBucket, png, whereValues } from './helpers/mapAnnotationFixtures.js';

test('map images validate bytes, type, dimensions and pixel budget before consuming quota', async () => {
    const bucket = new MapMediaBucket(), repo = createPrivateMapMediaRepository(bucket, 7);
    const metadata = validateMapMediaImage(png(), 'image/png');
    assert.equal(metadata.width, 1); assert.equal(metadata.height, 1);
    for (const [bytes, mime] of [[new Uint8Array([1, 2]), 'image/png'], [png(), 'image/jpeg'],
        [png(), 'image/svg+xml'], [png({ width: 2049 }), 'image/png'],
        [png({ width: 2048, height: 2048 }), 'image/png'], [png({ size: MAP_MEDIA_MAX_BYTES + 1 }), 'image/png']]) {
        await assert.rejects(repo.saveAsset(bytes, mime), { status: 400, code: 'map_media_invalid' });
    }
    assert.equal(bucket.objects.size, 0);
    assert.throws(() => createPrivateMapMediaRepository(null, 7), { status: 503, code: 'map_media_unavailable' });
    assert.throws(() => createPrivateMapMediaRepository(bucket, -1), { status: 503 });
});

test('immutable images deduplicate within an owner and are unavailable to another owner', async () => {
    const bucket = new MapMediaBucket(), repo = createPrivateMapMediaRepository(bucket, 7);
    const first = await repo.saveAsset(png(), 'image/png');
    assert.deepEqual(await repo.saveAsset(png(), 'image/png'), first);
    assert.equal(bucket.objects.size, 2);
    assert.equal((await repo.getAsset(first.assetId)).metadata.size, png().length);
    await assert.rejects(createPrivateMapMediaRepository(bucket, 8).getAsset(first.assetId), { status: 404 });
    await assert.rejects(repo.getAsset('../media/private'), { status: 404 });
    assert.ok([...bucket.objects.keys()].every((key) => key.startsWith('care-map-media/v1/owners/7/')));
    const object = [...bucket.objects.values()].find((item) => item.httpMetadata.contentType === 'image/png');
    assert.equal(object.httpMetadata.cacheControl, 'private, no-store');
});

test('uploads exceed the former 20-image and 20 MB account caps, deduplicate, and report storage', async () => {
    const bucket = new MapMediaBucket(), repo = createPrivateMapMediaRepository(bucket, 7);
    assert.deepEqual(await repo.getUsage(), { usedBytes: 0, limitBytes: MAP_MEDIA_MAX_OWNER_BYTES });
    for (let i = 0; i < 24; i++) await repo.saveAsset(png({ variant: i, size: i < 11 ? MAP_MEDIA_MAX_BYTES : undefined }), 'image/png');
    const before = await repo.getUsage();
    assert.ok(before.usedBytes > 20 * 1024 * 1024);
    assert.equal(before.limitBytes, 1024 * 1024 * 1024);
    assert.equal((await (await bucket.get('care-map-media/v1/owners/7/quota.json')).json()).assets.length, 24);
    await repo.saveAsset(png({ variant: 23 }), 'image/png');
    assert.deepEqual(await repo.getUsage(), before, 'reusing the same stored bytes does not consume more storage');
    assert.equal((await createPrivateMapMediaRepository(bucket, 8).getUsage()).usedBytes, 0);
});

// Seed only valid reserved metadata to exercise a 1 GB boundary without allocating
// 1 GB of fixture image bytes. Reservations are also how interrupted uploads work.
async function nearlyFullBucket(remainingBytes) {
    const bucket = new MapMediaBucket();
    const assets = Array.from({ length: 512 }, (_, i) => ({ assetId: i.toString(16).padStart(64, '0'),
        mimeType: 'image/png', size: i === 511 ? MAP_MEDIA_MAX_BYTES - remainingBytes : MAP_MEDIA_MAX_BYTES, width: 1, height: 1 }));
    await bucket.put('care-map-media/v1/owners/7/quota.json', JSON.stringify({ version: 1, assets }));
    return bucket;
}

test('concurrent uploads cannot exceed the 1 GB owner storage allowance', async () => {
    const bucket = await nearlyFullBucket(png().length), repo = createPrivateMapMediaRepository(bucket, 7);
    const attempts = await Promise.allSettled([20, 21, 22].map(variant => repo.saveAsset(png({ variant }), 'image/png')));
    assert.equal(attempts.filter(({ status }) => status === 'fulfilled').length, 1);
    for (const attempt of attempts.filter(({ status }) => status === 'rejected')) assert.equal(attempt.reason.code, 'map_media_quota_exceeded');
    assert.deepEqual(await repo.getUsage(), { usedBytes: MAP_MEDIA_MAX_OWNER_BYTES, limitBytes: MAP_MEDIA_MAX_OWNER_BYTES });
    assert.equal([...bucket.objects.keys()].filter(key => key.includes('/assets/')).length, 1);
});

test('storage quota accepts the exact boundary, rejects the next upload, and resumes interrupted uploads', async () => {
    const bucket = await nearlyFullBucket(png().length), repo = createPrivateMapMediaRepository(bucket, 7);
    const accepted = await repo.saveAsset(png(), 'image/png');
    await assert.rejects(repo.saveAsset(png({ variant: 11 }), 'image/png'), { status: 413, code: 'map_media_quota_exceeded' });
    assert.deepEqual(await repo.saveAsset(png(), 'image/png'), accepted, 'a deduplicated retry works even at full storage');
    const interrupted = new MapMediaBucket(), retry = createPrivateMapMediaRepository(interrupted, 7);
    interrupted.beforePut = async key => { if (key.includes('/assets/')) throw new Error('network write outcome unknown'); };
    await assert.rejects(retry.saveAsset(png(), 'image/png'), /network write outcome unknown/);
    const ledger = await (await interrupted.get('care-map-media/v1/owners/7/quota.json')).json();
    assert.equal(ledger.assets.length, 1);
    interrupted.beforePut = null;
    await retry.saveAsset(png(), 'image/png');
    assert.equal(interrupted.objects.size, 2);
});

function routeFixture({ user = { id: 7, role: 'standard' }, bucket = new MapMediaBucket(), ownedMapId = 3 } = {}) {
    let ownerReads = 0;
    const db = { query: { myMaps: { findFirst: async ({ where }) => {
        ownerReads++; const [mapId, userId] = whereValues(where);
        return mapId === ownedMapId && userId === 7 ? { id: mapId } : null;
    } } } };
    const handlers = createMapAnnotationMediaHandlers({ dbForContext: () => db, bucketForContext: () => bucket });
    const app = new Hono(); app.use('*', requestBodyGuard); app.use('*', cookieSessionCsrfGuard);
    app.use('*', async (c, next) => { c.set('user', user); await next(); });
    app.post('/api/my-maps/:id/annotation-media', handlers.upload);
    app.get('/api/my-maps/:id/annotation-media/:assetId', handlers.read);
    return { app, bucket, ownerReads: () => ownerReads };
}
const upload = (app, bytes = png(), headers = {}, path = '/api/my-maps/3/annotation-media') => {
    const body = new FormData(); body.set('file', new Blob([bytes], { type: 'image/png' }), 'private.png');
    return app.request(path, { method: 'POST', headers, body }, { NODE_ENV: 'production' });
};

test('private HTTP upload and read check both map ownership and asset ownership and emit no-cache bytes', async () => {
    const { app, bucket } = routeFixture();
    const response = await upload(app);
    assert.equal(response.status, 201);
    const metadata = await response.json();
    const read = await app.request(`/api/my-maps/3/annotation-media/${metadata.assetId}`);
    assert.equal(read.status, 200);
    assert.equal(read.headers.get('Content-Type'), 'image/png');
    assert.equal(read.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(read.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(read.headers.get('Vary'), 'Cookie, Authorization, X-Session-Token');
    assert.deepEqual(new Uint8Array(await read.arrayBuffer()), png());
    // A same-owner duplicate can reuse the immutable owner image reference.
    const duplicate = routeFixture({ bucket, ownedMapId: 4 });
    assert.equal((await duplicate.app.request(`/api/my-maps/4/annotation-media/${metadata.assetId}`)).status, 200);
    assert.equal((await app.request(`/api/my-maps/4/annotation-media/${metadata.assetId}`)).status, 404);
    assert.equal((await upload(app, png(), {}, '/api/my-maps/3oops/annotation-media')).status, 400);
    assert.equal((await upload(app, png({ size: MAP_MEDIA_MAX_BYTES + 1 }))).status, 413);
});

test('guest, User View, foreign map, unavailable storage, and cookie CSRF cannot upload private images', async () => {
    for (const user of [null, { id: 7, role: 'guest' }, { id: 7, role: 'standard', isImpersonating: true }, { id: 8, role: 'standard' }]) {
        const fixture = routeFixture({ user });
        const result = await upload(fixture.app);
        assert.ok([403, 404].includes(result.status));
        assert.equal(fixture.bucket.objects.size, 0);
        if (user?.id !== 8) assert.equal(fixture.ownerReads(), 0);
    }
    const unavailable = routeFixture({ bucket: null });
    assert.equal((await upload(unavailable.app)).status, 503);
    const fixture = routeFixture();
    const blocked = await upload(fixture.app, png(), { Cookie: `${SESSION_COOKIE_NAME}=fixture-session`, Origin: 'https://evil.example' });
    assert.equal(blocked.status, 403);
    assert.equal(fixture.bucket.objects.size, 0);
    const allowed = await upload(fixture.app, png(), { Cookie: `${SESSION_COOKIE_NAME}=fixture-session`, Origin: 'https://app.carearound.sg' });
    assert.equal(allowed.status, 201);
});
