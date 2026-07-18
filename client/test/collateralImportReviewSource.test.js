import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wizardSource = readFileSync(
    new URL('../src/components/SoftAssetCollateralImportWizard.jsx', import.meta.url),
    'utf8',
);
const scheduleEditorSource = readFileSync(
    new URL('../src/components/OfferingScheduleEntriesEditor.jsx', import.meta.url),
    'utf8',
);

test('collateral review drops invalid cached schedule placeholders and explains manual recovery', () => {
    assert.match(wizardSource, /\.filter\(\(entry\) => Boolean\(entry\.startsAt\)\)/);
    assert.match(wizardSource, /No reliable date and time were detected\./);
    assert.match(wizardSource, /Schedule review needed/);
    assert.match(wizardSource, /sessionCount: scheduleEntries\.length/);
});

test('collateral review gives schedule cards full working width on ordinary desktops', () => {
    assert.match(wizardSource, /2xl:grid-cols-\[minmax\(0,1fr\)_280px\]/);
    assert.match(wizardSource, /order-first grid gap-4 md:grid-cols-2/);
    assert.match(wizardSource, /2xl:sticky 2xl:top-4/);
});

test('schedule review actions keep accessible touch targets', () => {
    assert.equal((scheduleEditorSource.match(/min-h-\[44px\]/g) || []).length >= 3, true);
    assert.match(wizardSource, /min-h-\[44px\].*Collapse/si);
});
