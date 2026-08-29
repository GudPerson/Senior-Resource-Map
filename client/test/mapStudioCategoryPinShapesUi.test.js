import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const modalSource = readSource('../src/components/MyMapCategoryOrderModal.jsx');
const ownerPageSource = readSource('../src/pages/MyMapDetailPage.jsx');
const directoryMapSource = readSource('../src/components/DirectoryMap.jsx');
const directoryListSource = readSource('../src/components/SharedMapDirectoryList.jsx');
const printViewSource = readSource('../src/components/DirectoryPrintView.jsx');
const embedPresentationSource = readSource('../src/lib/embedMapPresentation.js');

test('Refine categories exposes five accessible numbered-pin shape choices per category', () => {
    assert.match(modalSource, /CATEGORY_PIN_SHAPE_OPTIONS\.map/);
    assert.match(modalSource, /type="radio"/);
    assert.match(modalSource, /checked=\{selected\}/);
    assert.match(modalSource, /name=\{`category-pin-shape-\$\{category\.key\}`\}/);
    assert.match(modalSource, /focus-within:ring-4/);
    assert.match(modalSource, /min-h-11/);
    assert.match(modalSource, /categoryShapes: normalizeCategoryPinShapes\(categoryShapes\)/);
    assert.match(modalSource, /t\('refineCategorySequence'\)/);
});

test('category refinements stage shapes in the selected view without auto-saving Studio', () => {
    assert.match(ownerPageSource, /handleUpdateCategoryOrder\(\{ categoryOrder, categoryShapes, categoryStyles \}\)/);
    assert.match(ownerPageSource, /patchDesign\(\{[\s\S]*pins: \{ categoryShapes, categoryStyles \}/);
    assert.doesNotMatch(ownerPageSource, /handleUpdateCategoryOrder[\s\S]{0,900}saveMapStudio/);
    assert.match(ownerPageSource, /initialCategoryShapes=\{mapStudioRuntimeSnapshot\?\.design\?\.pins\?\.categoryShapes\}/);
});

test('category refinements stage numbered-pin fill and ring colours with the selected view', () => {
    assert.match(modalSource, /initialCategoryStyles/);
    assert.match(modalSource, /type="color"/);
    assert.match(modalSource, /categoryStyles: normalizeCategoryPinStyles\(categoryStyles\)/);
    assert.match(ownerPageSource, /handleUpdateCategoryOrder\(\{ categoryOrder, categoryShapes, categoryStyles \}\)/);
    assert.match(ownerPageSource, /pins: \{ categoryShapes, categoryStyles \}/);
    assert.match(directoryMapSource, /numberedPinStylesByCategory/);
    assert.match(directoryListSource, /numberedPinStylesByCategory/);
    assert.match(printViewSource, /numberedPinStylesByCategory=\{printMapState\?\.numberedPinStylesByCategory\}/);
});

test('category refinements offer automatic or custom number colour with a renderer-backed preview', () => {
    assert.match(modalSource, /data-category-pin-preview=\{category\.key\}/);
    assert.match(modalSource, /labelColor=\{pinStyle\.labelColor\}/);
    assert.match(modalSource, /label=\{index \+ 1\}/);
    assert.match(modalSource, /preview/);
    assert.match(modalSource, /getCategoryPinLabelColorOverride/);
    assert.match(modalSource, /categoryPinNumberColourAutomatic/);
    assert.match(modalSource, /categoryPinNumberColourCustom/);
    assert.match(modalSource, /updateCategoryColor\(category, 'labelColor'/);
    assert.match(directoryMapSource, /labelColor: style\.labelColor/);
    assert.match(directoryListSource, /labelColor=\{numberedPinStyle\?\.labelColor\}/);
});

test('numbered pin geometry reaches interactive map cards and Export View', () => {
    assert.match(directoryMapSource, /data-category-pin-shape/);
    assert.match(directoryMapSource, /getCategoryPinShapePath/);
    assert.match(directoryListSource, /CategoryPinShapeBadge/);
    assert.match(directoryListSource, /numberedPinShape=\{getCategoryPinShape/);
    assert.match(printViewSource, /numberedPinShapesByCategory=\{printMapState\?\.numberedPinShapesByCategory\}/);
});

test('the frozen embed presentation remains on its explicit public allowlist', () => {
    assert.doesNotMatch(embedPresentationSource, /numberedPinShapesByCategory/);
    assert.doesNotMatch(embedPresentationSource, /categoryShapes/);
    assert.doesNotMatch(embedPresentationSource, /categoryStyles|numberedPinStylesByCategory|resourceDisplay/);
});
