import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createPrivateMapMediaRepository, MAP_MEDIA_MAX_BYTES, validateMapMediaImage } from '../src/utils/privateMapMedia.js';
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

test('concurrent uploads cannot exceed the owner count quota', async () => {
    const bucket = new MapMediaBucket(), repo = createPrivateMapMediaRepository(bucket, 7);
    for (let i = 0; i < 19; i++) await repo.saveAsset(png({ variant: i }), 'image/png');
    const attempts = await Promise.allSettled([20, 21, 22].map((variant) => repo.saveAsset(png({ variant }), 'image/png')));
    assert.equal(attempts.filter(({ status }) => status === 'fulfilled').length, 1);
    for (const attempt of attempts.filter(({ status }) => status === 'rejected')) assert.equal(attempt.reason.code, 'map_media_quota_exceeded');
    assert.equal([...bucket.objects.keys()].filter((key) => key.includes('/assets/')).length, 20);
    const ledger = await (await bucket.get('care-map-media/v1/owners/7/quota.json')).json();
    assert.equal(ledger.assets.length, 20);
});

test('byte quota is independent of image count, and an interrupted upload can safely resume', async () => {
    const bucket = new MapMediaBucket(), repo = createPrivateMapMediaRepository(bucket, 7);
    for (let i = 0; i < 10; i++) await repo.saveAsset(png({ variant: i, size: MAP_MEDIA_MAX_BYTES }), 'image/png');
    await assert.rejects(repo.saveAsset(png({ variant: 11 }), 'image/png'), { status: 413, code: 'map_media_quota_exceeded' });
    const interrupted = new MapMediaBucket(), retry = createPrivateMapMediaRepository(interrupted, 7);
    interrupted.beforePut = async (key) => { if (key.includes('/assets/')) throw new Error('network write outcome unknown'); };
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
