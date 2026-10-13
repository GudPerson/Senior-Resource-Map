import { getSessionApiBaseCandidates } from './apiBase.js';
import { loadAnnotationImage } from './annotationMedia.js';
import { getMapNoteImageRef, normalizeMapNoteImage, normalizeMapNoteImages } from '../../../shared/mapNoteImages.js';

export { getMapNoteImageRef, normalizeMapNoteImages };

export async function loadMapNoteImage({ mapId, shareToken = '', image, fetchImpl = globalThis.fetch, ...options }) {
    if (!normalizeMapNoteImage(image)) throw new Error('Invalid note image.');
    if (!shareToken) return loadAnnotationImage({ mapId, image, fetchImpl, ...options });
    const base = options.base || getSessionApiBaseCandidates()[0];
    const path = `${base}/shared-maps/${encodeURIComponent(shareToken)}/note-images/${image.assetId}`;
    return loadAnnotationImage({ mapId, image, ...options, fetchImpl: (_url, init) => fetchImpl(path, init) });
}

export function mapNoteImageFilename(name, index, mimeType) {
    const safe = String(name || 'map-note').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'map-note';
    return `${safe}-image-${index + 1}.${mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png'}`;
}

export function applyMapNoteImagesToDirectory(directory, row, images) {
    const ref = getMapNoteImageRef(row);
    if (!ref || !directory) return directory;
    const normalized = normalizeMapNoteImages(images);
    const decorate = item => item.resourceType === ref.resourceType && Number(item.resourceId) === ref.resourceId
        ? { ...item, notes: { ...(item.notes || {}), images: normalized } } : item;
    return { ...directory, assets: (directory.assets || []).map(decorate),
        places: (directory.places || []).map(place => ({ ...place, rows: (place.rows || []).map(decorate) })) };
}
