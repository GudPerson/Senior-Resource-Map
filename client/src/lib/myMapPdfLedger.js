import { getRowAssetKey, normalizeNoteItems } from './mapNotes.js';

const LIST_ONLY_LABEL = 'List only';
const FALLBACK_MAP_NAME = 'CareAround map';
const FALLBACK_FILE_NAME = 'carearound-map-ledger.pdf';
const TEXT_COMPARE_OPTIONS = { sensitivity: 'base', numeric: true };

function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function compareText(left, right, locale) {
    return cleanText(left).localeCompare(cleanText(right), locale, TEXT_COMPARE_OPTIONS);
}

function normalizeGeneratedAt(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return Number.isFinite(date.getTime()) ? date : new Date();
}

function getMapName(directory, presentation) {
    return cleanText(directory?.name)
        || cleanText(directory?.mapName)
        || cleanText(directory?.title)
        || cleanText(presentation?.mapName)
        || cleanText(presentation?.name)
        || cleanText(presentation?.title)
        || FALLBACK_MAP_NAME;
}

function getResourceTypeCategory(row) {
    if (row?.resourceType === 'hard') return 'Place';
    if (row?.resourceType === 'soft') return 'Offering';
    return '';
}

function getCategoryName(row) {
    return cleanText(row?.subCategory)
        || cleanText(row?.bucket)
        || getResourceTypeCategory(row)
        || 'Uncategorized';
}

function getAddress(row, place) {
    return cleanText(row?.address)
        || cleanText(place?.address)
        || cleanText(row?.locationLabel)
        || cleanText(place?.name)
        || 'Address unavailable';
}

function getPresentationMapNumber(row, group, place, presentation) {
    const candidates = [
        row?.sourceMapNumber,
        row?.mapNumber,
        row?.number,
        place?.sourceMapNumber,
        place?.mapNumber,
        place?.number,
        group?.sourceMapNumber,
        group?.mapNumber,
        group?.number,
        presentation?.placeNumberByKey?.[row?.placeKey],
        presentation?.placeNumberByKey?.[place?.placeKey],
        presentation?.placeNumberByKey?.[group?.placeKey],
        presentation?.mapNumberByAssetKey?.[getRowAssetKey(row)],
    ];

    for (const candidate of candidates) {
        const text = cleanText(candidate);
        if (text) return text;
    }

    return '';
}

function hasNormalizedNoteText(note) {
    return String(note?.text || '').slice(0, 1000).trim().length > 0;
}

function getStructuredRawNoteItems(notes) {
    if (!Array.isArray(notes?.items)) return null;
    return notes.items.filter(hasNormalizedNoteText);
}

function buildLedgerNotes(row) {
    const rawItems = getStructuredRawNoteItems(row?.notes);

    return normalizeNoteItems(row?.notes).map((note, index) => {
        const rawNote = rawItems?.[index] || null;
        const createdAt = rawNote ? rawNote.createdAt || null : note.createdAt || null;

        return {
            id: note.id ?? note.clientId ?? null,
            text: cleanText(note.text),
            visibility: note.isShared ? 'Shared' : 'Private',
            createdAt,
            updatedAt: rawNote ? rawNote.updatedAt || rawNote.createdAt || null : note.updatedAt || note.createdAt || null,
        };
    }).filter((note) => note.text);
}

function collectPresentationRows(presentation) {
    const rows = [];

    function addRow(row, group, place, source) {
        if (!row) return;
        rows.push({
            row,
            group,
            place,
            source,
        });
    }

    for (const group of presentation?.mappedGroups || []) {
        for (const row of group?.rows || []) {
            addRow(row, group, group, 'mapped');
        }

        for (const place of group?.nestedPlaces || []) {
            for (const row of place?.rows || []) {
                addRow(row, group, place, 'mapped');
            }
        }
    }

    for (const row of presentation?.unmappedRows || []) {
        addRow(row, null, null, 'unmapped');
    }

    return rows;
}

function buildLedgerResource(entry, presentation) {
    const { row, group, place, source } = entry;
    const notes = buildLedgerNotes(row);
    const sourceMapNumber = source === 'unmapped'
        ? LIST_ONLY_LABEL
        : getPresentationMapNumber(row, group, place, presentation) || LIST_ONLY_LABEL;

    return {
        assetKey: getRowAssetKey(row),
        resourceType: cleanText(row?.resourceType),
        resourceId: row?.resourceId ?? null,
        name: cleanText(row?.name) || 'Unnamed resource',
        category: getCategoryName(row),
        address: getAddress(row, place),
        sourceMapNumber,
        notes,
    };
}

export function buildMyMapPdfFileName(mapName) {
    const slug = cleanText(mapName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return slug ? `${slug}-ledger.pdf` : FALLBACK_FILE_NAME;
}

export function buildMyMapPdfLedger({
    directory,
    presentation,
    generatedAt = new Date(),
    locale = 'en-SG',
} = {}) {
    const generatedDate = normalizeGeneratedAt(generatedAt);
    const resourcesByKey = new Map();

    for (const entry of collectPresentationRows(presentation)) {
        const key = getRowAssetKey(entry.row);
        if (!key || resourcesByKey.has(key)) continue;
        resourcesByKey.set(key, buildLedgerResource(entry, presentation));
    }

    const categoriesByName = new Map();
    for (const resource of resourcesByKey.values()) {
        if (!categoriesByName.has(resource.category)) {
            categoriesByName.set(resource.category, []);
        }
        categoriesByName.get(resource.category).push(resource);
    }

    const categories = [...categoriesByName.entries()]
        .map(([name, resources]) => ({
            name,
            resources: resources.sort((left, right) => (
                compareText(left.name, right.name, locale)
                || compareText(left.assetKey, right.assetKey, locale)
            )),
        }))
        .sort((left, right) => compareText(left.name, right.name, locale));

    const resources = [...resourcesByKey.values()];
    const noteCount = resources.reduce((count, resource) => count + resource.notes.length, 0);

    return {
        mapName: getMapName(directory, presentation),
        generatedAt: generatedDate.toISOString(),
        generatedLabel: new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(generatedDate),
        summary: {
            resourceCount: resources.length,
            categoryCount: categories.length,
            resourcesWithNotesCount: resources.filter((resource) => resource.notes.length > 0).length,
            noteCount,
        },
        categories,
    };
}
