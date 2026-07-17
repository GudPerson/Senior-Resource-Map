import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controllerSource = readFileSync(
    new URL('../src/controllers/calendarController.js', import.meta.url),
    'utf8',
);
const schemaSource = readFileSync(
    new URL('../src/db/schema.js', import.meta.url),
    'utf8',
);

test('Care Calendar plans by schedule row and occurrence time', () => {
    assert.match(controllerSource, /sourceScheduleEntryKey: optionalOneLineTextSchema\(80\)/);
    assert.match(controllerSource, /occurrence\.scheduleEntryKey === body\.sourceScheduleEntryKey/);
    assert.match(controllerSource, /matchingOccurrence\.status !== 'active'/);
    assert.match(controllerSource, /sourceScheduleEntryKey: matchingOccurrence\.scheduleEntryKey/);
    assert.match(schemaSource, /sourceScheduleEntryKey: varchar\('source_schedule_entry_key'/);
    assert.match(schemaSource, /coalesce\(\$\{table\.sourceScheduleEntryKey\}, 'legacy-primary'\)/);
});
