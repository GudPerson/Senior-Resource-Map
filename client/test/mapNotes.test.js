import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applySharedNoteTranslationsToDirectory,
    buildMapNoteResourceRows,
    buildMapNoteRowBadgeParts,
    buildMapNoteSummaryParts,
    getMapNoteResourceSummary,
    normalizeNoteItems,
} from '../src/lib/mapNotes.js';

test('applySharedNoteTranslationsToDirectory translates visible shared notes without mutating originals', () => {
    const directory = {
        assets: [
            {
                assetKey: 'soft-20',
                resourceType: 'soft',
                resourceId: 20,
                notes: {
                    items: [
                        { id: 7, text: 'Bring referral letter', isShared: true },
                        { id: 8, text: 'Call before visiting', isShared: true },
                    ],
                },
            },
        ],
        places: [
            {
                placeKey: 'place-1',
                rows: [
                    {
                        assetKey: 'soft-20',
                        resourceType: 'soft',
                        resourceId: 20,
                        notes: {
                            items: [
                                { id: 7, text: 'Bring referral letter', isShared: true },
                                { id: 8, text: 'Call before visiting', isShared: true },
                            ],
                        },
                    },
                ],
            },
        ],
    };

    const translated = applySharedNoteTranslationsToDirectory(directory, {
        locale: 'ms',
        translations: {
            'soft-20': {
                0: 'Bawa surat rujukan',
            },
        },
    });

    assert.equal(translated.assets[0].notes.items[0].text, 'Bawa surat rujukan');
    assert.equal(translated.assets[0].notes.items[0].originalText, 'Bring referral letter');
    assert.equal(translated.assets[0].notes.items[0].translatedLocale, 'ms');
    assert.equal(translated.assets[0].notes.items[1].text, 'Call before visiting');
    assert.equal(translated.places[0].rows[0].notes.items[0].text, 'Bawa surat rujukan');
    assert.equal(directory.assets[0].notes.items[0].text, 'Bring referral letter');
});

test('buildMapNoteResourceRows returns each mapped and unmapped resource once with note counts', () => {
    const presentation = {
        mappedGroups: [
            {
                placeKey: 'place-1',
                name: 'Community Hub',
                rows: [
                    {
                        assetKey: 'hard-10',
                        resourceType: 'hard',
                        resourceId: 10,
                        name: 'Community Hub',
                        notes: {
                            items: [
                                { id: 1, text: 'Call first', isShared: true },
                                { id: 2, text: 'Bring form', isShared: false },
                            ],
                        },
                    },
                    {
                        assetKey: 'soft-20',
                        resourceType: 'soft',
                        resourceId: 20,
                        name: 'Chair Yoga',
                        notes: { items: [] },
                    },
                ],
                nestedPlaces: [
                    {
                        rows: [
                            {
                                assetKey: 'soft-20',
                                resourceType: 'soft',
                                resourceId: 20,
                                name: 'Chair Yoga duplicate',
                                notes: { items: [{ id: 3, text: 'Duplicate row should not win', isShared: true }] },
                            },
                            {
                                assetKey: 'soft-21',
                                resourceType: 'soft',
                                resourceId: 21,
                                name: 'Floor Curling',
                                notes: { items: [{ id: 4, text: 'Meet at level 2', isShared: true }] },
                            },
                        ],
                    },
                ],
            },
        ],
        unmappedRows: [
            {
                assetKey: 'soft-99',
                resourceType: 'soft',
                resourceId: 99,
                name: 'Home Nursing',
                notes: { items: [{ id: 5, text: 'Mobile service', isShared: false }] },
            },
        ],
    };

    const rows = buildMapNoteResourceRows(presentation);
    assert.deepEqual(rows.map((row) => row.assetKey), ['hard-10', 'soft-20', 'soft-21', 'soft-99']);
    assert.equal(rows[0].mapNoteContext, 'Community Hub');
    assert.equal(rows[0].mapNoteCount, 2);
    assert.equal(rows[0].mapSharedNoteCount, 1);
    assert.equal(rows[1].name, 'Chair Yoga');
    assert.equal(rows[2].mapNoteCount, 1);
    assert.equal(rows[3].mapNoteContext, 'Unmapped resource');

    const summary = getMapNoteResourceSummary(rows);
    assert.deepEqual(summary, {
        resourceCount: 4,
        notedResourceCount: 3,
        noteCount: 4,
        sharedNoteCount: 2,
    });
});

test('normalizeNoteItems preserves available note timestamps', () => {
    const notes = normalizeNoteItems({
        notesUpdatedAt: '2026-06-10T09:30:00.000Z',
        items: [
            {
                id: 10,
                text: 'Call before sending referral',
                isShared: true,
                createdAt: '2026-06-09T08:15:00.000Z',
                updatedAt: '2026-06-10T09:30:00.000Z',
            },
            {
                id: 11,
                text: 'Bring printed form',
                isShared: false,
            },
        ],
    });

    assert.equal(notes[0].createdAt, '2026-06-09T08:15:00.000Z');
    assert.equal(notes[0].updatedAt, '2026-06-10T09:30:00.000Z');
    assert.equal(notes[1].createdAt, '2026-06-10T09:30:00.000Z');
    assert.equal(notes[1].updatedAt, '2026-06-10T09:30:00.000Z');
});

test('buildMapNoteSummaryParts hides the shared-note count from shared map receivers', () => {
    const summary = {
        resourceCount: 12,
        notedResourceCount: 3,
        noteCount: 3,
        sharedNoteCount: 3,
    };

    assert.deepEqual(buildMapNoteSummaryParts(summary, { mode: 'owner' }), [
        { key: 'resources', count: 12 },
        { key: 'notes', count: 3 },
        { key: 'shared', count: 3 },
    ]);

    assert.deepEqual(buildMapNoteSummaryParts(summary, { mode: 'shared' }), [
        { key: 'resources', count: 12 },
        { key: 'notes', count: 3 },
    ]);
});

test('buildMapNoteRowBadgeParts shows only visible note count to shared map receivers', () => {
    const row = {
        notes: {
            items: [
                { id: 1, text: 'Call first', isShared: true },
                { id: 2, text: 'Bring form', isShared: true },
            ],
        },
    };

    assert.deepEqual(buildMapNoteRowBadgeParts(row, { mode: 'owner' }), [
        { key: 'notes', count: 2, tone: 'brand' },
        { key: 'shared', count: 2, tone: 'slate' },
    ]);

    assert.deepEqual(buildMapNoteRowBadgeParts(row, { mode: 'shared' }), [
        { key: 'notes', count: 2, tone: 'brand' },
    ]);
});
