const DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
const validId = value => Number.isSafeInteger(value) && value > 0;
const emptyNotes = () => ({ revision: 0, items: [], notesUpdatedAt: null });
export class PersonalPlaceMapNotesError extends Error {
    constructor(message, status = 400, code = 'personal_place_notes_invalid') {
        super(message); this.status = status; this.code = code;
    }
}
const unavailable = () => new PersonalPlaceMapNotesError('Personal place notes are unavailable. Try again later.', 503, 'personal_place_notes_unavailable');
const conflict = () => new PersonalPlaceMapNotesError('These notes changed in another session. Reopen Map notes before saving again.', 409, 'personal_place_notes_conflict');

function parseItems(notes) {
    if (!Array.isArray(notes) || notes.length > 20) throw new PersonalPlaceMapNotesError('Choose up to 20 valid notes.');
    return notes.map(note => {
        if (!note || typeof note.text !== 'string' || note.text.length > 3000
            || (note.isShared !== undefined && note.isShared !== false)) {
            throw new PersonalPlaceMapNotesError('Personal place notes stay private and must be 3000 characters or fewer.');
        }
        return { text: note.text.trim(), isShared: false };
    }).filter(note => note.text);
}
function validateDocument(document) {
    if (!document || document.schemaVersion !== 1 || !Array.isArray(document.entries) || document.entries.length > 500
        || new Set(document.entries.map(entry => entry?.membershipId)).size !== document.entries.length) throw unavailable();
    for (const entry of document.entries) {
        if (!validId(entry?.membershipId) || !validId(entry?.revision) || typeof entry.notesUpdatedAt !== 'string'
            || !Number.isFinite(Date.parse(entry.notesUpdatedAt))) throw unavailable();
        try {
            const items = parseItems(entry.items);
            if (items.length !== entry.items.length || entry.items.some((note, index) => note.id !== index + 1)) throw unavailable();
        } catch { throw unavailable(); }
    }
    return document;
}
const content = items => JSON.stringify(items.map(({ text }) => ({ text, isShared: false })));

// Separate from saved-resource SQL notes and immutable image galleries. The
// membership id makes notes map-specific and prevents resurrection on re-add.
export function createPersonalPlaceMapNotesRepository(bucket, ownerId) {
    if (!validId(ownerId) || !bucket?.get || !bucket?.put) throw unavailable();
    const key = mapId => {
        if (!validId(mapId)) throw unavailable();
        return `care-map-personal-notes/v1/owners/${ownerId}/maps/${mapId}.json`;
    };
    async function read(mapId) {
        const object = await bucket.get(key(mapId));
        if (!object) return { document: { schemaVersion: 1, entries: [] }, etag: null };
        if (!object.etag || object.size > DOCUMENT_MAX_BYTES) throw unavailable();
        let document;
        try { document = await object.json(); } catch { throw unavailable(); }
        return { document: validateDocument(document), etag: object.etag };
    }
    async function write(mapId, document, etag) {
        validateDocument(document);
        const value = JSON.stringify(document);
        if (new TextEncoder().encode(value).length > DOCUMENT_MAX_BYTES) throw unavailable();
        return bucket.put(key(mapId), value, {
            onlyIf: etag === null ? new Headers({ 'If-None-Match': '*' }) : { etagMatches: etag },
            httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' },
        });
    }
    async function replace(mapId, membershipId, body) {
        if (!validId(membershipId) || !Number.isSafeInteger(body?.revision) || body.revision < 0) {
            throw new PersonalPlaceMapNotesError('A valid note revision is required.');
        }
        const desired = parseItems(body.notes);
        for (let attempt = 0; attempt < 5; attempt++) {
            const { document, etag } = await read(mapId);
            const previous = document.entries.find(entry => entry.membershipId === membershipId) || emptyNotes();
            if (content(previous.items) === content(desired)) return previous;
            if (body.revision !== previous.revision) throw conflict();
            const timestamp = new Date().toISOString();
            const next = { membershipId, revision: previous.revision + 1, notesUpdatedAt: timestamp,
                items: desired.map((note, index) => ({ ...note, id: index + 1, sortOrder: index, createdAt: timestamp, updatedAt: timestamp })) };
            const entries = document.entries.filter(entry => entry.membershipId !== membershipId);
            entries.push(next);
            if (await write(mapId, { schemaVersion: 1, entries }, etag)) return next;
            // A concurrent edit to a different membership can merge safely;
            // the next read still rejects edits to this membership's revision.
        }
        throw conflict();
    }
    async function copy(document, targetMapId, membershipMapping) {
        validateDocument(document);
        const entries = document.entries.filter(entry => membershipMapping.has(entry.membershipId))
            .map(entry => ({ ...entry, membershipId: membershipMapping.get(entry.membershipId), revision: 1 }));
        if (entries.length && !await write(targetMapId, { schemaVersion: 1, entries }, null)) throw conflict();
    }
    return { read, replace, copy };
}

export function attachPersonalPlaceMapNotes(directory, map, document, { unavailable: storageUnavailable = false } = {}) {
    const entries = new Map((document?.entries || []).map(entry => [entry.membershipId, entry]));
    const byPlace = new Map((map?.personalPlaceLinks || []).map(link => [link.personalPlaceId, entries.get(link.id) || emptyNotes()]));
    const decorate = row => {
        if (row.resourceType !== 'personal_place' || !byPlace.has(row.resourceId)) return row;
        const { membershipId, ...notes } = byPlace.get(row.resourceId);
        return { ...row, notes: { ...(row.notes || {}), ...notes, ...(storageUnavailable ? { unavailable: true } : {}) } };
    };
    return { ...directory, personalPlaces: (directory.personalPlaces || []).map(decorate),
        places: (directory.places || []).map(place => ({ ...place, rows: (place.rows || []).map(decorate) })) };
}
