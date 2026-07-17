import test from 'node:test';
import assert from 'node:assert/strict';

import {
    assertOfferingScheduleMutationIntent,
    buildOfferingScheduleMutation,
    buildOfferingScheduleSummary,
    buildOfferingScheduleVersionRows,
    expandOfferingSchedule,
    normalizeOfferingSchedulePlanInput,
    parseImportedScheduleSessions,
    serializeOfferingSchedulePlan,
} from '../src/utils/offeringSchedule.js';

test('Offering schedule accepts multiple individual and recurring rows', () => {
    const plan = normalizeOfferingSchedulePlanInput({
        enabled: true,
        notes: 'Registration required.',
        entries: [
            {
                key: 'single-session',
                type: 'once',
                startsAt: '2026-07-17T13:30:00+08:00',
                endsAt: '2026-07-17T15:30:00+08:00',
                status: 'active',
            },
            {
                key: 'weekly-series',
                type: 'weekly',
                startsAt: '2026-07-21T10:00:00+08:00',
                endsAt: '2026-07-21T11:00:00+08:00',
                weekdays: [2, 4],
                repeatUntil: '2026-07-31T23:59:00+08:00',
                status: 'active',
            },
        ],
    });

    assert.equal(plan.entries.length, 2);
    assert.equal(plan.entries[0].startsAt, '2026-07-17T05:30:00.000Z');
    assert.deepEqual(plan.entries[1].weekdays, [2, 4]);
    assert.match(buildOfferingScheduleSummary(plan), /17 Jul 2026/);
    assert.match(buildOfferingScheduleSummary(plan), /Every Tuesday, Thursday/);
    assert.match(buildOfferingScheduleSummary(plan), /Registration required/);
});

test('weekly schedules must start on one of their selected Singapore weekdays', () => {
    assert.throws(() => normalizeOfferingSchedulePlanInput({
        enabled: true,
        entries: [{
            key: 'mismatch',
            type: 'weekly',
            startsAt: '2026-07-18T10:00:00+08:00',
            endsAt: '2026-07-18T11:30:00+08:00',
            weekdays: [1, 3],
            repeatUntil: '2026-09-30T23:59:59+08:00',
            status: 'active',
        }],
    }), /must start on one of its selected repeat weekdays/);
});

test('Offering schedule expands all active rows without changing legacy visibility fields', () => {
    const asset = {
        id: 91,
        name: 'Movement programme',
        calendarRevision: 6,
        calendarScheduleSource: 'manual',
        calendarEntries: [
            {
                key: 'first',
                type: 'once',
                startsAt: '2026-07-20T02:00:00.000Z',
                endsAt: '2026-07-20T03:00:00.000Z',
                weekdays: [],
                repeatUntil: null,
                timezone: 'Asia/Singapore',
                status: 'active',
                note: '',
            },
            {
                key: 'second',
                type: 'once',
                startsAt: '2026-07-21T02:00:00.000Z',
                endsAt: null,
                weekdays: [],
                repeatUntil: null,
                timezone: 'Asia/Singapore',
                status: 'cancelled',
                note: 'Venue unavailable.',
            },
        ],
    };

    const occurrences = expandOfferingSchedule(
        asset,
        '2026-07-19T16:00:00.000Z',
        '2026-07-21T16:00:00.000Z',
    );
    assert.equal(occurrences.length, 2);
    assert.deepEqual(occurrences.map((row) => row.status), ['active', 'cancelled']);
    assert.match(occurrences[0].occurrenceId, /first/);
    assert.equal(occurrences[1].note, 'Venue unavailable.');
});

test('schedule row keys keep simultaneous session occurrences distinct', () => {
    const occurrences = expandOfferingSchedule({
        id: 92,
        name: 'Parallel sessions',
        calendarRevision: 2,
        calendarScheduleSource: 'manual',
        calendarEntries: [
            {
                key: 'room-a',
                type: 'once',
                startsAt: '2026-07-20T02:00:00.000Z',
                endsAt: '2026-07-20T03:00:00.000Z',
                weekdays: [],
                repeatUntil: null,
                timezone: 'Asia/Singapore',
                status: 'active',
                note: 'Room A',
            },
            {
                key: 'room-b',
                type: 'once',
                startsAt: '2026-07-20T02:00:00.000Z',
                endsAt: '2026-07-20T03:30:00.000Z',
                weekdays: [],
                repeatUntil: null,
                timezone: 'Asia/Singapore',
                status: 'active',
                note: 'Room B',
            },
        ],
    }, '2026-07-19T16:00:00.000Z', '2026-07-20T16:00:00.000Z');

    assert.equal(occurrences.length, 2);
    assert.notEqual(occurrences[0].occurrenceId, occurrences[1].occurrenceId);
    assert.deepEqual(occurrences.map((row) => row.scheduleEntryKey).sort(), ['room-a', 'room-b']);
});

test('Replacing a schedule increments one revision and keeps immutable version snapshots', () => {
    const existing = {
        id: 44,
        schedule: '21 Jul 2026, 10:00 am-11:00 am',
        scheduleNotes: null,
        calendarScheduleSource: 'manual',
        calendarRevision: 3,
        calendarEntries: [{
            key: 'old',
            type: 'once',
            startsAt: '2026-07-21T02:00:00.000Z',
            endsAt: '2026-07-21T03:00:00.000Z',
            weekdays: [],
            repeatUntil: null,
            timezone: 'Asia/Singapore',
            status: 'active',
            note: '',
        }],
    };
    const mutation = buildOfferingScheduleMutation(existing, {
        enabled: true,
        entries: [{
            key: 'replacement',
            type: 'once',
            startsAt: '2026-07-28T10:30:00+08:00',
            endsAt: '2026-07-28T11:30:00+08:00',
            status: 'active',
        }],
    }, { source: 'collateral_import' });

    assert.equal(mutation.changed, true);
    assert.equal(mutation.revision, 4);
    assert.equal(mutation.patch.calendarRevision, 4);
    assert.equal(mutation.patch.calendarEntries[0].key, 'replacement');
    assert.deepEqual(mutation.snapshots.map((row) => row.revision), [3, 4]);
    assert.deepEqual(
        buildOfferingScheduleVersionRows(existing.id, mutation, 7).map((row) => row.revision),
        [3, 4],
    );
});

test('Legacy one-row schedules remain readable until they are republished', () => {
    const plan = serializeOfferingSchedulePlan({
        calendarEnabled: true,
        calendarStartsAt: '2026-07-21T02:00:00.000Z',
        calendarEndsAt: '2026-07-21T03:00:00.000Z',
        calendarRecurrence: 'once',
        calendarWeekdays: [],
        calendarTimezone: 'Asia/Singapore',
        calendarStatus: 'active',
        calendarScheduleSource: 'legacy',
        calendarEntries: [],
    });

    assert.equal(plan.entries.length, 1);
    assert.equal(plan.entries[0].key, 'legacy-primary');
});

test('Collateral exact-session text becomes structured Singapore sessions and reports unclear lines', () => {
    const parsed = parseImportedScheduleSessions([
        '17 July 2026 (Friday), 1:30pm-3:30pm',
        '24/07/2026, 10am-11am',
        'Call the centre for timing',
    ]);

    assert.equal(parsed.entries.length, 2);
    assert.equal(parsed.entries[0].startsAt, '2026-07-17T05:30:00.000Z');
    assert.equal(parsed.entries[0].endsAt, '2026-07-17T07:30:00.000Z');
    assert.deepEqual(parsed.unparsed, ['Call the centre for timing']);
});

test('An empty import cannot silently clear an existing schedule', () => {
    const parsed = parseImportedScheduleSessions([], 'Timing to be confirmed');
    assert.deepEqual(parsed.entries, []);
    assert.deepEqual(parsed.unparsed, ['Timing to be confirmed']);
});

test('invalid calendar dates stay unparsed instead of rolling into another month', () => {
    const parsed = parseImportedScheduleSessions(['31 February 2026, 9am-10am']);
    assert.deepEqual(parsed.entries, []);
    assert.deepEqual(parsed.unparsed, ['31 February 2026, 9am-10am']);
});

test('disabling a schedule clears the public summary even when history notes are retained', () => {
    const existing = {
        id: 31,
        schedule: '20 Jul 2026, 9:00am-10:00am',
        scheduleNotes: 'Bring water.',
        calendarEntries: [{
            key: 'old-session',
            type: 'once',
            startsAt: '2026-07-20T01:00:00.000Z',
            endsAt: '2026-07-20T02:00:00.000Z',
            weekdays: [],
            repeatUntil: null,
            timezone: 'Asia/Singapore',
            status: 'active',
            note: '',
        }],
        calendarScheduleSource: 'manual',
        calendarEnabled: true,
        calendarRevision: 1,
    };
    const mutation = buildOfferingScheduleMutation(existing, {
        enabled: false,
        notes: 'Bring water.',
        entries: [],
    });

    assert.equal(mutation.patch.schedule, null);
    assert.equal(mutation.patch.calendarEnabled, false);
    assert.throws(
        () => assertOfferingScheduleMutationIntent(mutation, {
            action: 'publish',
            expectedRevision: 1,
        }),
        /confirmed Unpublish sessions action/,
    );
    assert.equal(assertOfferingScheduleMutationIntent(mutation, {
        action: 'unpublish',
        expectedRevision: 1,
    }), 1);
    assert.throws(
        () => assertOfferingScheduleMutationIntent(mutation, {
            action: 'unpublish',
            expectedRevision: 0,
        }),
        /changed after you opened it/,
    );
});

test('published schedule persists through reopen serialization and Care Calendar expansion', () => {
    const existing = {
        id: 168,
        name: 'Line Dance',
        schedule: null,
        scheduleNotes: null,
        calendarEntries: [],
        calendarScheduleSource: 'manual',
        calendarEnabled: false,
        calendarRevision: 2,
    };
    const mutation = buildOfferingScheduleMutation(existing, {
        enabled: true,
        notes: '',
        entries: [{
            key: 'line-dance-weekly',
            type: 'weekly',
            startsAt: '2026-07-20T10:00:00+08:00',
            endsAt: '2026-07-20T11:30:00+08:00',
            weekdays: [1, 3],
            repeatUntil: '2026-09-30T23:59:59.999+08:00',
            status: 'active',
        }],
    }, { source: 'manual' });

    assert.equal(assertOfferingScheduleMutationIntent(mutation, {
        action: 'publish',
        expectedRevision: 2,
    }), 2);

    const persisted = { ...existing, ...mutation.patch };
    const reopened = serializeOfferingSchedulePlan(persisted);
    const occurrences = expandOfferingSchedule(
        persisted,
        '2026-07-19T16:00:00.000Z',
        '2026-07-23T16:00:00.000Z',
    );

    assert.equal(reopened.enabled, true);
    assert.equal(reopened.entries.length, 1);
    assert.equal(reopened.entries[0].startsAt, '2026-07-20T02:00:00.000Z');
    assert.deepEqual(occurrences.map((row) => row.startsAt), [
        '2026-07-20T02:00:00.000Z',
        '2026-07-22T02:00:00.000Z',
    ]);
    assert.deepEqual(buildOfferingScheduleVersionRows(existing.id, mutation, 7).map((row) => row.revision), [2, 3]);
});
