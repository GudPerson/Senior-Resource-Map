import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/controllers/softAssetsController.js'), 'utf8');

test('Offering updates require explicit schedule intent and revision-aware compare-and-swap writes', () => {
    assert.match(source, /assertOfferingScheduleMutationIntent\(scheduleMutation/);
    assert.match(source, /action: body\.schedulePlanAction/);
    assert.match(source, /expectedRevision: body\.expectedScheduleRevision/);
    assert.match(source, /eq\(softAssets\.calendarRevision, expectedScheduleRevision\)/);
    assert.match(source, /returning\(\{ id: softAssets\.id \}\)/);
    assert.match(source, /This schedule changed while you were saving/);
});

test('deprecated one-row writes cannot overwrite reviewed multi-session schedules', () => {
    assert.match(source, /body\.schedulePlan === undefined/);
    assert.match(source, /body\.calendarSchedule !== undefined/);
    assert.match(source, /existing\.calendarScheduleSource !== 'legacy'/);
    assert.match(source, /This Offering uses reviewed session rows/);
});
