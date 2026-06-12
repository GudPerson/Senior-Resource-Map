import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MAP_NOTES_AUTOSAVE_DELAY_MS,
    buildMapNotesAutosaveSignature,
    buildMapNotesSavePayload,
    shouldResetDraftsFromRemote,
} from '../src/lib/mapNotesAutosave.js';

test('buildMapNotesSavePayload keeps meaningful notes and drops blank drafts', () => {
    assert.deepEqual(
        buildMapNotesSavePayload([
            { id: 7, text: '  Call before referral  ', isShared: true },
            { id: 8, text: '   ', isShared: true },
            { text: ` ${'x'.repeat(1005)} `, isShared: false },
        ]),
        {
            notes: [
                { id: 7, text: 'Call before referral', isShared: true },
                { text: 'x'.repeat(1000), isShared: false },
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

test('autosave debounce waits long enough for a typing pause', () => {
    assert.ok(MAP_NOTES_AUTOSAVE_DELAY_MS >= 800);
    assert.ok(MAP_NOTES_AUTOSAVE_DELAY_MS <= 1200);
});
