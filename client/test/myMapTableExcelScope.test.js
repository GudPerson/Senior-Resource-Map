import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const ownerPageSource = readSource('../src/pages/MyMapDetailPage.jsx');
const printViewSource = readSource('../src/components/DirectoryPrintView.jsx');
const directoryListSource = readSource('../src/components/SharedMapDirectoryList.jsx');
const resourceTableSource = readSource('../src/components/MyMapResourceTable.jsx');
const sharedPageSource = readSource('../src/pages/SharedMapPage.jsx');
const embedPageSource = readSource('../src/pages/EmbeddedMapPage.jsx');

test('table display and Excel export are wired only into the owner My Map experience', () => {
    assert.match(ownerPageSource, /MyMapExcelExportButton/);
    assert.match(ownerPageSource, /resourceDisplay=\{mapStudioInteractiveModel\?\.layout\?\.resourceDisplay\}/);
    assert.match(printViewSource, /resourceDisplay=\{printMapState\?\.resourceDisplay\}/);
    assert.doesNotMatch(sharedPageSource, /resourceDisplay|MyMapExcelExportButton/);
    assert.doesNotMatch(embedPageSource, /resourceDisplay|MyMapExcelExportButton/);
});

test('table display reuses Card detail and column settings with category-only pin shapes', () => {
    assert.match(directoryListSource, /labelDetail=\{printLabelDetail\}/);
    assert.match(directoryListSource, /columnCount=\{ownerTableColumnCount\}/);
    assert.match(directoryListSource, /interactiveResourceColumnCount/);
    assert.match(directoryListSource, /interactiveSideResourceColumnCount/);
    assert.match(resourceTableSource, /getMyMapResourceTableDetailVisibility/);
    assert.match(resourceTableSource, /splitMyMapResourceTableCategories/);
    assert.match(resourceTableSource, /<ResourceRowIcon/);
    assert.match(resourceTableSource, /data-my-map-table-number-index="true"/);
    assert.match(resourceTableSource, /<CategoryPinShapeBadge[\s\S]*compact/);
    assert.doesNotMatch(resourceTableSource, /label=\{asset\.sourceMapNumber\}/);
});
