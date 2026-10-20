import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMapNoteImagesToDirectory, getMapNoteImageRef, loadMapNoteImage, mapNoteImageFilename, normalizeMapNoteImages } from '../src/lib/mapNoteImages.js';
import { hasAnyOwnerNote, getMapNoteResourceSummary, buildMapNoteSummaryParts } from '../src/lib/mapNotes.js';
import { getMapNoteImageMessages } from '../src/lib/mapNoteImageMessages.js';
import { hasSharedMapUpdates } from '../src/lib/shareMapStatus.js';

const image = { assetId: 'a'.repeat(64), width: 100, height: 60, mimeType: 'image/png', size: 123, isShared: false };
test('image attachment updates preserve private text, note identities and unrelated resource rows', () => {
    const row = { resourceType: 'hard', resourceId: 11, notes: { items: [{ id: 34, text: 'typed note', isShared: false }] } };
    const untouched = { resourceType: 'soft', resourceId: 11, notes: { items: [{ text: 'other row' }] } };
    const directory = { assets: [row, untouched], places: [{ rows: [row, untouched] }] };
    const updated = applyMapNoteImagesToDirectory(directory, row, [image]);
    assert.deepEqual(updated.assets[0].notes.items, row.notes.items);
    assert.deepEqual(updated.assets[0].notes.images, [image]);
    assert.equal(updated.assets[1], untouched);
    assert.deepEqual(updated.places[0].rows[0].notes.images, [image]);
    assert.equal(row.notes.images, undefined);
    assert.equal(getMapNoteImageRef({ resourceType: 'personal_place', resourceId: 9 }).resourceId, 9);
    assert.equal(getMapNoteImageRef({ resourceType: 'hard', resourceId: '11oops' }), null);
});
test('image-only notes remain discoverable and their summary distinguishes images from text notes', () => {
    const row = { notes: { images: [image], items: [] } };
    assert.equal(hasAnyOwnerNote(row), true);
    const summary = getMapNoteResourceSummary([row]);
    assert.equal(summary.noteCount, 0); assert.equal(summary.imageCount, 1); assert.equal(summary.notedResourceCount, 1);
    assert.deepEqual(buildMapNoteSummaryParts(summary, { mode: 'shared' }).at(-1), { key: 'images', count: 1 });
});
test('published image loader uses only the shared image route, with bounded authenticated no-cache reading', async () => {
    let request;
    const loaded = await loadMapNoteImage({ mapId: 3, shareToken: 'selected-token', image: { ...image, isShared: true }, base: '/api', authHeaders: {},
        fetchImpl: async (url, options) => { request = { url, options }; return new Response(new Uint8Array(123), { headers: { 'Content-Type': 'image/png' } }); },
        createObjectURL: () => 'blob:fixture', revokeObjectURL: () => {}, decode: async () => ({ width: 100, height: 60 }) });
    assert.equal(loaded.status, 'ready');
    assert.equal(request.url, `/api/shared-maps/selected-token/note-images/${image.assetId}`);
    assert.equal(request.options.credentials, 'include'); assert.equal(request.options.cache, 'no-store');
});
test('private image metadata rejects URLs, foreign formats, duplicated ids and unbounded dimensions', () => {
    for (const values of [[{ ...image, assetId: 'https://untrusted.test/photo.png' }], [{ ...image, mimeType: 'image/svg+xml' }],
        [{ ...image, width: 100000 }], [image, image], [{ ...image, isShared: 'true' }]]) assert.deepEqual(normalizeMapNoteImages(values), []);
    assert.equal(mapNoteImageFilename('../../unsafe <name>', 0, 'image/png'), 'unsafe-name-image-1.png');
});
test('image edits mark a frozen share as having updates without changing map/text timestamps', () => {
    const map = { updatedAt: '2026-10-12T12:00:00Z', share: { isShared: true, shareUpdatedAt: '2026-10-12T12:00:00Z' },
        noteImagesUpdatedAt: '2026-10-13T12:00:00Z' };
    assert.equal(hasSharedMapUpdates(map), true);
    assert.equal(hasSharedMapUpdates({ ...map, share: { ...map.share, shareUpdatedAt: '2026-10-13T12:00:00Z' } }), false);
});
test('all four locales expose complete translated image and mobile-control instructions', () => {
    const keys = Object.keys(getMapNoteImageMessages('en')).sort();
    for (const locale of ['en', 'zh-CN', 'ms', 'ta']) {
        const m = getMapNoteImageMessages(locale); assert.deepEqual(Object.keys(m).sort(), keys);
        assert.ok(Object.values(m).every(text => typeof text === 'string' && text.length > 0));
        assert.ok(m.review.includes('{count}'));
        assert.ok(m.help.includes('20') && m.help.includes('1 GB'));
        assert.ok(m.galleryUsage.includes('{count}') && m.galleryUsage.includes('{limit}'));
        assert.ok(m.storageUsage.includes('{used}') && m.storageUsage.includes('{limit}'));
    }
});
