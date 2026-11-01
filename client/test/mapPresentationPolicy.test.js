import test from 'node:test';
import assert from 'node:assert/strict';
import { isMapFirstExperimentEnabled } from '../src/lib/mapPresentationPolicy.js';

test('original presentation is the default without an experiment build flag', () => {
    assert.equal(isMapFirstExperimentEnabled(), false);
});

test('only explicit true build values enable presentation experiments', () => {
    for (const value of [false, 'false', '', 'TRUE', 'split', 'map-first', 1, null]) {
        assert.equal(isMapFirstExperimentEnabled(value), false);
    }
    assert.equal(isMapFirstExperimentEnabled(true), true);
    assert.equal(isMapFirstExperimentEnabled('true'), true);
});
