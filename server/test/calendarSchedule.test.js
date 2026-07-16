import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildCalendarScheduleInsert,
    buildCalendarScheduleUpdate,
    expandCalendarSchedule,
    normalizeCalendarScheduleInput,
} from '../src/utils/calendarSchedule.js';

test('calendar schedule normalizes a reviewed one-time Singapore session', () => {
    const schedule = normalizeCalendarScheduleInput({
        enabled: true,
        startsAt: '2026-07-21T10:00:00+08:00',
        endsAt: '2026-07-21T11:30:00+08:00',
        recurrence: 'once',
        timezone: 'Asia/Singapore',
        status: 'active',
    });

    assert.equal(schedule.startsAt.toISOString(), '2026-07-21T02:00:00.000Z');
    assert.equal(schedule.endsAt.toISOString(), '2026-07-21T03:30:00.000Z');
    assert.deepEqual(schedule.weekdays, []);
});

test('weekly calendar expansion follows Singapore weekdays and session duration', () => {
    const asset = {
        id: 42,
        name: 'Neighbourhood exercise',
        calendarEnabled: true,
        calendarStartsAt: new Date('2026-07-21T02:00:00.000Z'),
        calendarEndsAt: new Date('2026-07-21T03:00:00.000Z'),
        calendarRecurrence: 'weekly',
        calendarWeekdays: [2, 4],
        calendarRepeatUntil: new Date('2026-07-31T15:59:59.000Z'),
        calendarTimezone: 'Asia/Singapore',
        calendarStatus: 'active',
        calendarRevision: 3,
    };

    const occurrences = expandCalendarSchedule(
        asset,
        '2026-07-20T16:00:00.000Z',
        '2026-08-01T16:00:00.000Z',
    );

    assert.deepEqual(
        occurrences.map((occurrence) => occurrence.startsAt),
        [
            '2026-07-21T02:00:00.000Z',
            '2026-07-23T02:00:00.000Z',
            '2026-07-28T02:00:00.000Z',
            '2026-07-30T02:00:00.000Z',
        ],
    );
    assert.ok(occurrences.every((occurrence) => (
        new Date(occurrence.endsAt) - new Date(occurrence.startsAt) === 60 * 60 * 1000
    )));
});

test('calendar schedule revisions increment only for meaningful schedule changes', () => {
    const existing = {
        calendarEnabled: true,
        calendarStartsAt: new Date('2026-07-21T02:00:00.000Z'),
        calendarEndsAt: new Date('2026-07-21T03:00:00.000Z'),
        calendarRecurrence: 'once',
        calendarWeekdays: [],
        calendarRepeatUntil: null,
        calendarTimezone: 'Asia/Singapore',
        calendarStatus: 'active',
        calendarRevision: 4,
    };
    const unchanged = buildCalendarScheduleUpdate(existing, {
        enabled: true,
        startsAt: '2026-07-21T10:00:00+08:00',
        endsAt: '2026-07-21T11:00:00+08:00',
        recurrence: 'once',
        weekdays: [],
        timezone: 'Asia/Singapore',
        status: 'active',
    });
    const changed = buildCalendarScheduleUpdate(existing, {
        enabled: true,
        startsAt: '2026-07-21T10:30:00+08:00',
        endsAt: '2026-07-21T11:30:00+08:00',
        recurrence: 'once',
        weekdays: [],
        timezone: 'Asia/Singapore',
        status: 'active',
    });

    assert.deepEqual(unchanged, {});
    assert.equal(changed.calendarRevision, 5);
    assert.ok(changed.calendarUpdatedAt instanceof Date);
});

test('disabled schedules are inert and start at revision zero', () => {
    const fields = buildCalendarScheduleInsert({ enabled: false });

    assert.equal(fields.calendarEnabled, false);
    assert.equal(fields.calendarRevision, 0);
    assert.equal(fields.calendarStartsAt, null);
    assert.deepEqual(expandCalendarSchedule({ id: 1, ...fields }, new Date(), new Date(Date.now() + 1000)), []);
});

test('calendar rejects unsupported timezones and invalid end times', () => {
    assert.throws(
        () => normalizeCalendarScheduleInput({
            enabled: true,
            startsAt: '2026-07-21T10:00:00+08:00',
            timezone: 'UTC',
        }),
        /Asia\/Singapore/,
    );
    assert.throws(
        () => normalizeCalendarScheduleInput({
            enabled: true,
            startsAt: '2026-07-21T10:00:00+08:00',
            endsAt: '2026-07-21T09:00:00+08:00',
        }),
        /later than the start/,
    );
});
