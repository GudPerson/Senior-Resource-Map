export const MAP_NOTE_IMAGE_LIMIT = 20;
export const MAP_NOTE_IMAGE_DOCUMENT_BYTES = 128 * 1024;

export function normalizeMapNoteImage(image) {
    if (!image || !/^[a-f0-9]{64}$/.test(image.assetId || '')
        || !['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType)
        || !Number.isSafeInteger(image.size) || image.size < 1 || image.size > 2 * 1024 * 1024
        || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height)
        || image.width < 1 || image.height < 1 || image.width > 2048 || image.height > 2048
        || image.width * image.height > 4_000_000 || typeof image.isShared !== 'boolean') return null;
    return { assetId: image.assetId, mimeType: image.mimeType, size: image.size,
        width: image.width, height: image.height, isShared: image.isShared };
}

export function normalizeMapNoteImages(images) {
    if (!Array.isArray(images) || images.length > MAP_NOTE_IMAGE_LIMIT) return [];
    const normalized = images.map(normalizeMapNoteImage);
    if (normalized.some(image => !image) || new Set(normalized.map(image => image.assetId)).size !== normalized.length) return [];
    return normalized;
}

export function getMapNoteImageRef(row) {
    const resourceId = Number(row?.resourceId);
    return ['hard', 'soft', 'personal_place'].includes(row?.resourceType) && Number.isSafeInteger(resourceId) && resourceId > 0
        ? { resourceType: row.resourceType, resourceId } : null;
}

export function getDirectoryMapNoteImages(directory) {
    return [...(directory?.assets || []), ...(directory?.places || []).flatMap(place => place.rows || [])]
        .flatMap(row => normalizeMapNoteImages(row?.notes?.images));
}
