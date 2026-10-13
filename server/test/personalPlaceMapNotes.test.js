import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createPersonalPlaceMapNotesRepository, attachPersonalPlaceMapNotes } from '../src/utils/personalPlaceMapNotes.js';
import { createPersonalPlaceMapNotesHandlers } from '../src/controllers/personalPlaceMapNotesController.js';
import { requestBodyGuard, cookieSessionCsrfGuard } from '../src/middleware/security.js';
import { SESSION_COOKIE_NAME } from '../src/utils/sessionAuth.js';
import { MapMediaBucket, whereValues } from './helpers/mapAnnotationFixtures.js';

const body = (text, revision = 0) => ({ revision, notes: [{ text, isShared: false }] });
const fixture = () => { const bucket = new MapMediaBucket(); return { bucket, repo: createPersonalPlaceMapNotesRepository(bucket, 7) }; };
test('personal-place notes persist independently of resource notes, images, account, map and membership', async () => {
    const { bucket, repo } = fixture();
    const saved = await repo.replace(3, 71, body('Private **text**'));
    assert.equal(saved.revision, 1); assert.equal(saved.items[0].text, 'Private **text**'); assert.equal(saved.items[0].isShared, false);
    const directory = { assets: [{ resourceType: 'hard', resourceId: 9, notes: { items: [{ text: 'Resource text' }] } }],
        personalPlaces: [{ resourceType: 'personal_place', resourceId: 5 }], places: [{ rows: [
            { resourceType: 'personal_place', resourceId: 5, notes: { images: [{ assetId: 'immutable-photo' }] } },
        ] }] };
    const map = { personalPlaceLinks: [{ id: 71, personalPlaceId: 5 }] };
    const loaded = attachPersonalPlaceMapNotes(directory, map, (await repo.read(3)).document);
    assert.equal(loaded.personalPlaces[0].notes.items[0].text, 'Private **text**');
    assert.equal(loaded.places[0].rows[0].notes.items[0].text, 'Private **text**');
    assert.equal(loaded.places[0].rows[0].notes.images[0].assetId, 'immutable-photo');
    assert.equal(loaded.assets[0].notes.items[0].text, 'Resource text');
    assert.equal(attachPersonalPlaceMapNotes(directory, { personalPlaceLinks: [{ id: 72, personalPlaceId: 5 }] },
        (await repo.read(3)).document).places[0].rows[0].notes.items.length, 0);
    assert.equal((await repo.read(4)).document.entries.length, 0);
    assert.equal((await createPersonalPlaceMapNotesRepository(bucket, 8).read(3)).document.entries.length, 0);
});
test('multiple notes, clearing, uncertain retries and stale edits preserve exact text', async () => {
    const { repo } = fixture();
    const one = body('First note\nsecond line'); await repo.replace(3, 71, one);
    assert.equal((await repo.replace(3, 71, one)).revision, 1);
    await assert.rejects(repo.replace(3, 71, body('Stale overwrite')), { status: 409 });
    const two = await repo.replace(3, 71, { revision: 1, notes: [{ text: 'First note\nsecond line' }, { text: '第二条备注' }] });
    assert.deepEqual(two.items.map(note => note.text), ['First note\nsecond line', '第二条备注']);
    const cleared = await repo.replace(3, 71, { revision: 2, notes: [] }); assert.equal(cleared.revision, 3); assert.deepEqual(cleared.items, []);
    await assert.rejects(repo.replace(3, 71, body('Old note', 2)), { status: 409 });
});
test('concurrent saves to different memberships merge; conflicting saves to the same membership fail', async () => {
    const { repo, bucket } = fixture();
    await Promise.all([repo.replace(3, 71, body('One')), repo.replace(3, 72, body('Two'))]);
    assert.equal((await repo.read(3)).document.entries.length, 2);
    let raced = false;
    bucket.beforePut = async () => {
        if (raced) return; raced = true;
        await repo.replace(3, 71, body('Other session', 1));
    };
    await assert.rejects(repo.replace(3, 71, body('My overwrite', 1)), { status: 409 });
    assert.equal((await repo.read(3)).document.entries.find(entry => entry.membershipId === 71).items[0].text, 'Other session');
});
test('private map duplication remaps memberships without changing source notes', async () => {
    const { repo } = fixture(); await repo.replace(3, 71, body('Copy privately')); await repo.replace(3, 72, body('Detached place'));
    await repo.copy((await repo.read(3)).document, 4, new Map([[71, 81]]));
    const copied = (await repo.read(4)).document.entries;
    assert.equal(copied.length, 1); assert.equal(copied[0].membershipId, 81); assert.equal(copied[0].items[0].isShared, false);
    await repo.replace(4, 81, body('Changed copy', 1));
    assert.equal((await repo.read(3)).document.entries[0].items[0].text, 'Copy privately');
});
test('invalid notes, sharing attempts and unavailable/corrupt storage never overwrite prior text', async () => {
    const { repo, bucket } = fixture(); await repo.replace(3, 71, body('Keep this'));
    for (const invalid of [{ revision: 1, notes: [{ text: 'Public', isShared: true }] },
        { revision: 1, notes: [{ text: 'x'.repeat(3001) }] }, { revision: 1, notes: Array(21).fill({ text: 'Too many' }) },
        { revision: -1, notes: [] }, { revision: 1, notes: 'bad' }]) await assert.rejects(repo.replace(3, 71, invalid), { status: 400 });
    assert.equal((await repo.read(3)).document.entries[0].items[0].text, 'Keep this');
    bucket.get = async () => { throw new Error('Storage down'); };
    await assert.rejects(repo.replace(3, 71, body('Overwrite', 1)));
    const unavailable = attachPersonalPlaceMapNotes({ places: [{ rows: [{ resourceType: 'personal_place', resourceId: 5 }] }] },
        { personalPlaceLinks: [{ id: 71, personalPlaceId: 5 }] }, null, { unavailable: true });
    assert.equal(unavailable.places[0].rows[0].notes.unavailable, true);
});
function appFixture({ user = { id: 7, role: 'standard' }, bucket = new MapMediaBucket() } = {}) {
    const db = { query: {
        myMaps: { findFirst: async ({ where }) => JSON.stringify(whereValues(where)) === '[3,7]' ? { id: 3 } : null },
        userPersonalPlaces: { findFirst: async ({ where }) => JSON.stringify(whereValues(where)) === '[5,7]' ? { id: 5 } : null },
        myMapPersonalPlaceLinks: { findFirst: async ({ where }) => JSON.stringify(whereValues(where)) === '[3,5]' ? { id: 71 } : null },
    } };
    const app = new Hono(); app.use('*', requestBodyGuard); app.use('*', cookieSessionCsrfGuard);
    app.use('*', async (c, next) => { c.set('user', user); await next(); });
    app.patch('/api/my-maps/:id/personal-places/:placeId/notes', createPersonalPlaceMapNotesHandlers({ dbForContext: () => db, bucketForContext: () => bucket }).replace);
    return { app, bucket };
}
const save = (app, data = body('Saved'), url = '/api/my-maps/3/personal-places/5/notes', headers = {}) => app.request(url, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data),
}, { NODE_ENV: 'production' });
test('HTTP saves authorize map, personal-place ownership and current membership before writing', async () => {
    for (const user of [null, { id: 7, role: 'guest' }, { id: 7, role: 'standard', isImpersonating: true }, { id: 8, role: 'standard' }]) {
        const { app, bucket } = appFixture({ user });
        assert.ok([403, 404].includes((await save(app)).status)); assert.equal(bucket.objects.size, 0);
    }
    const { app, bucket } = appFixture();
    for (const url of ['/api/my-maps/4/personal-places/5/notes', '/api/my-maps/3/personal-places/6/notes', '/api/my-maps/3/personal-places/5oops/notes']) {
        assert.equal((await save(app, body('Forged'), url)).status, 404);
    }
    assert.equal(bucket.objects.size, 0);
    const response = await save(app); assert.equal(response.status, 200); assert.equal((await response.json()).notes.items[0].text, 'Saved');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store'); assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});
test('HTTP keeps cookie CSRF checks, validates bounded bodies, and returns conflict/unavailable without false success', async () => {
    const { app, bucket } = appFixture();
    assert.equal((await save(app, body('Saved'), undefined, { Cookie: `${SESSION_COOKIE_NAME}=fixture` })).status, 403);
    assert.equal((await save(app, { revision: 0, notes: [{ text: 'Public', isShared: true }] })).status, 400);
    assert.equal((await app.request('/api/my-maps/3/personal-places/5/notes', { method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status, 400);
    assert.equal((await save(app, body('x'.repeat(270000)))).status, 413);
    assert.equal((await save(app)).status, 200);
    assert.equal((await save(app, body('Conflict'))).status, 409);
    bucket.get = async () => { throw new Error('Storage down'); };
    assert.equal((await save(app, body('No false success', 1))).status, 503);
});
