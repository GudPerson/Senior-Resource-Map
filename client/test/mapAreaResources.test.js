import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMapAreaResources } from '../src/lib/mapAreaResources.js';
import { getMapSpatialMessages } from '../src/lib/mapSpatialMessages.js';

const area = { type: 'circle', center: [1.3, 103.8], radiusMeters: 500 };
const at = { lat: '1.3', lng: '103.8', address: 'Inside address' };
const away = { lat: 1.4, lng: 103.9, address: 'Outside address' };

test('area resources include global places and a multi-venue programme once, with typed identities', () => {
    const access = { eligible: false, missingProfileFields: ['age'] };
    const hard = [{ id: 1, name: 'Inside place', ...at }, { id: 2, name: 'Outside place', ...away }];
    const soft = [{ id: 1, name: 'Multi-venue programme', locations: [away, at, at], access }];
    const result = classifyMapAreaResources(hard, soft, area);
    assert.deepEqual(result.inside.map(row => row.id), ['hard:1', 'soft:1']);
    assert.equal(result.inside[1].locations.length, 2);
    assert.equal(result.inside[1].detailPath, '/resource/soft/1');
    assert.equal(result.inside[1].access, access, 'location matching must not rewrite eligibility metadata');
    assert.equal(result.total, 3);
    assert.equal(result.unassessed.length, 0);
    assert.equal(soft[0].locations.length, 3, 'source locations stay intact');
});

test('unlocated and partially located resources are reported instead of called outside', () => {
    const hard = [{ id: 1, ...at }, { id: 2, lat: null, lng: null }, { id: 3, lat: '1.3garbage', lng: '103.8' }];
    const soft = [{ id: 4, name: 'List only' }, { id: 5, locations: [away, { lat: '', lng: '' }] }, { id: 6, locations: [at, { lat: null, lng: null }] }];
    const result = classifyMapAreaResources(hard, soft, area);
    assert.deepEqual(result.inside.map(row => row.id), ['hard:1', 'soft:6']);
    assert.deepEqual(result.unassessed.map(row => row.id), ['hard:2', 'hard:3', 'soft:4', 'soft:5', 'soft:6']);
});

test('typed repeated catalogue rows and unsafe detail identifiers are not duplicated or linked', () => {
    const result = classifyMapAreaResources([{ id: 1, ...at }, { id: 1, ...away }, { id: '../private', ...at }, { id: -1, ...at }], [{ id: 1, location: at }], area);
    assert.deepEqual(result.inside.map(row => row.id), ['hard:1', 'soft:1']);
    assert.equal(result.total, 2);
});

test('area resources respect polygon holes through the shared geometry contract', () => {
    const polygon = { type: 'Polygon', coordinates: [[[103.7, 1.2], [103.9, 1.2], [103.9, 1.4], [103.7, 1.4], [103.7, 1.2]], [[103.79, 1.29], [103.81, 1.29], [103.81, 1.31], [103.79, 1.31], [103.79, 1.29]]] };
    const result = classifyMapAreaResources([{ id: 1, ...at }, { id: 2, lat: 1.25, lng: 103.75 }], [], polygon);
    assert.deepEqual(result.inside.map(row => row.id), ['hard:2']);
});

test('new spatial controls have complete labels and safety copy in every supported locale', () => {
    const keys = Object.keys(getMapSpatialMessages('en')).sort();
    for (const locale of ['en', 'zh', 'ms', 'ta']) {
        const messages = getMapSpatialMessages(locale);
        assert.deepEqual(Object.keys(messages).sort(), keys);
        assert.ok(keys.every(key => typeof messages[key] === 'string' && messages[key].length > 0));
        if (locale !== 'en') assert.notEqual(messages.nearbyTitle, getMapSpatialMessages('en').nearbyTitle);
    }
});
