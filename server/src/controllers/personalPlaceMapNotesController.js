import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { myMapPersonalPlaceLinks, userPersonalPlaces } from '../db/schema.js';
import { requireMapAnnotationMediaOwner } from './mapAnnotationMediaController.js';
import { createPersonalPlaceMapNotesRepository, PersonalPlaceMapNotesError } from '../utils/personalPlaceMapNotes.js';

const id = value => /^[1-9]\d*$/.test(value || '') && Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
const missing = () => new PersonalPlaceMapNotesError('Personal place is not on this map.', 404, 'personal_place_notes_not_found');
async function boundedBody(request) {
    if (!request.body) throw new PersonalPlaceMapNotesError('Valid notes are required.');
    const reader = request.body.getReader(), chunks = []; let size = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > 256 * 1024) { await reader.cancel(); throw new PersonalPlaceMapNotesError('Notes are too large.', 413); }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new PersonalPlaceMapNotesError('Valid notes are required.'); }
}
export function createPersonalPlaceMapNotesHandlers({ dbForContext = c => getDb(c.env), bucketForContext = c => c.env?.HELP_CMS_BUCKET } = {}) {
    return { replace: async c => {
        c.header('Cache-Control', 'private, no-store'); c.header('Vary', 'Cookie, Authorization, X-Session-Token');
        c.header('X-Content-Type-Options', 'nosniff');
        try {
            const db = dbForContext(c), user = c.get('user'), mapId = id(c.req.param('id')), placeId = id(c.req.param('placeId'));
            await requireMapAnnotationMediaOwner(db, user, mapId);
            if (!Number.isSafeInteger(placeId) || !await db.query.userPersonalPlaces.findFirst({
                where: and(eq(userPersonalPlaces.id, placeId), eq(userPersonalPlaces.userId, user.id)), columns: { id: true },
            })) throw missing();
            const link = await db.query.myMapPersonalPlaceLinks.findFirst({ where: and(eq(myMapPersonalPlaceLinks.mapId, mapId),
                eq(myMapPersonalPlaceLinks.personalPlaceId, placeId)), columns: { id: true } });
            if (!link) throw missing();
            const notes = await createPersonalPlaceMapNotesRepository(bucketForContext(c), user.id).replace(mapId, link.id, await boundedBody(c.req.raw));
            return c.json({ resourceType: 'personal_place', resourceId: placeId,
                notes: { revision: notes.revision, items: notes.items, notesUpdatedAt: notes.notesUpdatedAt } });
        } catch (error) {
            const status = [400, 403, 404, 409, 413].includes(error?.status) ? error.status : 503;
            return c.json({ error: status === 503 ? 'Personal place notes are unavailable. Try again later.' : error.message,
                code: error.code || 'personal_place_notes_unavailable' }, status);
        }
    } };
}
export const { replace: patchPersonalPlaceMapNotes } = createPersonalPlaceMapNotesHandlers();
