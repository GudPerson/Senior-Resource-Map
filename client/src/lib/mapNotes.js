export function getRowAssetKey(row) {
    return row?.assetKey || `${row?.resourceType}-${row?.resourceId}`;
}

export function getUniqueNoteRows(rows = []) {
    const seen = new Set();
    const uniqueRows = [];

    for (const row of rows || []) {
        const key = getRowAssetKey(row);
        if (!row || seen.has(key)) continue;
        seen.add(key);
        uniqueRows.push(row);
    }

    return uniqueRows;
}

export function getNoteRowsForGroup(group) {
    const rows = [
        ...(group?.rows || []),
        ...(group?.nestedPlaces || []).flatMap((place) => place?.rows || []),
    ];

    return getUniqueNoteRows(rows);
}

export function normalizeNoteItems(notes) {
    if (Array.isArray(notes?.items)) {
        return notes.items
            .map((note, index) => ({
                clientId: note?.id ? `note-${note.id}` : `note-${index}`,
                id: note?.id || null,
                text: String(note?.text || '').slice(0, 1000),
                isShared: Boolean(note?.isShared),
            }))
            .filter((note) => note.text.trim());
    }

    const legacyItems = [];
    const privateNote = String(notes?.privateNote || '').trim();
    const handoffNote = String(notes?.handoffNote || '').trim();
    if (privateNote) {
        legacyItems.push({
            clientId: 'legacy-private',
            id: null,
            text: privateNote,
            isShared: false,
        });
    }
    if (handoffNote) {
        legacyItems.push({
            clientId: 'legacy-shared',
            id: null,
            text: handoffNote,
            isShared: true,
        });
    }
    return legacyItems;
}

export function hasAnyOwnerNote(row) {
    return normalizeNoteItems(row?.notes).length > 0;
}

function withMapNoteMeta(row, contextLabel, source = 'mapped') {
    const notes = normalizeNoteItems(row?.notes);
    return {
        ...row,
        mapNoteContext: contextLabel,
        mapNoteSource: source,
        mapNoteCount: notes.length,
        mapSharedNoteCount: notes.filter((note) => note.isShared).length,
    };
}

export function buildMapNoteResourceRows(presentation, options = {}) {
    const unmappedContextLabel = options.unmappedContextLabel || 'Unmapped resource';
    const seen = new Set();
    const rows = [];

    function addRow(row, contextLabel, source) {
        if (!row) return;
        const key = getRowAssetKey(row);
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(withMapNoteMeta(row, contextLabel || unmappedContextLabel, source));
    }

    for (const group of presentation?.mappedGroups || []) {
        for (const row of group?.rows || []) {
            addRow(row, group?.name, 'mapped');
        }

        for (const nestedPlace of group?.nestedPlaces || []) {
            for (const row of nestedPlace?.rows || []) {
                addRow(row, nestedPlace?.name || group?.name, 'mapped');
            }
        }
    }

    for (const row of presentation?.unmappedRows || []) {
        addRow(row, unmappedContextLabel, 'unmapped');
    }

    return rows;
}

export function getMapNoteResourceSummary(rows = []) {
    return rows.reduce((summary, row) => {
        const notes = normalizeNoteItems(row?.notes);
        return {
            resourceCount: summary.resourceCount + 1,
            notedResourceCount: summary.notedResourceCount + (notes.length ? 1 : 0),
            noteCount: summary.noteCount + notes.length,
            sharedNoteCount: summary.sharedNoteCount + notes.filter((note) => note.isShared).length,
        };
    }, {
        resourceCount: 0,
        notedResourceCount: 0,
        noteCount: 0,
        sharedNoteCount: 0,
    });
}

export function buildMapNoteSummaryParts(summary = {}, options = {}) {
    const mode = options.mode || 'owner';
    const parts = [
        { key: 'resources', count: Number(summary.resourceCount || 0) },
        { key: 'notes', count: Number(summary.noteCount || 0) },
    ];

    if (mode !== 'shared') {
        parts.push({ key: 'shared', count: Number(summary.sharedNoteCount || 0) });
    }

    return parts;
}

export function buildMapNoteRowBadgeParts(row, options = {}) {
    const mode = options.mode || 'owner';
    const notes = normalizeNoteItems(row?.notes);
    const parts = [
        { key: 'notes', count: notes.length, tone: 'brand' },
    ];

    if (mode !== 'shared') {
        parts.push({
            key: 'shared',
            count: notes.filter((note) => note.isShared).length,
            tone: 'slate',
        });
    }

    return parts.filter((part) => part.count > 0);
}
