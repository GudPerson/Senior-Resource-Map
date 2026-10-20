import { getSessionApiBaseCandidates } from './apiBase.js';
import { getSessionAuthHeaders } from './sessionAuth.js';
import { requestFormDataWithBaseCandidates } from './api.js';
import { normalizePrintAnnotationImage } from './printAnnotations.js';

export const ANNOTATION_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const MAP_PHOTO_UPLOAD_MAX_SIDE = 1600;
export const MAP_PHOTO_UPLOAD_MAX_BYTES = 500 * 1024;
const SMALL_PNG_BYTES = 350 * 1024;
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const fail = () => new Error('This image could not be loaded. Choose a PNG, JPEG or WebP image and try again.');
const abortError = () => new DOMException('Image loading was cancelled.', 'AbortError');
const validMapId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;

export async function decodeAnnotationImage(url, { signal, ImageImpl = globalThis.Image, timeoutMs = 8000 } = {}) {
    if (signal?.aborted) throw abortError();
    return new Promise((resolve, reject) => {
        const image = new ImageImpl();
        const finish = (error) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', aborted);
            image.onload = null; image.onerror = null;
            if (error) { image.src = ''; reject(error); }
            else resolve({ width: image.naturalWidth, height: image.naturalHeight });
        };
    const aborted = () => finish(abortError());
        const timer = setTimeout(() => finish(fail()), timeoutMs);
        signal?.addEventListener('abort', aborted, { once: true });
        image.onerror = () => finish(fail());
        image.onload = () => {
            if (!image.naturalWidth || !image.naturalHeight) { finish(fail()); return; }
            Promise.resolve(image.decode?.()).then(() => finish(), () => finish(fail()));
        };
        image.src = url;
    });
}

export async function loadAnnotationImage({ mapId, image, signal, fetchImpl = globalThis.fetch,
    base = getSessionApiBaseCandidates()[0], authHeaders = getSessionAuthHeaders(),
    createObjectURL = blob => URL.createObjectURL(blob), revokeObjectURL = url => URL.revokeObjectURL(url),
    decode = decodeAnnotationImage } = {}) {
    if (signal?.aborted) throw abortError();
    if (!validMapId(mapId) || !normalizePrintAnnotationImage(image)) throw fail();
    const response = await fetchImpl(`${base}/my-maps/${encodeURIComponent(mapId)}/annotation-media/${image.assetId}`, {
        method: 'GET', credentials: 'include', cache: 'no-store', signal, headers: authHeaders,
    });
    if (!response.ok || !IMAGE_MIMES.has((response.headers.get('Content-Type') || '').split(';')[0].trim())) throw fail();
    const blob = await response.blob();
    if (signal?.aborted) throw abortError();
    if (!blob.size || blob.size > ANNOTATION_IMAGE_MAX_BYTES) throw fail();
    const url = createObjectURL(blob);
    try {
        const dimensions = await decode(url, { signal });
        if (signal?.aborted) throw abortError();
        if (dimensions.width !== image.width || dimensions.height !== image.height) throw fail();
        return { url, status: 'ready', width: dimensions.width, height: dimensions.height };
    } catch (error) { revokeObjectURL(url); throw error; }
}

async function imageBitmap(file) {
    if (typeof globalThis.createImageBitmap === 'function') return globalThis.createImageBitmap(file);
    const url = URL.createObjectURL(file);
    try {
        const dimensions = await decodeAnnotationImage(url);
        const image = new Image(); image.src = url; await image.decode();
        return { ...dimensions, source: image, close: () => URL.revokeObjectURL(url) };
    } catch (error) { URL.revokeObjectURL(url); throw error; }
}

export async function normalizeAnnotationImageFile(file, {
    decodeBitmap = imageBitmap,
    createCanvas = () => document.createElement('canvas'),
    signal,
} = {}) {
    if (signal?.aborted) throw abortError();
    if (!file || !IMAGE_MIMES.has(file.type) || !file.size || file.size > 20 * 1024 * 1024) throw fail();
    let bitmap;
    try {
        bitmap = await decodeBitmap(file);
        if (signal?.aborted) throw abortError();
        if (!Number.isInteger(bitmap.width) || !Number.isInteger(bitmap.height) || bitmap.width < 1 || bitmap.height < 1
            || bitmap.width > 8192 || bitmap.height > 8192 || bitmap.width * bitmap.height > 20_000_000) throw fail();
        const scale = Math.min(1, MAP_PHOTO_UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = createCanvas();
        const encode = (mime, quality) => new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(fail()), mime, quality));
        let transparent = false;
        // Bounded fallback sizes preserve useful slide/web dimensions. Reading
        // old files still accepts the existing 2 MB / 2048-pixel contract.
        for (const resize of [1, 0.8, 0.64]) {
            const width = Math.max(1, Math.floor(bitmap.width * scale * resize));
            const height = Math.max(1, Math.floor(bitmap.height * scale * resize));
            canvas.width = width; canvas.height = height;
            const context = canvas.getContext('2d');
            if (!context) throw fail();
            context.drawImage(bitmap.source || bitmap, 0, 0, width, height);
            if (file.type !== 'image/jpeg') {
                const png = await encode('image/png');
                if (signal?.aborted) throw abortError();
                if (resize === 1 && png.size > SMALL_PNG_BYTES) {
                    const { data } = context.getImageData(0, 0, width, height);
                    for (let index = 3; index < data.length; index += 4) {
                        if (data[index] !== 255) { transparent = true; break; }
                    }
                }
                // Keep small graphics lossless and retain alpha for annotations.
                // Complex transparent PNGs may use the legacy 2 MB allowance.
                if (png.type === 'image/png' && png.size > 0
                    && (png.size <= SMALL_PNG_BYTES || (transparent && png.size <= ANNOTATION_IMAGE_MAX_BYTES))) {
                    return { blob: png, width, height };
                }
                if (transparent) continue;
            }
            for (const quality of [0.82, 0.74, 0.66]) {
                const blob = await encode('image/jpeg', quality);
                if (signal?.aborted) throw abortError();
                if (blob.type === 'image/jpeg' && blob.size > 0 && blob.size <= MAP_PHOTO_UPLOAD_MAX_BYTES) {
                    return { blob, width, height };
                }
            }
        }
        throw fail();
    } catch (error) { throw error?.name === 'AbortError' ? error : fail(); }
    finally { bitmap?.close?.(); }
}

export async function uploadAnnotationImage({ mapId, file, normalize = normalizeAnnotationImageFile,
    upload = requestFormDataWithBaseCandidates, signal } = {}) {
    if (!validMapId(mapId)) throw fail();
    const normalized = await normalize(file, { signal });
    if (signal?.aborted) throw abortError();
    const form = new FormData();
    form.append('file', normalized.blob, `care-map-image.${normalized.blob.type === 'image/jpeg' ? 'jpg' : normalized.blob.type === 'image/webp' ? 'webp' : 'png'}`);
    const metadata = await upload(`/my-maps/${encodeURIComponent(mapId)}/annotation-media`, form,
        { fetchImpl: (url, options) => fetch(url, { ...options, signal }) });
    if (signal?.aborted) throw abortError();
    if (!normalizePrintAnnotationImage({ ...metadata, alt: '' }) || metadata.width !== normalized.width || metadata.height !== normalized.height) throw fail();
    return metadata;
}

export function getPrivateAnnotationImageReadiness(annotations, sources = {}) {
    const images = annotations.filter(annotation => annotation.type === 'image');
    const failed = images.find(annotation => sources[annotation.image.assetId]?.status === 'error');
    const pending = images.some(annotation => sources[annotation.image.assetId]?.status !== 'ready' || !sources[annotation.image.assetId]?.url?.startsWith('blob:'));
    return { status: failed ? 'error' : pending ? 'loading' : 'ready', count: images.length,
        error: failed ? 'One of your Care Map images could not be loaded. Reload the image before exporting.' : '' };
}

export function getAnnotationImageRequestDescriptors(annotations = []) {
    const images = new Map();
    annotations.forEach(annotation => {
        if (annotation.type !== 'image') return;
        const image = normalizePrintAnnotationImage(annotation.image);
        if (image) images.set(image.assetId, { assetId: image.assetId, width: image.width, height: image.height });
    });
    return [...images.values()].sort((left, right) => left.assetId.localeCompare(right.assetId));
}

export function getAnnotationImageCaptureOptions(imageCount, legacyPlaceholder, legacyCacheBust = true) {
    // Cache-busting query strings invalidate browser object URLs. Verified private images must stay exact.
    return imageCount > 0 ? { cacheBust: false } : { cacheBust: legacyCacheBust, imagePlaceholder: legacyPlaceholder };
}

export async function assertAnnotationImageElementsReady(node, expectedCount = 0) {
    const images = [...(node?.querySelectorAll?.('img[data-private-annotation-image]') || [])];
    if (images.length !== expectedCount || images.some(image => !image.complete || !image.naturalWidth || !image.currentSrc?.startsWith('blob:'))) throw fail();
    await Promise.all(images.map(image => image.decode()));
}
