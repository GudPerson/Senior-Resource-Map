import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyLocationIndicators,
    buildLocationIndicatorResourceRefs,
    getDiscoveryLocationIndicatorPresentation,
} from '../src/features/discover/locationIndicators.js';

test('buildLocationIndicatorResourceRefs keeps only compact hard and soft refs', () => {
    const refs = buildLocationIndicatorResourceRefs([
        { _type: 'hard', id: 1 },
        { type: 'hard', id: '1' },
        { resourceType: 'soft', resourceId: 2 },
        { asset_type: 'template', id: 3 },
        { _type: 'soft', id: 'bad' },
    ]);

    assert.deepEqual(refs, [
        { type: 'hard', id: 1 },
        { type: 'soft', id: 2 },
    ]);
});

test('getDiscoveryLocationIndicatorPresentation chooses active-location text before home-region text', () => {
    assert.deepEqual(getDiscoveryLocationIndicatorPresentation({
        withinAudienceZone: true,
        withinHomeRegion: true,
        withinContextRegion: true,
    }), {
        showAudienceStar: true,
        recommendationKey: 'discoveryRecommendedForThisLocation',
    });
});

test('getDiscoveryLocationIndicatorPresentation falls back to home-region text', () => {
    assert.deepEqual(getDiscoveryLocationIndicatorPresentation({
        withinAudienceZone: false,
        withinHomeRegion: true,
        withinContextRegion: false,
    }), {
        showAudienceStar: false,
        recommendationKey: 'discoveryRecommendedForYou',
    });
});

test('applyLocationIndicators decorates resources without changing order', () => {
    const resources = [
        { _type: 'hard', id: 1, name: 'First' },
        { _type: 'soft', id: 2, name: 'Second' },
    ];

    const decorated = applyLocationIndicators(resources, {
        'soft:2': {
            withinAudienceZone: true,
            withinHomeRegion: false,
            withinContextRegion: false,
        },
    });

    assert.deepEqual(decorated.map((resource) => resource.name), ['First', 'Second']);
    assert.equal(decorated[0], resources[0]);
    assert.notEqual(decorated[1], resources[1]);
    assert.deepEqual(decorated[1]._locationIndicators, {
        withinAudienceZone: true,
        withinHomeRegion: false,
        withinContextRegion: false,
    });
});
