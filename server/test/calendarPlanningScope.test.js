import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeCalendarScope,
    serializePersonalItem,
} from '../src/controllers/calendarController.js';

test('calendar scope accepts all and plans only', () => {
    assert.equal(normalizeCalendarScope(), 'all');
    assert.equal(normalizeCalendarScope('plans'), 'plans');
    assert.equal(normalizeCalendarScope(' ALL '), 'all');

    assert.throws(
        () => normalizeCalendarScope('everything'),
        (error) => error.status === 400
            && /either all or plans/.test(error.message),
    );
});

test('planned session serialization separates source change from user review acknowledgement', () => {
    const row = {
        id: 8,
        itemType: 'planned_session',
        softAssetId: 42,
        mapAssetNoteId: null,
        title: 'Line Dance',
        startsAt: new Date('2026-07-19T02:00:00.000Z'),
        endsAt: new Date('2026-07-19T03:30:00.000Z'),
        allDay: false,
        status: 'planned',
        sourceScheduleEntryKey: 'row-old',
        sourceStartsAt: new Date('2026-07-19T02:00:00.000Z'),
        sourceRevision: 2,
    };
    const revisions = new Map([[42, 4]]);

    assert.deepEqual({
        sourceChanged: serializePersonalItem(row, revisions).sourceChanged,
        needsReview: serializePersonalItem(row, revisions).needsReview,
    }, {
        sourceChanged: true,
        needsReview: true,
    });

    assert.deepEqual({
        sourceChanged: serializePersonalItem(row, revisions, new Map([[42, 4]])).sourceChanged,
        needsReview: serializePersonalItem(row, revisions, new Map([[42, 4]])).needsReview,
    }, {
        sourceChanged: true,
        needsReview: false,
    });
});
