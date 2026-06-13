import { getRowAssetKey, normalizeNoteItems } from './mapNotes.js';

const LIST_ONLY_LABEL = 'List only';
const FALLBACK_MAP_NAME = 'CareAround map';
const FALLBACK_FILE_NAME = 'carearound-map-ledger.pdf';
const TEXT_COMPARE_OPTIONS = { sensitivity: 'base', numeric: true };
const MAX_PDF_NOTE_TOKEN_LENGTH = 38;
const PDF_NOTE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function compactLetterSpacedSegment(segment) {
    return segment.replace(/((?:\b[A-Za-z0-9]\b[ \t]+){2,}\b[A-Za-z0-9]\b)/g, (match) => (
        match.replace(/[ \t]+/g, '')
    ));
}

function repairLetterSpacedText(line) {
    return line
        .split(/[ \t]{2,}/g)
        .map(compactLetterSpacedSegment)
        .join(' ')
        .replace(/\[\s*((?:\d\s*){6})\]/g, (_match, digits) => `[${digits.replace(/\s+/g, '')}]`)
        .replace(/([A-Za-z])\s*-\s*([A-Za-z])/g, '$1-$2');
}

function breakLongNoteTokens(line) {
    return line.split(/(\s+)/g).map((part) => {
        if (!part || /\s/.test(part) || part.length <= MAX_PDF_NOTE_TOKEN_LENGTH) return part;
        return part.match(new RegExp(`.{1,${MAX_PDF_NOTE_TOKEN_LENGTH}}`, 'g')).join(' ');
    }).join('');
}

function stripInlineMarkdownForPdf(line) {
    return String(line || '')
        .replace(/^(\s*)[*+]\s+/, '$1- ')
        .replace(MARKDOWN_LINK_PATTERN, '$1 $2')
        .replace(/(\*\*|__)([^*_]+?)\1/g, '$2')
        .replace(/([*_])([^*_\n]+?)\1/g, '$2')
        .replace(/~~([^~\n]+?)~~/g, '$1')
        .replace(/^#{1,6}\s+/, '');
}

function cleanNoteLine(line) {
    if (/^\s*```[\w-]*\s*$/i.test(line)) return null;

    const normalized = String(line || '')
        .replace(PDF_NOTE_CONTROL_CHARACTERS, '')
        .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
        .replace(/[\u200b-\u200d\ufeff]/g, '')
        .replace(/`+/g, '');

    return breakLongNoteTokens(stripInlineMarkdownForPdf(repairLetterSpacedText(normalized)))
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function cleanNoteText(value) {
    const lines = String(value || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(cleanNoteLine)
        .filter((line) => line !== null);

    return lines.join('\n')
        .trim();
}

function compareText(left, right, locale) {
    return cleanText(left).localeCompare(cleanText(right), locale, TEXT_COMPARE_OPTIONS);
}

function normalizeGeneratedAt(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return Number.isFinite(date.getTime()) ? date : new Date();
}

function normalizeRawTimestamp(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const time = new Date(text).getTime();
    return Number.isFinite(time) ? text : null;
}

function buildCompactDateLabel(value) {
    const text = normalizeRawTimestamp(value);
    if (!text) return '';
    const date = new Date(text);
    const parts = new Intl.DateTimeFormat('en-SG', {
        timeZone: 'Asia/Singapore',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
    }).formatToParts(date).reduce((accumulator, part) => ({
        ...accumulator,
        [part.type]: part.value,
    }), {});

    return [parts.day, parts.month, parts.year].filter(Boolean).join('/');
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
        const rawCreatedAt = normalizeRawTimestamp(rawNote?.createdAt);
        const rawUpdatedAt = normalizeRawTimestamp(rawNote?.updatedAt) || rawCreatedAt;

        return {
            id: note.id ?? note.clientId ?? null,
            text: cleanNoteText(note.text),
            visibility: note.isShared ? 'Shared' : 'Private',
            createdAt: rawNote ? rawCreatedAt : note.createdAt || null,
            updatedAt: rawNote ? rawUpdatedAt : note.updatedAt || note.createdAt || null,
            dateLabel: buildCompactDateLabel(rawNote ? (rawUpdatedAt || rawCreatedAt) : (note.updatedAt || note.createdAt)),
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
