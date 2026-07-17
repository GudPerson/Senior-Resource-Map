import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildSchedulePlanForm,
    buildSchedulePlanPreviewText,
    getSchedulePlanValidationError,
    schedulePlanToApi,
} from '../src/lib/offeringSchedule.js';

test('Offering schedule form round-trips individual and weekly Singapore sessions', () => {
    const form = buildSchedulePlanForm({
        schedulePlan: {
            enabled: true,
            notes: 'Bring water.',
            entries: [
                {
                    key: 'one',
                    type: 'once',
                    startsAt: '2026-07-20T01:00:00.000Z',
                    endsAt: '2026-07-20T02:00:00.000Z',
                    status: 'active',
                },
                {
                    key: 'weekly',
                    type: 'weekly',
                    startsAt: '2026-07-21T02:00:00.000Z',
                    endsAt: '2026-07-21T03:00:00.000Z',
                    weekdays: [2],
                    repeatUntil: '2026-08-25T02:00:00.000Z',
                    status: 'active',
                },
            ],
        },
    });

    assert.equal(getSchedulePlanValidationError(form), '');
    const api = schedulePlanToApi(form);
    assert.equal(api.entries[0].startsAt, '2026-07-20T01:00:00.000Z');
    assert.equal(api.entries[1].repeatUntil, '2026-08-25T02:00:00.000Z');
    assert.match(buildSchedulePlanPreviewText(form), /Every Tue/);
    assert.match(buildSchedulePlanPreviewText(form), /Bring water\./);
});

test('Offering schedule form rejects missing and duplicate rows', () => {
    assert.match(
        getSchedulePlanValidationError({ enabled: true, entries: [] }),
        /Add at least one session/,
    );

    const duplicate = {
        type: 'once',
        startsAt: '2026-07-20T09:00',
        endsAt: '2026-07-20T10:00',
        weekdays: [],
        repeatUntil: '',
        status: 'active',
    };
    assert.match(
        getSchedulePlanValidationError({ enabled: true, entries: [duplicate, { ...duplicate }] }),
        /duplicates another schedule row/,
    );
});

test('legacy one-row schedule opens in the new editor without data loss', () => {
    const form = buildSchedulePlanForm({
        calendarSchedule: {
            enabled: true,
            startsAt: '2026-07-20T01:00:00.000Z',
            endsAt: '2026-07-20T02:00:00.000Z',
            recurrence: 'once',
            status: 'active',
        },
    });

    assert.equal(form.enabled, true);
    assert.equal(form.entries.length, 1);
    assert.equal(form.entries[0].startsAt, '2026-07-20T09:00');
});

test('legacy public schedule text remains visible until reviewed sessions replace it', () => {
    const form = buildSchedulePlanForm({
        schedule: 'Call the centre for the next session.',
        calendarScheduleSource: 'legacy',
        schedulePlan: { enabled: false, notes: '', entries: [] },
    });

    assert.equal(form.enabled, false);
    assert.equal(form.legacyText, 'Call the centre for the next session.');
    assert.deepEqual(schedulePlanToApi(form), { enabled: false, notes: '', entries: [] });
});
