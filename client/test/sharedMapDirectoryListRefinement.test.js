import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sharedMapDirectorySource = readFileSync(
    new URL('../src/components/SharedMapDirectoryList.jsx', import.meta.url),
    'utf8',
);
const resourceRowIconSource = readFileSync(
    new URL('../src/components/ResourceRowIcon.jsx', import.meta.url),
    'utf8',
);

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker);
    assert.notEqual(start, -1, `${startMarker} should exist`);
    assert.notEqual(end, -1, `${endMarker} should exist`);
    assert.ok(end > start, `${endMarker} should follow ${startMarker}`);
    return source.slice(start, end);
}

test('list-only resource badges use the row logo before falling back to icon artwork', () => {
    assert.match(resourceRowIconSource, /logoUrl\s*=\s*null/);
    assert.match(resourceRowIconSource, /<img[\s\S]*src=\{logoUrl\}/);
    assert.match(sharedMapDirectorySource, /<ResourceRowIcon[\s\S]*logoUrl=\{row\.logoUrl\}/);
});

test('interactive My Map cards avoid fixed pixel sizing so font controls can resize them', () => {
    const cardSource = sourceBetween(
        sharedMapDirectorySource,
        'function HiddenLogoSlot',
        'function DirectoryUnmappedSection',
    );

    assert.equal(/text-\[(?:9|10|11|12|14|15|17)px\]/.test(cardSource), false);
    assert.equal(/h-\[(?:34|38|42|46)px\]|w-\[(?:34|38|42|46)px\]/.test(cardSource), false);
    assert.equal(/fontSize:\s*[^,\n]*px/.test(cardSource), false);
});

test('map notes render markdown through the safe MarkdownLiteText component', () => {
    const notesSource = sourceBetween(
        sharedMapDirectorySource,
        'function SharedResourceNotes',
        'function MapNotesOverlay',
    );

    assert.match(sharedMapDirectorySource, /import MarkdownLiteText from '\.\/MarkdownLiteText\.jsx';/);
    assert.match(notesSource, /<MarkdownLiteText[\s\S]*text=\{note\.text\}/);
    assert.doesNotMatch(notesSource, /dangerouslySetInnerHTML/);
});

test('map notes editor exposes a markdown helper toolbar without changing autosave payloads', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(sharedMapDirectorySource, /applyMapNoteMarkdownAction/);
    assert.match(editorSource, /mapNoteMarkdownBold/);
    assert.match(editorSource, /mapNoteMarkdownBulletList/);
    assert.match(editorSource, /mapNoteMarkdownPreview/);
    assert.match(editorSource, /updateDraftNote\(note\.clientId, \{ text:/);
    assert.match(editorSource, /const payload = buildMapNotesSavePayload\(getCurrentDraftNotes\(\)\);/);
    assert.doesNotMatch(editorSource, /\bmarkdown\s*:/);
    assert.doesNotMatch(editorSource, /\bformat\s*:/);
});

test('map notes editor auto-sizes note textareas instead of using an inner scrollbar', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(sharedMapDirectorySource, /resizeTextareaToContent/);
    assert.match(editorSource, /Object\.values\(noteTextareaRefs\.current\)\.forEach\(\(textarea\) => resizeTextareaToContent\(textarea\)\)/);
    assert.match(editorSource, /resizeTextareaToContent\(event\.currentTarget\)/);
    assert.match(editorSource, /resizeTextareaToContent\(element\)/);
    assert.match(editorSource, /overflow-hidden/);
});

test('map notes preview toggles in place instead of adding a second note body', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(editorSource, /const isPreviewing = Boolean\(previewNoteIds\[note\.clientId\]\);/);
    assert.match(editorSource, /\{isPreviewing \? \(/);
    assert.match(editorSource, /<MarkdownLiteText[\s\S]*text=\{note\.text\}/);
    assert.doesNotMatch(editorSource, /previewNoteIds\[note\.clientId\] && note\.text\.trim\(\) \? \(/);
});

test('map notes autosave status reserves space so saving feedback does not shift the editor', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(editorSource, /aria-live="polite"/);
    assert.match(editorSource, /min-h-10/);
    assert.match(editorSource, /saveState !== 'idle'/);
});
