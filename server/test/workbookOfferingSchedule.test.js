import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWorkbookSchedulePlan } from '../src/controllers/workbookController.js';

test('workbook exact session lines become canonical schedule rows', () => {
    const plan = buildWorkbookSchedulePlan({
        schedule: '20 July 2026 (Monday), 9am-10am\n27 July 2026 (Monday), 9am-10am',
        scheduleNotes: 'Bring water.',
    });

    assert.equal(plan.enabled, true);
    assert.equal(plan.entries.length, 2);
    assert.equal(plan.entries[0].startsAt, '2026-07-20T01:00:00.000Z');
    assert.equal(plan.notes, 'Bring water.');
});

test('blank workbook schedule preserves existing data unless clearing is explicit', () => {
    assert.equal(buildWorkbookSchedulePlan({ schedule: '' }), null);
    assert.equal(buildWorkbookSchedulePlan({ scheduleEntriesJson: '[]' }), null);
    assert.deepEqual(buildWorkbookSchedulePlan({ clearSchedule: 'TRUE' }), {
        enabled: false,
        notes: '',
        entries: [],
    });
});

test('workbook canonical JSON round-trips recurring schedule rows', () => {
    const plan = buildWorkbookSchedulePlan({
        schedule: 'Every Monday, 9:00am-10:00am from 20 Jul 2026 until 31 Aug 2026',
        scheduleEntriesJson: JSON.stringify([{
            key: 'weekly-one',
            type: 'weekly',
            startsAt: '2026-07-20T01:00:00.000Z',
            endsAt: '2026-07-20T02:00:00.000Z',
            weekdays: [1],
            repeatUntil: '2026-08-31T01:00:00.000Z',
            status: 'active',
        }]),
    });

    assert.equal(plan.entries[0].type, 'weekly');
    assert.deepEqual(plan.entries[0].weekdays, [1]);
});
