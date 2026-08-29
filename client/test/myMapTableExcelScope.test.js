import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const ownerPageSource = readSource('../src/pages/MyMapDetailPage.jsx');
const printViewSource = readSource('../src/components/DirectoryPrintView.jsx');
const sharedPageSource = readSource('../src/pages/SharedMapPage.jsx');
const embedPageSource = readSource('../src/pages/EmbeddedMapPage.jsx');

test('table display and Excel export are wired only into the owner My Map experience', () => {
    assert.match(ownerPageSource, /MyMapExcelExportButton/);
    assert.match(ownerPageSource, /resourceDisplay=\{mapStudioInteractiveModel\?\.layout\?\.resourceDisplay\}/);
    assert.match(printViewSource, /resourceDisplay=\{printMapState\?\.resourceDisplay\}/);
    assert.doesNotMatch(sharedPageSource, /resourceDisplay|MyMapExcelExportButton/);
    assert.doesNotMatch(embedPageSource, /resourceDisplay|MyMapExcelExportButton/);
});
