import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const myMapsControllerSource = readFileSync(
    new URL('../src/controllers/myMapsController.js', import.meta.url),
    'utf8',
);
const sharedNoteTranslationsSource = readFileSync(
    new URL('../src/utils/sharedNoteTranslations.js', import.meta.url),
    'utf8',
);

test('My Map note routes keep the same longer per-note text limit as shared note translations', () => {
    assert.match(myMapsControllerSource, /MY_MAP_NOTE_MAX_LENGTH = 3000/);
    assert.match(myMapsControllerSource, /text: optionalTextSchema\(MY_MAP_NOTE_MAX_LENGTH\)/);
    assert.match(myMapsControllerSource, /privateNote: optionalTextSchema\(MY_MAP_NOTE_MAX_LENGTH\)/);
    assert.match(myMapsControllerSource, /handoffNote: optionalTextSchema\(MY_MAP_NOTE_MAX_LENGTH\)/);
    assert.match(sharedNoteTranslationsSource, /MAX_NOTE_TRANSLATION_LENGTH = 3000/);
});
