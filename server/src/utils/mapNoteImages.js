import { MAP_NOTE_IMAGE_DOCUMENT_BYTES, MAP_NOTE_IMAGE_LIMIT, normalizeMapNoteImages } from '../../../shared/mapNoteImages.js';
import { createPrivateMapMediaRepository, MapMediaError } from './privateMapMedia.js';

const unavailable = () => new MapMediaError('Map note images are unavailable. Try again later.', 503, 'map_media_unavailable');
const conflict = () => new MapMediaError('Images changed in another session. Reload the images before trying again.', 409, 'map_note_images_conflict');
const validId = id => Number.isSafeInteger(id) && id > 0;

function validateDocument(value) {
    if (!value || value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0
        || !Array.isArray(value.entries)
        || new Set(value.entries.map(entry => entry?.membershipKey)).size !== value.entries.length) throw unavailable();
    for (const entry of value.entries) {
        if (!/^(asset|personal):[1-9]\d*$/.test(entry?.membershipKey || '') || !Array.isArray(entry.images)
            || normalizeMapNoteImages(entry.images).length !== entry.images.length) throw unavailable();
    }
    if (value.updatedAt != null && (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)))) throw unavailable();
    return { schemaVersion: 1, revision: value.revision, updatedAt: value.updatedAt || null,
        entries: value.entries.map(entry => ({ membershipKey: entry.membershipKey, images: normalizeMapNoteImages(entry.images) })) };
}

// Text note rows are replaced during legacy autosave. Bind galleries to the
// existing map-resource membership id instead; removing/re-adding a resource
// cannot resurrect the gallery from the previous membership.
export function createMapNoteImageRepository(bucket, ownerId) {
    if (!validId(ownerId) || !bucket?.get || !bucket?.put) throw unavailable();
    const media = createPrivateMapMediaRepository(bucket, ownerId);
    const key = mapId => {
        if (!validId(mapId)) throw unavailable();
        return `care-map-note-images/v1/owners/${ownerId}/maps/${mapId}.json`;
    };
    async function read(mapId) {
        const object = await bucket.get(key(mapId));
        if (!object) return { document: { schemaVersion: 1, revision: 0, entries: [] }, etag: null };
        if (!object.etag || object.size > MAP_NOTE_IMAGE_DOCUMENT_BYTES) throw unavailable();
        let value;
        try { value = await object.json(); } catch { throw unavailable(); }
        return { document: validateDocument(value), etag: object.etag };
    }
    async function write(mapId, document, etag) {
        validateDocument(document);
        const text = JSON.stringify(document);
        if (new TextEncoder().encode(text).length > MAP_NOTE_IMAGE_DOCUMENT_BYTES) throw unavailable();
        const saved = await bucket.put(key(mapId), text, {
            onlyIf: etag === null ? new Headers({ 'If-None-Match': '*' }) : { etagMatches: etag },
            httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' },
        });
        if (!saved) throw conflict();
    }
    async function replace(mapId, membershipKey, body) {
        if (!/^(asset|personal):[1-9]\d*$/.test(membershipKey || '') || !Number.isSafeInteger(body?.revision) || body.revision < 0
            || !Array.isArray(body.images) || body.images.length > MAP_NOTE_IMAGE_LIMIT
            || body.images.some(image => !/^[a-f0-9]{64}$/.test(image?.assetId || '') || typeof image.isShared !== 'boolean')
            || new Set(body.images.map(image => image.assetId)).size !== body.images.length) {
            throw new MapMediaError('Choose valid note images.');
        }
        const current = await read(mapId);
        const previous = current.document.entries.find(entry => entry.membershipKey === membershipKey)?.images || [];
        const desired = body.images.map(image => ({ assetId: image.assetId, isShared: image.isShared }));
        // A retry after an uncertain write can confirm the same desired state.
        if (JSON.stringify(previous.map(({ assetId, isShared }) => ({ assetId, isShared }))) === JSON.stringify(desired)) {
            return { revision: current.document.revision, images: previous, updatedAt: current.document.updatedAt || null };
        }
        if (body.revision !== current.document.revision) throw conflict();
        const images = [];
        for (const image of desired) {
            const { metadata } = await media.getAsset(image.assetId);
            images.push({ ...metadata, isShared: image.isShared });
        }
        const entries = current.document.entries.filter(entry => entry.membershipKey !== membershipKey);
        if (images.length) entries.push({ membershipKey, images });
        const document = { schemaVersion: 1, revision: current.document.revision + 1, updatedAt: new Date().toISOString(), entries };
        await write(mapId, document, current.etag);
        return { revision: document.revision, images, updatedAt: document.updatedAt };
    }
    async function copy(document, targetMapId, membershipMapping) {
        const entries = document.entries.filter(entry => membershipMapping.has(entry.membershipKey))
            .map(entry => ({ membershipKey: membershipMapping.get(entry.membershipKey),
                images: entry.images.map(image => ({ ...image, isShared: false })) }));
        if (entries.length) await write(targetMapId, { schemaVersion: 1, revision: 1, updatedAt: new Date().toISOString(), entries }, null);
    }
    return { read, replace, copy, getUsage: media.getUsage };
}

export function attachMapNoteImages(directory, map, document, { shared = false } = {}) {
    if (!document?.entries?.length) return directory;
    const imageGroups = new Map(document.entries.map(entry => [entry.membershipKey,
        normalizeMapNoteImages(entry.images).filter(image => !shared || image.isShared)]));
    const byResource = new Map((map?.assets || []).map(asset => [
        `${asset.resourceType}:${asset.resourceId}`, imageGroups.get(`asset:${asset.id}`) || [],
    ]));
    if (!shared) for (const link of map?.personalPlaceLinks || []) {
        byResource.set(`personal_place:${link.personalPlaceId}`, imageGroups.get(`personal:${link.id}`) || []);
    }
    const decorate = row => {
        const images = byResource.get(`${row.resourceType}:${row.resourceId}`) || [];
        return images.length ? { ...row, notes: { ...(row.notes || {}), images } } : row;
    };
    return { ...directory, assets: (directory.assets || []).map(decorate),
        places: (directory.places || []).map(place => ({ ...place, rows: (place.rows || []).map(decorate) })) };
}
