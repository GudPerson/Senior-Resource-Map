import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adminPageSource = readFileSync(new URL('../src/pages/dashboard/AdminPage.jsx', import.meta.url), 'utf8');

function sourceBetween(startMarker, endMarker) {
    const start = adminPageSource.indexOf(startMarker);
    const end = adminPageSource.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return adminPageSource.slice(start, end);
}

test('Admin Data Tools exposes a Group workbook card for profile and membership data', () => {
    const workbookRegistry = sourceBetween('const ASSET_WORKBOOKS = [', '];');
    const rulesCopy = sourceBetween('<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Workbook Rules</h3>', '</ul>');

    assert.match(workbookRegistry, /resourceType: 'groups'/);
    assert.match(workbookRegistry, /label: 'Groups'/);
    assert.match(workbookRegistry, /profile and direct members/i);
    assert.match(rulesCopy, /Group workbooks manage list-only profile and member links/i);
});
