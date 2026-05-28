import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyLocationIndicators,
    getDiscoveryLocationIndicatorPresentation,
} from '../src/features/discover/locationIndicators.js';

test('getDiscoveryLocationIndicatorPresentation chooses the active-location pill before home-region text', () => {
    assert.deepEqual(getDiscoveryLocationIndicatorPresentation({
        withinAudienceZone: true,
        withinHomeRegion: true,
        withinContextRegion: true,
    }), {
        showAudienceStar: true,
        recommendationKey: 'discoveryRecommendedForThisLocation',
    });
});

test('getDiscoveryLocationIndicatorPresentation falls back to the home-region pill', () => {
    assert.deepEqual(getDiscoveryLocationIndicatorPresentation({
        withinAudienceZone: false,
        withinHomeRegion: true,
        withinContextRegion: false,
    }), {
        showAudienceStar: false,
        recommendationKey: 'discoveryRecommendedForYou',
    });
});

test('applyLocationIndicators decorates resources without changing their order', () => {
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
    assert.deepEqual(decorated[1]._locationIndicators, {
        withinAudienceZone: true,
        withinHomeRegion: false,
        withinContextRegion: false,
    });
});
