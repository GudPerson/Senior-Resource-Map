import { validateCmsImage } from '../../../shared/helpContentCms.js';

export const MAP_MEDIA_MAX_BYTES = 2 * 1024 * 1024;
export const MAP_MEDIA_MAX_COUNT = 20;
export const MAP_MEDIA_MAX_OWNER_BYTES = 20 * 1024 * 1024;
export const MAP_MEDIA_MAX_SIDE = 2048;
export const MAP_MEDIA_MAX_PIXELS = 4_000_000;
export const isMapMediaAssetId = (id) => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);

export class MapMediaError extends Error {
    constructor(message, status = 400, code = 'map_media_invalid') {
        super(message); this.status = status; this.code = code;
    }
}

export function validateMapMediaImage(bytes, mimeType) {
    let metadata;
    try { metadata = validateCmsImage(bytes, mimeType); }
    catch { throw new MapMediaError('Choose a valid PNG, JPEG, or WebP image no larger than 2 MB.'); }
    if (metadata.width > MAP_MEDIA_MAX_SIDE || metadata.height > MAP_MEDIA_MAX_SIDE
        || metadata.width * metadata.height > MAP_MEDIA_MAX_PIXELS) {
        throw new MapMediaError('Map images must be at most 2048 pixels per side and 4 million pixels in total.');
    }
    return { mimeType: metadata.mime, size: metadata.size, width: metadata.width, height: metadata.height };
}

const unavailable = () => new MapMediaError('Private map image storage is unavailable. Try again later.', 503, 'map_media_unavailable');
const notFound = () => new MapMediaError('Map image not found.', 404, 'map_media_not_found');
const createOnly = () => new Headers({ 'If-None-Match': '*' });

export function createPrivateMapMediaRepository(bucket, ownerId) {
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0 || !bucket || typeof bucket.get !== 'function' || typeof bucket.put !== 'function') throw unavailable();
    const prefix = `care-map-media/v1/owners/${ownerId}/`;
    const ledgerKey = `${prefix}quota.json`;
    const assetKey = (id) => `${prefix}assets/${id}`;
    const readLedger = async () => {
        const object = await bucket.get(ledgerKey);
        if (!object) return { assets: [], etag: null };
        let value;
        try { value = await object.json(); } catch { throw unavailable(); }
        if (value?.version !== 1 || !Array.isArray(value.assets) || value.assets.length > MAP_MEDIA_MAX_COUNT
            || !object.etag || new Set(value.assets.map((item) => item?.assetId)).size !== value.assets.length
            || value.assets.some((item) => !isMapMediaAssetId(item?.assetId) || !['image/png', 'image/jpeg', 'image/webp'].includes(item.mimeType)
                || !Number.isSafeInteger(item.size) || item.size < 1 || item.size > MAP_MEDIA_MAX_BYTES
                || !Number.isSafeInteger(item.width) || !Number.isSafeInteger(item.height) || item.width < 1 || item.height < 1
                || item.width > MAP_MEDIA_MAX_SIDE || item.height > MAP_MEDIA_MAX_SIDE || item.width * item.height > MAP_MEDIA_MAX_PIXELS)
            || value.assets.reduce((total, item) => total + item.size, 0) > MAP_MEDIA_MAX_OWNER_BYTES) throw unavailable();
        return { assets: value.assets, etag: object.etag };
    };
    const reserve = async (metadata) => {
        for (let attempt = 0; attempt < 5; attempt++) {
            const current = await readLedger();
            const prior = current.assets.find((item) => item.assetId === metadata.assetId);
            if (prior) {
                if (JSON.stringify(prior) !== JSON.stringify(metadata)) throw unavailable();
                return;
            }
            if (current.assets.length >= MAP_MEDIA_MAX_COUNT
                || current.assets.reduce((total, item) => total + item.size, 0) + metadata.size > MAP_MEDIA_MAX_OWNER_BYTES) {
                throw new MapMediaError('Your account has reached its private map image limit (20 images or 20 MB). Reuse an image already uploaded.', 413, 'map_media_quota_exceeded');
            }
            const result = await bucket.put(ledgerKey, JSON.stringify({ version: 1, assets: [...current.assets, metadata] }), {
                onlyIf: current.etag === null ? createOnly() : { etagMatches: current.etag },
                httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' },
            });
            if (result) return;
        }
        throw new MapMediaError('Another image upload is in progress. Try again.', 409, 'map_media_conflict');
    };
    async function getAsset(id) {
        if (!isMapMediaAssetId(id)) throw notFound();
        const metadata = (await readLedger()).assets.find((item) => item.assetId === id);
        if (!metadata) throw notFound();
        const object = await bucket.get(assetKey(id));
        if (!object || object.size !== metadata.size || object.httpMetadata?.contentType !== metadata.mimeType
            || object.customMetadata?.ownerId !== String(ownerId)) throw notFound();
        return { object, metadata };
    }
    async function saveAsset(bytes, mimeType) {
        const details = validateMapMediaImage(bytes, mimeType);
        const assetId = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
        const metadata = { assetId, ...details };
        // Reserve before writing bytes; uncertain/failed writes retain the bounded
        // reservation. Retrying the same file safely completes the same object.
        await reserve(metadata);
        await bucket.put(assetKey(assetId), bytes, { onlyIf: createOnly(),
            httpMetadata: { contentType: details.mimeType, cacheControl: 'private, no-store' },
            customMetadata: { ownerId: String(ownerId) } });
        return (await getAsset(assetId)).metadata;
    }
    return { saveAsset, getAsset };
}
