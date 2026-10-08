import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { myMaps } from '../db/schema.js';
import { normalizeRole } from '../utils/roles.js';
import { createPrivateMapMediaRepository, MAP_MEDIA_MAX_BYTES, MapMediaError } from '../utils/privateMapMedia.js';

export async function requireMapAnnotationMediaOwner(db, user, mapId) {
    if (!Number.isSafeInteger(user?.id) || user.id <= 0 || normalizeRole(user.role) === 'guest' || user.isImpersonating) {
        throw new MapMediaError('Sign in to your own account to use private map images.', 403, 'map_media_access_denied');
    }
    if (!Number.isSafeInteger(mapId) || mapId <= 0) throw new MapMediaError('Map id is required.');
    const map = await db.query.myMaps.findFirst({ where: and(eq(myMaps.id, mapId), eq(myMaps.userId, user.id)), columns: { id: true } });
    if (!map) throw new MapMediaError('Map not found.', 404, 'map_media_not_found');
}

async function boundedImageForm(request) {
    const type = request.headers.get('content-type') || '';
    if (!type.startsWith('multipart/form-data;') || !request.body) throw new MapMediaError('Choose an image to upload.');
    const reader = request.body.getReader();
    const chunks = []; let total = 0;
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > MAP_MEDIA_MAX_BYTES + 65536) { await reader.cancel(); throw new MapMediaError('Map images must be 2 MB or smaller.', 413); }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let form;
    try { form = await new Response(bytes, { headers: { 'Content-Type': type } }).formData(); }
    catch { throw new MapMediaError('Choose a valid image to upload.'); }
    const file = form.get('file');
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') throw new MapMediaError('Choose an image to upload.');
    if (!file.size || file.size > MAP_MEDIA_MAX_BYTES) throw new MapMediaError('Map images must be nonempty and 2 MB or smaller.', 413);
    return file;
}

export function createMapAnnotationMediaHandlers({ dbForContext = (c) => getDb(c.env), bucketForContext = (c) => c.env?.HELP_CMS_BUCKET } = {}) {
    const handler = (action) => async (c) => {
        c.header('Cache-Control', 'private, no-store');
        c.header('Vary', 'Cookie, Authorization, X-Session-Token');
        c.header('X-Content-Type-Options', 'nosniff');
        try {
            const id = c.req.param('id');
            const user = c.get('user'), mapId = /^[1-9]\d*$/.test(id || '') ? Number(id) : NaN;
            await requireMapAnnotationMediaOwner(dbForContext(c), user, mapId);
            const repository = createPrivateMapMediaRepository(bucketForContext(c), user.id);
            return await action(c, repository);
        } catch (error) {
            return c.json({ error: error instanceof MapMediaError ? error.message : 'Private map image storage is unavailable. Try again later.',
                code: error instanceof MapMediaError ? error.code : 'map_media_unavailable' }, error instanceof MapMediaError ? error.status : 503);
        }
    };
    return {
        upload: handler(async (c, repository) => {
            const file = await boundedImageForm(c.req.raw);
            return c.json(await repository.saveAsset(new Uint8Array(await file.arrayBuffer()), file.type), 201);
        }),
        read: handler(async (c, repository) => {
            const { object, metadata } = await repository.getAsset(c.req.param('assetId'));
            c.header('Content-Type', metadata.mimeType);
            c.header('Content-Length', String(metadata.size));
            c.header('Content-Disposition', 'inline');
            return c.body(object.body);
        }),
    };
}

export const { upload: postMapAnnotationMedia, read: getMapAnnotationMedia } = createMapAnnotationMediaHandlers();
