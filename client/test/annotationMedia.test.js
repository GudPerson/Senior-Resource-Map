import test from 'node:test';
import assert from 'node:assert/strict';
import { ANNOTATION_IMAGE_MAX_BYTES, assertAnnotationImageElementsReady, decodeAnnotationImage,
    getAnnotationImageCaptureOptions, getAnnotationImageRequestDescriptors, getPrivateAnnotationImageReadiness, loadAnnotationImage, normalizeAnnotationImageFile,
    uploadAnnotationImage } from '../src/lib/annotationMedia.js';

const image = { assetId: 'a'.repeat(64), width: 1000, height: 500, alt: '' };
const response = (body = new Blob(['private'], { type: 'image/png' }), type = 'image/png') => ({ ok: true,
    headers: new Headers({ 'Content-Type': type }), blob: async () => body });
const sourceOptions = (overrides = {}) => ({ mapId: 7, image, base: '/api', authHeaders: {},
    fetchImpl: async () => response(), createObjectURL: () => 'blob:private-image', revokeObjectURL: () => {},
    decode: async () => ({ width: image.width, height: image.height }), ...overrides });

test('owner image loading uses the map endpoint with cookies and no browser cache or public URL', async () => {
    let requested;
    const source = await loadAnnotationImage(sourceOptions({ fetchImpl: async (url, options) => { requested = { url, options }; return response(); } }));
    assert.equal(requested.url, `/api/my-maps/7/annotation-media/${image.assetId}`);
    assert.equal(requested.options.credentials, 'include');
    assert.equal(requested.options.cache, 'no-store');
    assert.equal(requested.options.method, 'GET');
    assert.deepEqual(source, { url: 'blob:private-image', status: 'ready', width: 1000, height: 500 });
});

test('failed decoding, mismatched dimensions and a stale request revoke the private object URL', async () => {
    for (const decode of [async () => { throw new Error('bad bytes'); }, async () => ({ width: 50, height: 25 })]) {
        const revoked = [];
        await assert.rejects(loadAnnotationImage(sourceOptions({ decode, revokeObjectURL: url => revoked.push(url) })));
        assert.deepEqual(revoked, ['blob:private-image']);
    }
    const controller = new AbortController(); const revoked = [];
    await assert.rejects(loadAnnotationImage(sourceOptions({ signal: controller.signal,
        decode: async () => { controller.abort(); return { width: 1000, height: 500 }; },
        revokeObjectURL: url => revoked.push(url) })), { name: 'AbortError' });
    assert.deepEqual(revoked, ['blob:private-image']);
    let requests = 0;
    await assert.rejects(loadAnnotationImage(sourceOptions({ signal: controller.signal, fetchImpl: async () => { requests += 1; } })), { name: 'AbortError' });
    assert.equal(requests, 0);
});

test('owner image bytes fail closed before creating URLs for foreign media, excessive size and HTTP errors', async () => {
    for (const remote of [response(new Blob(['svg']), 'image/svg+xml'), response(new Blob([new Uint8Array(ANNOTATION_IMAGE_MAX_BYTES + 1)])), { ...response(), ok: false }]) {
        let urls = 0;
        await assert.rejects(loadAnnotationImage(sourceOptions({ fetchImpl: async () => remote, createObjectURL: () => { urls += 1; return 'blob:unexpected'; } })));
        assert.equal(urls, 0);
    }
});

test('image decoder handles load failure, cancellation and a bounded timeout', async () => {
    class FailedImage { set src(value) { if (value) queueMicrotask(() => this.onerror?.()); } }
    await assert.rejects(decodeAnnotationImage('blob:failed', { ImageImpl: FailedImage }));
    class SlowImage { set src(value) { this.value = value; } }
    await assert.rejects(decodeAnnotationImage('blob:slow', { ImageImpl: SlowImage, timeoutMs: 5 }));
    const controller = new AbortController();
    const pending = decodeAnnotationImage('blob:cancel', { ImageImpl: SlowImage, signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
});

function normalizationFixture({ width = 4096, height = 3000, encodedSize = () => 1024 } = {}) {
    const calls = []; let closed = 0;
    const bitmap = { width, height, close: () => { closed += 1; } };
    const canvas = { getContext: () => ({ drawImage: (...args) => calls.push({ draw: args }) }),
        toBlob: (done, mime, quality) => { calls.push({ mime, quality }); done(new Blob([new Uint8Array(encodedSize(mime, quality))], { type: mime })); } };
    return { calls, canvas, closed: () => closed, options: { decodeBitmap: async () => bitmap, createCanvas: () => canvas } };
}

test('ordinary native photos are re-encoded and downscaled before upload with their bitmap always closed', async () => {
    const fixture = normalizationFixture();
    const normalized = await normalizeAnnotationImageFile(new Blob(['native-exif'], { type: 'image/jpeg' }), fixture.options);
    assert.equal(normalized.width, 2048); assert.equal(normalized.height, 1500);
    assert.equal(fixture.canvas.width, 2048); assert.equal(fixture.canvas.height, 1500);
    assert.equal(normalized.blob.type, 'image/jpeg');
    assert.equal(await normalized.blob.text(), '\0'.repeat(1024));
    assert.equal(fixture.closed(), 1);
    const square = normalizationFixture({ width: 4000, height: 4000 });
    const result = await normalizeAnnotationImageFile(new Blob(['photo'], { type: 'image/png' }), square.options);
    assert.ok(result.width * result.height <= 4_000_000);
});

test('transparent files use PNG and then a bounded WebP fallback when needed', async () => {
    const fixture = normalizationFixture({ encodedSize: mime => mime === 'image/png' ? ANNOTATION_IMAGE_MAX_BYTES + 1 : 1024 });
    const result = await normalizeAnnotationImageFile(new Blob(['alpha'], { type: 'image/png' }), fixture.options);
    assert.equal(result.blob.type, 'image/webp');
    assert.deepEqual(fixture.calls.filter(call => call.mime).map(call => call.mime), ['image/png', 'image/webp']);
    assert.equal(fixture.closed(), 1);
    const oversize = normalizationFixture({ encodedSize: () => ANNOTATION_IMAGE_MAX_BYTES + 1 });
    await assert.rejects(normalizeAnnotationImageFile(new Blob(['alpha'], { type: 'image/webp' }), oversize.options));
    assert.equal(oversize.closed(), 1);
    assert.equal(oversize.calls.filter(call => call.mime === 'image/webp').length, 3);
});

test('unsafe input, unsupported decoding and canceled normalization do not continue into upload', async () => {
    await assert.rejects(normalizeAnnotationImageFile(new Blob(['svg'], { type: 'image/svg+xml' })));
    const invalid = normalizationFixture({ width: 8193 });
    await assert.rejects(normalizeAnnotationImageFile(new Blob(['photo'], { type: 'image/png' }), invalid.options));
    assert.equal(invalid.closed(), 1);
    const controller = new AbortController(); const canceled = normalizationFixture();
    const normalizing = normalizeAnnotationImageFile(new Blob(['photo'], { type: 'image/png' }), { ...canceled.options,
        decodeBitmap: async () => { controller.abort(); return { width: 1, height: 1, close: () => canceled.options.decodeBitmap().then(bitmap => bitmap.close()) }; }, signal: controller.signal });
    await assert.rejects(normalizing, { name: 'AbortError' });
    await Promise.resolve(); assert.equal(canceled.closed(), 1);
    let uploads = 0;
    await assert.rejects(uploadAnnotationImage({ mapId: 7, file: null, signal: controller.signal, upload: async () => { uploads += 1; } }), { name: 'AbortError' });
    assert.equal(uploads, 0);
});

test('uploads use a normalized file name and validate exact returned image metadata', async () => {
    let request;
    const normalize = async () => ({ blob: new Blob(['normalized'], { type: 'image/png' }), width: 1000, height: 500 });
    const result = await uploadAnnotationImage({ mapId: 7, file: new Blob(['original'], { type: 'image/jpeg' }), normalize,
        upload: async (path, form, options) => { request = { path, form, options }; return { ...image, mimeType: 'image/png', size: 10 }; } });
    assert.equal(request.path, '/my-maps/7/annotation-media');
    assert.equal(request.form.get('file').name, 'care-map-image.png');
    assert.equal(await request.form.get('file').text(), 'normalized');
    assert.equal(typeof request.options.fetchImpl, 'function');
    assert.equal(result.assetId, image.assetId);
    await assert.rejects(uploadAnnotationImage({ mapId: 7, normalize, upload: async () => ({ ...image, width: 999 }) }));
});

test('export readiness allows old annotation-only maps and requires every visible new image', async () => {
    const annotations = [{ type: 'image', image }];
    assert.deepEqual(getPrivateAnnotationImageReadiness([{ type: 'pin' }]), { status: 'ready', count: 0, error: '' });
    assert.equal(getPrivateAnnotationImageReadiness(annotations).status, 'loading');
    assert.equal(getPrivateAnnotationImageReadiness(annotations, { [image.assetId]: { status: 'ready', url: 'https://public.example/image.png' } }).status, 'loading');
    assert.equal(getPrivateAnnotationImageReadiness(annotations, { [image.assetId]: { status: 'error' } }).status, 'error');
    let decoded = 0;
    const element = { complete: true, naturalWidth: 1000, currentSrc: 'blob:private-image', decode: async () => { decoded += 1; } };
    const node = elements => ({ querySelectorAll: () => elements });
    await assertAnnotationImageElementsReady(node([element]), 1); assert.equal(decoded, 1);
    await assertAnnotationImageElementsReady(node([]), 0);
    await assert.rejects(assertAnnotationImageElementsReady(node([]), 1));
    await assert.rejects(assertAnnotationImageElementsReady(node([{ ...element, naturalWidth: 0 }]), 1));
    await assert.rejects(assertAnnotationImageElementsReady(node([{ ...element, currentSrc: 'data:image/png;base64,placeholder' }]), 1));
    await assert.rejects(assertAnnotationImageElementsReady(node([{ ...element, decode: async () => { throw new Error('decode failed'); } }]), 1));
});

test('capture preserves private object URLs without a transparent fallback while old map and resource options stay unchanged', () => {
    const privateOptions = getAnnotationImageCaptureOptions(1, 'data:image/png;base64,legacy-placeholder');
    assert.equal(privateOptions.cacheBust, false);
    assert.equal(Object.hasOwn(privateOptions, 'imagePlaceholder'), false);
    assert.deepEqual(getAnnotationImageCaptureOptions(0, 'legacy-placeholder'), { cacheBust: true, imagePlaceholder: 'legacy-placeholder' });
    assert.deepEqual(getAnnotationImageCaptureOptions(0, 'legacy-placeholder', false), { cacheBust: false, imagePlaceholder: 'legacy-placeholder' });
});

test('caption, resource tagging and layer ordering reuse immutable image request identities while dimensions remain checked', () => {
    const first = { type: 'image', image }; const second = { type: 'image', image: { ...image, assetId: 'b'.repeat(64) } };
    const original = getAnnotationImageRequestDescriptors([first, second]);
    const edited = getAnnotationImageRequestDescriptors([second, { ...first, image: { ...image, alt: 'New caption' },
        resourceLinks: [{ type: 'hard', id: 1 }], resourceBehaviour: 'pulse' }, first]);
    assert.deepEqual(edited, original);
    assert.equal(original.length, 2);
    assert.equal(Object.hasOwn(original[0], 'alt'), false);
    assert.notDeepEqual(getAnnotationImageRequestDescriptors([{ ...first, image: { ...image, width: 999 } }]), getAnnotationImageRequestDescriptors([first]));
});
