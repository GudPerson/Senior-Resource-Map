import assert from 'node:assert/strict';
import test from 'node:test';

import {
    applyDiscoveryTabParam,
    normalizeDiscoveryTabParam,
} from '../src/lib/discoveryUrlState.js';

test('Discover tab URL state accepts only known resource families', () => {
    assert.equal(normalizeDiscoveryTabParam('hard'), 'hard');
    assert.equal(normalizeDiscoveryTabParam('SOFT'), 'soft');
    assert.equal(normalizeDiscoveryTabParam('unknown'), 'all');
    assert.equal(normalizeDiscoveryTabParam(''), 'all');
});

test('Discover tab URL state preserves other search context', () => {
    const params = new URLSearchParams('q=active+ageing&postal=680153');
    const next = applyDiscoveryTabParam(params, 'soft');

    assert.equal(next.get('q'), 'active ageing');
    assert.equal(next.get('postal'), '680153');
    assert.equal(next.get('type'), 'soft');
});

test('the all-resources tab keeps the default Discover URL clean', () => {
    const next = applyDiscoveryTabParam(new URLSearchParams('q=care&type=hard'), 'all');

    assert.equal(next.get('q'), 'care');
    assert.equal(next.has('type'), false);
});
