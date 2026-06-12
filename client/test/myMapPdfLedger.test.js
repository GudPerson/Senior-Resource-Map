import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildMyMapPdfFileName,
    buildMyMapPdfLedger,
} from '../src/lib/myMapPdfLedger.js';

function row(overrides) {
    return {
        assetKey: `${overrides.resourceType || 'hard'}-${overrides.resourceId}`,
        resourceType: overrides.resourceType || 'hard',
        resourceId: overrides.resourceId,
        name: overrides.name,
        subCategory: overrides.subCategory,
        bucket: overrides.bucket,
        address: overrides.address,
        notes: overrides.notes || { items: [] },
        ...overrides,
    };
}

test('buildMyMapPdfLedger collects, deduplicates, groups, and sorts map resources', () => {
    const ledger = buildMyMapPdfLedger({
        directory: { name: 'My Partners' },
        generatedAt: new Date('2026-06-10T04:30:00.000Z'),
        locale: 'en-SG',
        presentation: {
            mappedGroups: [
                {
                    name: 'Community Support',
                    number: 1,
                    address: '1 North Street, Singapore 111111',
                    rows: [
                        row({
                            resourceId: 2,
                            resourceType: 'soft',
                            name: 'Zebra Befriending',
                            subCategory: 'Befriending',
                            notes: {
                                items: [
                                    {
                                        id: 'note-2',
                                        text: 'Share referral context',
                                        isShared: true,
                                        createdAt: '2026-06-07T01:00:00.000Z',
                                    },
                                ],
                            },
                        }),
                        row({
                            resourceId: 4,
                            resourceType: 'soft',
                            name: 'Alpha Befriending',
                            subCategory: 'Befriending',
                        }),
                    ],
                },
                {
                    name: 'Wellness Hub',
                    number: 2,
                    nestedPlaces: [
                        {
                            name: 'Wellness Hub Annex',
                            number: 2,
                            address: '22 West Avenue, Singapore 222222',
                            rows: [
                                row({
                                    resourceId: 1,
                                    name: 'Alpha AAC',
                                    subCategory: 'Active Ageing Centre (AAC)',
                                }),
                                row({
                                    resourceId: 2,
                                    resourceType: 'soft',
                                    name: 'Duplicate Befriending',
                                    subCategory: 'Befriending',
                                    notes: {
                                        items: [
                                            {
                                                id: 'duplicate-note',
                                                text: 'Duplicate should not win',
                                                isShared: false,
                                            },
                                        ],
                                    },
                                }),
                            ],
                        },
                    ],
                },
            ],
            unmappedRows: [
                row({
                    resourceId: 3,
                    resourceType: 'soft',
                    name: 'Mobile Home Care',
                    subCategory: 'Home care',
                    locationLabel: 'Service islandwide',
                    notes: {
                        items: [
                            {
                                id: 'note-3',
                                text: 'Call before sending family',
                                isShared: false,
                                createdAt: '2026-06-08T02:00:00.000Z',
                            },
                        ],
                    },
                }),
            ],
        },
    });

    assert.equal(ledger.mapName, 'My Partners');
    assert.equal(ledger.summary.resourceCount, 4);
    assert.equal(ledger.summary.categoryCount, 3);
    assert.equal(ledger.summary.resourcesWithNotesCount, 2);
    assert.equal(ledger.summary.noteCount, 2);
    assert.deepEqual(ledger.categories.map((category) => category.name), [
        'Active Ageing Centre (AAC)',
        'Befriending',
        'Home care',
    ]);
    assert.equal(ledger.categories[0].resources[0].sourceMapNumber, '2');
    assert.deepEqual(ledger.categories[1].resources.map((resource) => resource.name), [
        'Alpha Befriending',
        'Zebra Befriending',
    ]);
    assert.equal(ledger.categories[1].resources[0].sourceMapNumber, '1');
    assert.equal(ledger.categories[2].resources[0].sourceMapNumber, 'List only');
    assert.equal(ledger.categories[2].resources[0].notes[0].visibility, 'Private');
    assert.equal(ledger.categories[2].resources[0].notes[0].updatedAt, '2026-06-08T02:00:00.000Z');
    assert.equal(buildMyMapPdfFileName('My Partners / North-West'), 'my-partners-north-west-ledger.pdf');
    assert.equal(buildMyMapPdfFileName(''), 'carearound-map-ledger.pdf');
});

test('buildMyMapPdfLedger uses raw structured note timestamps instead of container fallback', () => {
    const ledger = buildMyMapPdfLedger({
        directory: { name: 'Timestamp Map' },
        presentation: {
            unmappedRows: [
                row({
                    resourceId: 10,
                    resourceType: 'soft',
                    name: 'Timestamped Container Only',
                    subCategory: 'Home care',
                    notes: {
                        notesUpdatedAt: '2026-06-09T08:30:00.000Z',
                        items: [
                            {
                                id: 'container-only',
                                text: 'Structured note has no raw item timestamps',
                                isShared: true,
                            },
                        ],
                    },
                }),
            ],
        },
    });

    const [note] = ledger.categories[0].resources[0].notes;
    assert.equal(note.createdAt, null);
    assert.equal(note.updatedAt, null);
});

test('buildMyMapPdfLedger preserves note line breaks and adds Singapore dd/mm/yy date labels', () => {
    const ledger = buildMyMapPdfLedger({
        directory: { name: 'Formatted Notes Map' },
        presentation: {
            unmappedRows: [
                row({
                    resourceId: 14,
                    resourceType: 'soft',
                    name: 'Formatted Note Resource',
                    subCategory: 'Home care',
                    notes: {
                        items: [
                            {
                                id: 'formatted-note',
                                text: 'First line\nSecond line\n\nThird line',
                                isShared: false,
                                createdAt: '2026-06-08T01:00:00.000Z',
                                updatedAt: '2026-06-09T16:30:00.000Z',
                            },
                        ],
                    },
                }),
            ],
        },
    });

    const [note] = ledger.categories[0].resources[0].notes;
    assert.equal(note.text, 'First line\nSecond line\n\nThird line');
    assert.equal(note.dateLabel, '10/06/26');
});

test('buildMyMapPdfLedger cleans copied markdown and letter-spaced note artifacts for PDF output', () => {
    const ledger = buildMyMapPdfLedger({
        directory: { name: 'Copied Notes Map' },
        presentation: {
            unmappedRows: [
                row({
                    resourceId: 15,
                    resourceType: 'soft',
                    name: 'Copied Note Resource',
                    subCategory: 'Home care',
                    notes: {
                        items: [
                            {
                                id: 'copied-note',
                                text: '```text\n1. ` ` M a l e - C e n t r i c  A A P\n[ 1 0 0 6 2 6 ] - pasted date\n```',
                                isShared: false,
                                createdAt: '2026-06-10T01:00:00.000Z',
                            },
                        ],
                    },
                }),
            ],
        },
    });

    const [note] = ledger.categories[0].resources[0].notes;
    assert.equal(note.text, '1. Male-Centric AAP\n[100626] - pasted date');
});

test('buildMyMapPdfLedger strips hidden control characters from older stored notes before PDF output', () => {
    const encodedText = '\u00006\u0000. `\u0000  `\u0000T\u0000C\u0000M\n'
        + '- Name of TCM collab: (Name / Non)';
    const ledger = buildMyMapPdfLedger({
        directory: { name: 'Encoded Notes Map' },
        presentation: {
            unmappedRows: [
                row({
                    resourceId: 17,
                    resourceType: 'soft',
                    name: 'Encoded Note Resource',
                    subCategory: 'Home care',
                    notes: {
                        items: [
                            {
                                id: 'encoded-note',
                                text: encodedText,
                                isShared: false,
                                createdAt: '2026-06-10T01:00:00.000Z',
                            },
                        ],
                    },
                }),
            ],
        },
    });

    const [note] = ledger.categories[0].resources[0].notes;
    assert.equal(note.text, '6. TCM\n- Name of TCM collab: (Name / Non)');
    assert.doesNotMatch(note.text, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/);
    assert.doesNotMatch(note.text, /`/);
});

test('buildMyMapPdfLedger breaks very long unspaced note tokens so the PDF table can wrap them', () => {
    const longToken = 'CulturalInclusiveness'.repeat(5);
    const ledger = buildMyMapPdfLedger({
        directory: { name: 'Long Token Map' },
        presentation: {
            unmappedRows: [
                row({
                    resourceId: 16,
                    resourceType: 'soft',
                    name: 'Long Token Resource',
                    subCategory: 'Home care',
                    notes: {
                        items: [
                            {
                                id: 'long-token-note',
                                text: `Review ${longToken} before sharing`,
                                isShared: true,
                                createdAt: '2026-06-10T01:00:00.000Z',
                            },
                        ],
                    },
                }),
            ],
        },
    });

    const [note] = ledger.categories[0].resources[0].notes;
    assert.match(note.text, /CulturalInclusivenessCulturalInclusive ness/);
    assert.doesNotMatch(note.text, new RegExp(longToken));
});

test('buildMyMapPdfLedger aligns raw structured timestamps after blank notes are filtered', () => {
    const ledger = buildMyMapPdfLedger({
        directory: { name: 'Filtered Timestamp Map' },
        presentation: {
            unmappedRows: [
                row({
                    resourceId: 11,
                    resourceType: 'soft',
                    name: 'Filtered Note Resource',
                    subCategory: 'Home care',
                    notes: {
                        items: [
                            {
                                id: 'blank-note',
                                text: '   ',
                                isShared: false,
                                createdAt: '2026-06-01T01:00:00.000Z',
                                updatedAt: '2026-06-02T01:00:00.000Z',
                            },
                            {
                                id: 'valid-note',
                                text: 'Use the valid note timestamps',
                                isShared: true,
                                createdAt: '2026-06-03T03:00:00.000Z',
                                updatedAt: '2026-06-04T04:00:00.000Z',
                            },
                        ],
                    },
                }),
            ],
        },
    });

    const notes = ledger.categories[0].resources[0].notes;
    assert.equal(notes.length, 1);
    assert.equal(notes[0].id, 'valid-note');
    assert.equal(notes[0].createdAt, '2026-06-03T03:00:00.000Z');
    assert.equal(notes[0].updatedAt, '2026-06-04T04:00:00.000Z');
});

test('buildMyMapPdfLedger filters raw note timestamps with the normalized 1000 character text limit', () => {
    const ledger = buildMyMapPdfLedger({
        directory: { name: 'Truncated Timestamp Map' },
        presentation: {
            unmappedRows: [
                row({
                    resourceId: 12,
                    resourceType: 'soft',
                    name: 'Truncated Note Resource',
                    subCategory: 'Home care',
                    notes: {
                        items: [
                            {
                                id: 'late-text-note',
                                text: `${' '.repeat(1000)}late text`,
                                isShared: false,
                                createdAt: '2026-06-05T05:00:00.000Z',
                                updatedAt: '2026-06-06T06:00:00.000Z',
                            },
                            {
                                id: 'valid-after-truncated-note',
                                text: 'Use this visible note',
                                isShared: true,
                                createdAt: '2026-06-07T07:00:00.000Z',
                                updatedAt: '2026-06-08T08:00:00.000Z',
                            },
                        ],
                    },
                }),
            ],
        },
    });

    const notes = ledger.categories[0].resources[0].notes;
    assert.equal(notes.length, 1);
    assert.equal(notes[0].id, 'valid-after-truncated-note');
    assert.equal(notes[0].createdAt, '2026-06-07T07:00:00.000Z');
    assert.equal(notes[0].updatedAt, '2026-06-08T08:00:00.000Z');
});

test('buildMyMapPdfLedger sanitizes malformed raw structured note timestamps', () => {
    const ledger = buildMyMapPdfLedger({
        directory: { name: 'Malformed Timestamp Map' },
        presentation: {
            unmappedRows: [
                row({
                    resourceId: 13,
                    resourceType: 'soft',
                    name: 'Malformed Timestamp Resource',
                    subCategory: 'Home care',
                    notes: {
                        notesUpdatedAt: '2026-06-09T09:00:00.000Z',
                        items: [
                            {
                                id: 'malformed-timestamps',
                                text: 'Do not expose malformed timestamps',
                                isShared: false,
                                createdAt: 'not-a-date',
                                updatedAt: 'also-not-a-date',
                            },
                        ],
                    },
                }),
            ],
        },
    });

    const [note] = ledger.categories[0].resources[0].notes;
    assert.equal(note.createdAt, null);
    assert.equal(note.updatedAt, null);
});
