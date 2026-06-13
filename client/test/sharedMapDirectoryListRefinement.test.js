import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sharedMapDirectorySource = readFileSync(
    new URL('../src/components/SharedMapDirectoryList.jsx', import.meta.url),
    'utf8',
);
const myMapDetailPageSource = readFileSync(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);
const apiSource = readFileSync(
    new URL('../src/lib/api.js', import.meta.url),
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

test('map notes preview toggle uses explicit preview and edit labels', () => {
    const toolbarSource = sourceBetween(
        sharedMapDirectorySource,
        'function MapNoteToolbarButton',
        'function createEmptyDraftNote',
    );
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(sharedMapDirectorySource, /\bPencil\b/);
    assert.match(toolbarSource, /showLabel = false/);
    assert.match(toolbarSource, /\{showLabel \? <span/);
    assert.match(editorSource, /label=\{isPreviewing \? t\('mapNoteMarkdownEdit'\) : t\('mapNoteMarkdownPreview'\)\}/);
    assert.match(editorSource, /showLabel/);
    assert.match(editorSource, /\{isPreviewing \? <Pencil size=\{15\} strokeWidth=\{2\.3\} \/> : <Eye size=\{15\} strokeWidth=\{2\.3\} \/>\}/);
});

test('map notes editor keeps textarea identity stable when autosave returns new note ids', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(sharedMapDirectorySource, /mergeRemoteNotesWithStableDrafts/);
    assert.match(editorSource, /const localDraftNotes = getCurrentDraftNotes\(\);/);
    assert.match(editorSource, /notes: mergeRemoteNotesWithStableDrafts\(localDraftNotes, nextDrafts\[rowKey\]\.notes\)/);
});

test('map notes editor keeps typing local until the owner exits the note flow', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );
    const overlaySource = sourceBetween(
        sharedMapDirectorySource,
        'function MapNotesOverlay',
        'const DIRECTORY_DESKTOP_LAYOUT_MIN_WIDTH',
    );

    assert.doesNotMatch(editorSource, /scheduleAutosave/);
    assert.doesNotMatch(editorSource, /onBlur=\{\(\) => void flush/);
    assert.match(editorSource, /onUpdateResourceNotesRef\.current\(saveRowRef, payload, \{ keepalive \}\)/);
    assert.match(editorSource, /flushDraftChanges\(\{ keepalive: true \}\)/);
    assert.match(editorSource, /onRegisterFlush\?\.\(flushDraftChanges\)/);
    assert.match(overlaySource, /flushEditorBeforeExit/);
    assert.match(overlaySource, /onClick=\{\(\) => void handleClose\(\)\}/);
    assert.match(overlaySource, /onClick=\{\(\) => void handleBackToList\(\)\}/);
    assert.match(myMapDetailPageSource, /handleUpdateResourceNotes\(row, notes, options = \{\}\)/);
    assert.match(myMapDetailPageSource, /updateMyMapAssetNotes\(directory\.id, row\.resourceType, row\.resourceId, notes, options\)/);
    assert.match(apiSource, /keepalive = false/);
    assert.match(apiSource, /\.\.\.\(keepalive \? \{ keepalive: true \} : \{\}\)/);
});

test('map notes editor shows the note character limit instead of failing silently', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(sharedMapDirectorySource, /MAP_NOTE_MAX_LENGTH/);
    assert.match(editorSource, /maxLength=\{MAP_NOTE_MAX_LENGTH\}/);
    assert.match(editorSource, /mapNoteCharacterCount/);
    assert.match(editorSource, /mapNoteLimitReached/);
});

test('map notes editor applies the shared note limit to every local text update path', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(editorSource, /values\.text\.slice\(0, MAP_NOTE_MAX_LENGTH\)/);
    assert.match(editorSource, /result\.value\.slice\(0, MAP_NOTE_MAX_LENGTH\)/);
    assert.doesNotMatch(editorSource, /slice\(0, 1000\)/);
});

test('map notes editor keeps ordinary typing out of the visible saving state', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(editorSource, /const \[showSaveStatus, setShowSaveStatus\] = useState\(false\)/);
    assert.match(editorSource, /setShowSaveStatus\(true\)/);
    assert.match(editorSource, /setShowSaveStatus\(false\)/);
    assert.match(editorSource, /const shouldShowSaveStatus = showSaveStatus && saveState !== 'idle' && !didSaveFail/);
    assert.match(editorSource, /updateDraftNote\(note\.clientId, \{ text: event\.target\.value \}\)/);
    assert.doesNotMatch(editorSource, /updateDraftNote\(note\.clientId, \{ text: event\.target\.value \}, \{ immediate: true \}\)/);
});

test('map notes save status reserves space so saving feedback does not shift the editor', () => {
    const editorSource = sourceBetween(
        sharedMapDirectorySource,
        'function ResourceNotesEditor',
        'function ResourceNotesReadOnly',
    );

    assert.match(editorSource, /aria-live="polite"/);
    assert.match(editorSource, /min-h-10/);
    assert.match(editorSource, /saveState !== 'idle'/);
});
