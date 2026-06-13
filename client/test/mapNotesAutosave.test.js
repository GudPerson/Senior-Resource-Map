import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MAP_NOTE_MAX_LENGTH,
    buildMapNotesAutosaveSignature,
    buildMapNotesSavePayload,
    mergeRemoteNotesWithStableDrafts,
    shouldResetDraftsFromRemote,
} from '../src/lib/mapNotesAutosave.js';

test('map note text allows full meeting notes before truncating at the shared note limit', () => {
    assert.equal(MAP_NOTE_MAX_LENGTH, 3000);
});

test('buildMapNotesSavePayload keeps meaningful notes and drops blank drafts', () => {
    assert.deepEqual(
        buildMapNotesSavePayload([
            { id: 7, text: '  Call before referral  ', isShared: true },
            { id: 8, text: '   ', isShared: true },
            { text: ` ${'x'.repeat(MAP_NOTE_MAX_LENGTH + 5)} `, isShared: false },
        ]),
        {
            notes: [
                { id: 7, text: 'Call before referral', isShared: true },
                { text: 'x'.repeat(MAP_NOTE_MAX_LENGTH), isShared: false },
            ],
        },
    );
});

test('buildMapNotesAutosaveSignature normalizes drafts for stale-save checks', () => {
    assert.equal(
        buildMapNotesAutosaveSignature({
            notes: [
                { id: 7, text: '  Call before referral  ', isShared: true },
                { text: '', isShared: false },
            ],
        }),
        '7:1:Call before referral',
    );
});

test('shouldResetDraftsFromRemote keeps newer local edits while autosave is pending', () => {
    assert.equal(shouldResetDraftsFromRemote({
        previousRowKey: 'hard:1',
        nextRowKey: 'hard:1',
        localSignature: 'draft:newer',
        remoteSignature: 'draft:older',
        hasPendingSave: true,
        isSaving: false,
    }), false);

    assert.equal(shouldResetDraftsFromRemote({
        previousRowKey: 'hard:1',
        nextRowKey: 'hard:1',
        localSignature: 'draft:newer',
        remoteSignature: 'draft:older',
        hasPendingSave: false,
        isSaving: true,
    }), false);
});

test('shouldResetDraftsFromRemote accepts row changes and matching saved snapshots', () => {
    assert.equal(shouldResetDraftsFromRemote({
        previousRowKey: 'hard:1',
        nextRowKey: 'soft:2',
        localSignature: 'draft:newer',
        remoteSignature: 'draft:older',
        hasPendingSave: true,
        isSaving: true,
    }), true);

    assert.equal(shouldResetDraftsFromRemote({
        previousRowKey: 'hard:1',
        nextRowKey: 'hard:1',
        localSignature: 'draft:saved',
        remoteSignature: 'draft:saved',
        hasPendingSave: false,
        isSaving: false,
    }), true);
});

test('mergeRemoteNotesWithStableDrafts keeps editor identity when saved note ids churn', () => {
    const merged = mergeRemoteNotesWithStableDrafts(
        [
            {
                clientId: 'local-draft-1',
                id: null,
                text: 'APT 2.0 meeting notes',
                isShared: false,
            },
        ],
        [
            {
                clientId: 'note-431',
                id: 431,
                text: 'APT 2.0 meeting notes',
                isShared: false,
                updatedAt: '2026-06-13T08:00:00.000Z',
            },
        ],
    );

    assert.deepEqual(merged, [
        {
            clientId: 'local-draft-1',
            id: 431,
            text: 'APT 2.0 meeting notes',
            isShared: false,
            updatedAt: '2026-06-13T08:00:00.000Z',
        },
    ]);
});

test('mergeRemoteNotesWithStableDrafts uses remote identity for changed remote content', () => {
    const merged = mergeRemoteNotesWithStableDrafts(
        [
            {
                clientId: 'local-draft-1',
                id: 7,
                text: 'Old note',
                isShared: false,
            },
        ],
        [
            {
                clientId: 'note-431',
                id: 431,
                text: 'Admin changed note',
                isShared: false,
            },
        ],
    );

    assert.equal(merged[0].clientId, 'note-431');
});
