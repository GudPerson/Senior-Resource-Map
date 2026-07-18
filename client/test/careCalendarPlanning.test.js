import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CARE_CALENDAR_VIEWS,
    buildCalendarEvents,
    buildMyPlanEvents,
    buildUpdateGroups,
    findPlanConflicts,
    getCalendarRange,
    getMonthGridDayKeys,
    getPlanningRange,
    partitionPlanEvents,
} from '../src/lib/careCalendarPlanning.js';

test('calendar ranges stay bounded for day week month and planning windows', () => {
    assert.deepEqual(getCalendarRange(CARE_CALENDAR_VIEWS.week, '2026-07-17').dayKeys, [
        '2026-07-12',
        '2026-07-13',
        '2026-07-14',
        '2026-07-15',
        '2026-07-16',
        '2026-07-17',
        '2026-07-18',
    ]);

    const monthKeys = getMonthGridDayKeys('2026-07-17');
    assert.equal(monthKeys.length, 42);
    assert.equal(monthKeys[0], '2026-06-28');
    assert.equal(monthKeys.at(-1), '2026-08-08');

    assert.deepEqual(getPlanningRange('2026-07-18'), {
        from: '2026-06-17T16:00:00.000Z',
        to: '2026-12-14T16:00:00.000Z',
    });
});

test('current planned sessions appear once in My Plans and carry review state', () => {
    const calendar = {
        occurrences: [{
            occurrenceId: 'soft:42:row-a:2026-07-20T02:00:00.000Z',
            softAssetId: 42,
            scheduleEntryKey: 'row-a',
            title: 'Line Dance',
            startsAt: '2026-07-20T02:00:00.000Z',
            endsAt: '2026-07-20T03:30:00.000Z',
            status: 'active',
            plannedItemId: 7,
            isPlanned: true,
        }],
        personalItems: [{
            id: 7,
            itemType: 'planned_session',
            softAssetId: 42,
            sourceScheduleEntryKey: 'row-a',
            sourceStartsAt: '2026-07-20T02:00:00.000Z',
            title: 'Line Dance',
            startsAt: '2026-07-20T02:00:00.000Z',
            endsAt: '2026-07-20T03:30:00.000Z',
            status: 'planned',
            sourceChanged: true,
            needsReview: true,
        }],
    };

    const events = buildCalendarEvents(calendar);
    assert.equal(events.length, 1);
    assert.equal(events[0].kind, 'saved_activity');
    assert.equal(events[0].isPlanned, true);
    assert.equal(events[0].needsReview, true);
    assert.equal(events[0].matchesCurrentSchedule, true);

    const plans = buildMyPlanEvents(calendar);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].id, 'soft:42:row-a:2026-07-20T02:00:00.000Z');
});

test('changed unmatched plans wait in Updates until acknowledgement archives them', () => {
    const stalePlan = {
        id: 8,
        itemType: 'planned_session',
        softAssetId: 42,
        sourceScheduleEntryKey: 'row-old',
        sourceStartsAt: '2026-07-19T02:00:00.000Z',
        title: 'Line Dance',
        startsAt: '2026-07-19T02:00:00.000Z',
        endsAt: '2026-07-19T03:30:00.000Z',
        status: 'planned',
        sourceChanged: true,
        needsReview: true,
    };
    const calendar = {
        occurrences: [{
            occurrenceId: 'soft:42:row-new:2026-07-20T02:00:00.000Z',
            softAssetId: 42,
            scheduleEntryKey: 'row-new',
            title: 'Line Dance',
            startsAt: '2026-07-20T02:00:00.000Z',
            endsAt: '2026-07-20T03:30:00.000Z',
            status: 'active',
        }],
        personalItems: [stalePlan],
    };

    const groups = buildUpdateGroups(calendar);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].affectedPlans.length, 1);
    assert.equal(groups[0].replacementOptions.length, 1);

    const pendingPlans = buildMyPlanEvents(calendar);
    assert.equal(pendingPlans.length, 1);
    assert.equal(partitionPlanEvents(pendingPlans, new Date('2026-07-18T00:00:00.000Z')).upcoming.length, 1);

    const acknowledgedPlans = buildMyPlanEvents({
        ...calendar,
        personalItems: [{ ...stalePlan, needsReview: false }],
    });
    const partitioned = partitionPlanEvents(acknowledgedPlans, new Date('2026-07-18T00:00:00.000Z'));
    assert.equal(partitioned.upcoming.length, 0);
    assert.equal(partitioned.history.length, 1);
});

test('planning conflicts identify exact overlaps and same-start uncertain events', () => {
    const candidate = {
        id: 'new',
        startsAt: '2026-07-20T02:00:00.000Z',
        endsAt: '2026-07-20T03:30:00.000Z',
    };
    const conflicts = findPlanConflicts(candidate, [{
        id: 'overlap',
        startsAt: '2026-07-20T03:00:00.000Z',
        endsAt: '2026-07-20T04:00:00.000Z',
        status: 'planned',
    }, {
        id: 'possible',
        startsAt: '2026-07-20T02:00:00.000Z',
        endsAt: null,
        status: 'planned',
    }, {
        id: 'cancelled',
        startsAt: '2026-07-20T02:30:00.000Z',
        endsAt: '2026-07-20T03:15:00.000Z',
        status: 'cancelled',
    }]);

    assert.deepEqual(conflicts.map((item) => [item.event.id, item.exact]), [
        ['overlap', true],
        ['possible', false],
    ]);
});
