import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyLocationIndicators,
    buildLocationIndicatorContextRequest,
    buildLocationIndicatorPrefetchResourceRefs,
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

test('buildLocationIndicatorPrefetchResourceRefs keeps visible resources first and caps the batch', () => {
    const refs = buildLocationIndicatorPrefetchResourceRefs({
        visibleResources: [
            { _type: 'hard', id: 1 },
            { _type: 'soft', id: 2 },
        ],
        prefetchResources: [
            { _type: 'soft', id: 2 },
            { _type: 'hard', id: 3 },
            { _type: 'soft', id: 4 },
        ],
        limit: 3,
    });

    assert.deepEqual(refs, [
        { type: 'hard', id: 1 },
        { type: 'soft', id: 2 },
        { type: 'hard', id: 3 },
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

test('buildLocationIndicatorContextRequest sends searched postal context only for postal search', () => {
    assert.deepEqual(buildLocationIndicatorContextRequest({
        source: 'postal',
        postalCode: '681809',
        lat: 1.37,
        lng: 103.74,
    }), {
        payload: { contextPostalCode: '681809' },
        key: 'postal:681809',
    });

    assert.deepEqual(buildLocationIndicatorContextRequest({
        source: 'home',
        postalCode: '680153',
        lat: 1.38,
        lng: 103.74,
    }), {
        payload: {},
        key: '',
    });
});

test('buildLocationIndicatorContextRequest sends temporary coordinate context for Locate Me', () => {
    assert.deepEqual(buildLocationIndicatorContextRequest({
        source: 'geolocation',
        lat: '1.3791',
        lng: '103.7449',
    }), {
        payload: {
            contextLocation: {
                lat: 1.3791,
                lng: 103.7449,
            },
        },
        key: 'geo:1.37910,103.74490',
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
