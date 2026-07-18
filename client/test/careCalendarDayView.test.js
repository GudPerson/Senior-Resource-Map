import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    getSingaporeDayRange,
    getSingaporeWeekDayKeys,
    getTimelineHours,
    shiftSingaporeDayKey,
} from '../src/lib/careCalendarDay.js';

const pageSource = readFileSync(
    new URL('../src/pages/dashboard/CareCalendarPage.jsx', import.meta.url),
    'utf8',
);
const eventCardSource = readFileSync(
    new URL('../src/components/calendar/CalendarEventCard.jsx', import.meta.url),
    'utf8',
);
const dayViewSource = readFileSync(
    new URL('../src/components/calendar/DayCalendarView.jsx', import.meta.url),
    'utf8',
);
const periodViewsSource = readFileSync(
    new URL('../src/components/calendar/CalendarPeriodViews.jsx', import.meta.url),
    'utf8',
);

test('Care Calendar can still request one exact Singapore day and navigates across date boundaries', () => {
    assert.deepEqual(getSingaporeDayRange('2026-07-17'), {
        from: '2026-07-16T16:00:00.000Z',
        to: '2026-07-17T16:00:00.000Z',
    });
    assert.equal(shiftSingaporeDayKey('2026-07-31', 1), '2026-08-01');
    assert.equal(shiftSingaporeDayKey('2026-01-01', -1), '2025-12-31');
    assert.match(pageSource, /getCalendarRange\(activeView, selectedDayKey\)/);
    assert.match(pageSource, /scope: planningSection \? 'plans' : 'all'/);
});

test('the compact date navigator shows the selected Singapore week', () => {
    assert.deepEqual(getSingaporeWeekDayKeys('2026-07-17'), [
        '2026-07-12',
        '2026-07-13',
        '2026-07-14',
        '2026-07-15',
        '2026-07-16',
        '2026-07-17',
        '2026-07-18',
    ]);
    assert.match(dayViewSource, /shiftSingaporeDayKey\(selectedDayKey, -7\)/);
    assert.match(dayViewSource, /shiftSingaporeDayKey\(selectedDayKey, 7\)/);
});

test('the day timeline expands so early and late events are not hidden', () => {
    const hours = getTimelineHours([
        { startsAt: '2026-07-16T22:30:00.000Z' },
        { startsAt: '2026-07-17T12:30:00.000Z', endsAt: '2026-07-17T14:00:00.000Z' },
    ]);
    assert.equal(hours[0], 6);
    assert.equal(hours.at(-1), 23);
    assert.equal(getTimelineHours([
        { startsAt: '2026-07-17T15:30:00.000Z' },
    ]).at(-1), 23);
});

test('Care Calendar keeps the current actions and enables day week month views', () => {
    assert.match(dayViewSource, /careCalendarDayView/);
    assert.match(dayViewSource, /careCalendarWeekView/);
    assert.match(dayViewSource, /careCalendarMonthView/);
    assert.doesNotMatch(dayViewSource, /careCalendarViewComingSoon/);
    assert.match(periodViewsSource, /export function WeekCalendarView/);
    assert.match(periodViewsSource, /export function MonthCalendarView/);
    assert.match(eventCardSource, /onPlan\(event\)/);
    assert.match(eventCardSource, /onRemove\(event\.plannedItemId \|\| event\.id\)/);
    assert.match(pageSource, /api\.acknowledgeCalendarSchedule\(softAssetId\)/);
    assert.match(pageSource, /CalendarUpdatesView/);
    assert.match(eventCardSource, /careCalendarAddToPlans/);
    assert.match(eventCardSource, /careCalendarRemoveFromPlans/);
    assert.match(eventCardSource, /careCalendarRemoveMapNote/);
    assert.match(eventCardSource, /careCalendarSavedActivity/);
    assert.match(eventCardSource, /careCalendarPlanned/);
    assert.match(eventCardSource, /careCalendarMapNote/);
});
