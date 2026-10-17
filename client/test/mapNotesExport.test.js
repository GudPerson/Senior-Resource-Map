import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { createMyMapPdfDownload } from '../src/lib/myMapPdfGenerator.js';
import { buildMyMapPdfLedger } from '../src/lib/myMapPdfLedger.js';
import { buildMapNotesExportResources, buildMapNotesImageIndex, readMapNotesExportImage } from '../src/lib/mapNotesExport.js';
import { loadMapNoteImage } from '../src/lib/mapNoteImages.js';

const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64'));
const image = { assetId: 'a'.repeat(64), mimeType: 'image/png', width: 1, height: 1, size: png.length, isShared: false };
const row = (id, overrides = {}) => ({ assetKey: `hard-${id}`, resourceId: id, resourceType: 'hard',
    name: 'Same name', address: `Address ${id}`, subCategory: 'Community', notes: { items: [{ text: `Note for resource ${id}`, isShared: false }] }, ...overrides });
const options = rows => ({ directory: { id: 7, name: 'Fictional map' }, presentation: { mappedGroups: [{ rows }] },
    generatedAt: new Date('2026-10-17T05:00:00Z'), locale: 'en-SG' });

test('PNG, JPEG and WebP attachments render in one PDF and retain their original bytes and formats', async () => {
    const samples = JSON.parse(readFileSync(new URL('../../tests/fixtures/map-notes-export/images.json', import.meta.url)));
    const raw = samples.map(sample => Uint8Array.from(Buffer.from(sample.base64, 'base64')));
    const images = samples.map((sample, index) => ({ assetId: String(index + 1).repeat(64), width: sample.width,
        height: sample.height, mimeType: sample.mimeType, size: raw[index].length, isShared: false }));
    const result = await createMyMapPdfDownload({ ...options([row(1, { notes: { items: [{ text: 'All three formats' }], images } })]),
        readImage: async ({ image }) => raw[images.findIndex(item => item.assetId === image.assetId)] });
    const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    const manifest = JSON.parse(strFromU8(files['notes-and-images.json']));
    manifest.resources[0].images.forEach((image, index) => assert.deepEqual(files[image.filename], raw[index]));
    const pdf = strFromU8(files['fictional-map-ledger.pdf']);
    assert.match(pdf, /\/Count 4\b/);
});

test('complete download contains embedded PDF images, byte-exact originals and resource-matched notes', async () => {
    const first = row(1, { notes: { items: [{ text: 'First private note' }, { text: 'Second note' }], images: [image] } });
    const second = row(2, { notes: { items: [], images: [image] } });
    const config = options([first, second, first]);
    let loads = 0;
    const result = await createMyMapPdfDownload({ ...config, readImage: async ({ mapId }) => { assert.equal(mapId, 7); loads++; return png; } });
    assert.equal(result.filename, 'fictional-map-notes-and-images.zip');
    assert.equal(result.blob.type, 'application/zip');
    const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    const manifest = JSON.parse(strFromU8(files['notes-and-images.json']));
    assert.equal(manifest.imageAssociation, 'resource-notes');
    assert.equal(manifest.resources.length, 2);
    assert.deepEqual(manifest.resources[0].notes.map(note => note.reference), ['R001-N1', 'R001-N2']);
    assert.equal(manifest.resources[1].notes.length, 0);
    assert.equal(loads, 1, 'repeated bytes are fetched once without merging resource associations');
    const paths = manifest.resources.flatMap(resource => resource.images.map(item => item.filename));
    assert.equal(new Set(paths).size, 2, 'same names cannot collide');
    paths.forEach(filename => assert.deepEqual(files[filename], png));
    const pdf = strFromU8(files['fictional-map-ledger.pdf']);
    assert.ok(pdf.startsWith('%PDF-'));
    assert.match(pdf, /\/Subtype \/Image/);
    for (const reference of ['R001-N1', 'R001-N2', 'R001-I1', 'R002-I1']) assert.ok(pdf.includes(reference), reference);
    const html = strFromU8(files['index.html']);
    assert.match(html, /First private note/);
    assert.match(html, /No text notes/);
    paths.forEach(filename => assert.ok(html.includes(filename)));
    assert.equal(first.notes.items[0].reference, undefined, 'export does not mutate saved notes');
});

test('text-only maps keep the existing PDF filename, data and no image fetches', async () => {
    const result = await createMyMapPdfDownload({ ...options([row(1)]), readImage: () => { throw new Error('unexpected image read'); } });
    assert.equal(result.filename, 'fictional-map-ledger.pdf');
    assert.equal(result.blob.type, 'application/pdf');
    const text = await result.blob.text();
    assert.ok(text.includes('Note for resource 1'));
    assert.ok(!text.includes('R001-N1'));
    assert.doesNotMatch(text, /\/Subtype \/Image/);
});

test('repeated attachments exceeding the export memory bound fail before downloading any bytes', async () => {
    const rows = Array.from({ length: 33 }, (_, index) => row(index + 1, { notes: { items: [], images: [{ ...image, size: 2 * 1024 * 1024 }] } }));
    await assert.rejects(createMyMapPdfDownload({ ...options(rows), readImage: () => { throw new Error('unexpected image read'); } }),
        { code: 'map_notes_export_too_large' });
});

test('invalid, missing or revoked image reads reject the whole export, allowing a fresh retry', async () => {
    const config = options([row(1, { notes: { items: [], images: [image] } })]);
    await assert.rejects(createMyMapPdfDownload({ ...config, readImage: async () => { throw new Error('denied'); } }), /denied/);
    const retried = await createMyMapPdfDownload({ ...config, readImage: async () => png });
    assert.equal(retried.blob.type, 'application/zip');
    assert.throws(() => buildMyMapPdfLedger(options([row(1, { notes: { images: [{ ...image, assetId: 'invalid' }] } })])), /Invalid note image/);
});

test('filenames stay relative, duplicate resources deduplicate, and saved text cannot become active HTML', () => {
    const evil = row(1, { name: '../../ <script>bad()</script>', address: '<img src=x onerror=bad()>',
        notes: { items: [{ text: '</p><script>bad()</script>' }], images: [image] } });
    const ledger = buildMyMapPdfLedger(options([evil, evil]));
    const resources = buildMapNotesExportResources(ledger);
    assert.equal(resources.length, 1);
    assert.ok(!resources[0].images[0].filename.includes('..'));
    const html = buildMapNotesImageIndex(ledger, resources);
    assert.doesNotMatch(html, /<script>|<img src=x/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /Individual text-note links have not been recorded/);
});

test('image exporter uses the gallery auth route, no-cache headers and releases its decoded URL', async () => {
    const requests = [], revoked = [];
    const bytes = await readMapNotesExportImage({ mapId: 7, image,
        createObjectURL: () => 'blob:fixture', revokeObjectURL: url => revoked.push(url),
        loadImage: args => loadMapNoteImage({ ...args, base: '/api', authHeaders: { 'X-Session-Token': 'fictional' },
            fetchImpl: async (url, init) => { requests.push({ url, init }); return new Response(png, { headers: { 'Content-Type': 'image/png' } }); },
            decode: async () => ({ width: 1, height: 1 }) }) });
    assert.deepEqual(bytes, png);
    assert.equal(requests[0].url, `/api/my-maps/7/annotation-media/${image.assetId}`);
    assert.equal(requests[0].init.credentials, 'include');
    assert.equal(requests[0].init.cache, 'no-store');
    assert.deepEqual(requests[0].init.headers, { 'X-Session-Token': 'fictional' });
    assert.deepEqual(revoked, ['blob:fixture']);
});

test('cancellation, image decoding errors and timeouts release URLs and never yield a partial package', async () => {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(createMyMapPdfDownload({ ...options([row(1)]), signal: controller.signal }), { name: 'AbortError' });
    const revoked = [];
    await assert.rejects(readMapNotesExportImage({ mapId: 7, image, createObjectURL: () => 'blob:failed', revokeObjectURL: url => revoked.push(url),
        loadImage: args => loadMapNoteImage({ ...args, base: '/api', authHeaders: {}, fetchImpl: async () => new Response(png, { headers: { 'Content-Type': 'image/png' } }),
            decode: async () => { throw new Error('decode failed'); } }) }), /decode failed/);
    assert.deepEqual(revoked, ['blob:failed']);
    await assert.rejects(readMapNotesExportImage({ mapId: 7, image, timeoutMs: 5,
        loadImage: ({ signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })) }), { name: 'AbortError' });
});
