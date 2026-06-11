import test from 'node:test';
import assert from 'node:assert/strict';

import {
    actorCanUseSingaporeFallbackRegion,
    canUseSingaporePostalFallback,
    findSingaporeFallbackSubregion,
    resolveSingleSubregionByPostal,
} from '../src/lib/postalBoundaries.js';

const SUBREGIONS = [
    { id: 12, subregionCode: 'WST', name: 'West', postalCodesList: ['650438'] },
    { id: 186, subregionCode: 'SIN', name: 'Singapore', postalCodesList: [] },
];

test('missing exact Singapore postals can use the SG fallback for Super Admins', () => {
    const result = resolveSingleSubregionByPostal(SUBREGIONS, '650439', null);
    const singaporeSubregion = findSingaporeFallbackSubregion(SUBREGIONS);

    assert.equal(result.status, 'missing');
    assert.equal(singaporeSubregion.id, 186);
    assert.equal(canUseSingaporePostalFallback({
        country: 'SG',
        currentRole: 'super_admin',
        currentUser: { role: 'super_admin', subregionIds: [] },
        singaporeSubregion,
    }), true);
});

test('Singapore fallback is available to actors scoped to Singapore only', () => {
    assert.equal(actorCanUseSingaporeFallbackRegion({ role: 'regional_admin', subregionIds: [186] }, 186), true);
    assert.equal(actorCanUseSingaporeFallbackRegion({ role: 'regional_admin', subregionIds: [12] }, 186), false);
});

test('Singapore fallback is not offered for non-Singapore places', () => {
    assert.equal(canUseSingaporePostalFallback({
        country: 'MY',
        currentRole: 'super_admin',
        currentUser: { role: 'super_admin', subregionIds: [] },
        singaporeSubregion: findSingaporeFallbackSubregion(SUBREGIONS),
    }), false);
});
