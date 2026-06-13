const MAP_NOTE_MAX_LENGTH = 1000;

function normalizeNoteText(value) {
    return String(value ?? '').trim().slice(0, MAP_NOTE_MAX_LENGTH);
}

export function buildMapNotesSavePayload(notes = []) {
    const normalizedNotes = (Array.isArray(notes) ? notes : [])
        .map((note) => {
            const text = normalizeNoteText(note?.text);
            if (!text) return null;

            return {
                ...(note?.id ? { id: note.id } : {}),
                text,
                isShared: Boolean(note?.isShared),
            };
        })
        .filter(Boolean);

    return { notes: normalizedNotes };
}

export function buildMapNotesAutosaveSignature(input = {}) {
    const payload = Array.isArray(input) ? buildMapNotesSavePayload(input) : buildMapNotesSavePayload(input.notes);
    return payload.notes
        .map((note) => `${note.id || ''}:${note.isShared ? 1 : 0}:${note.text}`)
        .join('|');
}

function buildNoteContentSignature(note = {}) {
    const text = normalizeNoteText(note?.text);
    return `${Boolean(note?.isShared) ? 1 : 0}:${text}`;
}

export function mergeRemoteNotesWithStableDrafts(currentNotes = [], remoteNotes = []) {
    const draftNotes = Array.isArray(currentNotes) ? currentNotes : [];
    const nextRemoteNotes = Array.isArray(remoteNotes) ? remoteNotes : [];

    return nextRemoteNotes.map((remoteNote, index) => {
        const draftNote = draftNotes[index];
        if (!draftNote?.clientId) return remoteNote;
        if (buildNoteContentSignature(draftNote) !== buildNoteContentSignature(remoteNote)) return remoteNote;

        return {
            ...remoteNote,
            clientId: draftNote.clientId,
        };
    });
}

export function shouldResetDraftsFromRemote({
    previousRowKey,
    nextRowKey,
    localSignature,
    remoteSignature,
    hasPendingSave = false,
    isSaving = false,
} = {}) {
    if (previousRowKey !== nextRowKey) return true;
    if (localSignature === remoteSignature) return true;
    return !(hasPendingSave || isSaving);
}
