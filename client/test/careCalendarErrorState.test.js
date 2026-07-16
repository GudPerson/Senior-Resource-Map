import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
    new URL('../src/pages/dashboard/CareCalendarPage.jsx', import.meta.url),
    'utf8',
);

test('Care Calendar hides implementation errors and does not show an empty state after an initial load failure', () => {
    assert.match(source, /setError\(t\('careCalendarLoadFailed'\)\)/);
    assert.match(source, /error && !calendar \? null/);
});
