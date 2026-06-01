import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDiscoveryMobileLocationSummary,
    shouldShowDiscoveryMobileLocationSummary,
} from '../src/features/discover/discoveryMobileCardPresentation.js';

const labels = {
    availableIn: 'Available at',
    placesSingular: 'place',
    placesPlural: 'places',
};

function t(key) {
    return labels[key] || key;
}

test('mobile Discover hides soft location summary when there are zero linked places', () => {
    const summary = buildDiscoveryMobileLocationSummary({
        isHard: false,
        asset: { _locationCount: 0 },
        displayLocation: null,
        t,
    });

    assert.equal(summary, null);
    assert.equal(shouldShowDiscoveryMobileLocationSummary({ summary, hasDirectionsTarget: false }), false);
});

test('mobile Discover still shows positive soft place counts when no display place is selected', () => {
    const summary = buildDiscoveryMobileLocationSummary({
        isHard: false,
        asset: { _locationCount: 2 },
        displayLocation: null,
        t,
    });

    assert.equal(summary, 'Available at 2 places');
    assert.equal(shouldShowDiscoveryMobileLocationSummary({ summary, hasDirectionsTarget: false }), true);
});

test('mobile Discover still shows real addresses and coordinate-only direction targets', () => {
    assert.equal(buildDiscoveryMobileLocationSummary({
        isHard: false,
        asset: { _locationCount: 1 },
        displayLocation: { address: '386 Bukit Batok West Ave. 5' },
        t,
    }), '386 Bukit Batok West Ave. 5');

    assert.equal(shouldShowDiscoveryMobileLocationSummary({
        summary: null,
        hasDirectionsTarget: true,
    }), true);
});
