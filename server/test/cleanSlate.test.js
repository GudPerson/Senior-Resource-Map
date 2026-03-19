import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCleanSlatePlan, summarizeCleanSlatePlan } from '../src/utils/cleanSlate.js';

test('clean-slate default plan preserves platform scaffolding', () => {
    const plan = buildCleanSlatePlan({});
    const summary = summarizeCleanSlatePlan(plan);

    assert.deepEqual(summary.reset, [
        'userFavorites',
        'softAssetAudienceZones',
        'softAssetParentAudienceZones',
        'softAssetLocations',
        'softAssetTags',
        'hardAssetTags',
        'softAssets',
        'softAssetParents',
        'hardAssets',
        'tags',
    ]);

    assert.ok(summary.preserve.includes('users'));
    assert.ok(summary.preserve.includes('subregions'));
    assert.ok(summary.preserve.includes('subregionPostalCodes'));
    assert.ok(summary.preserve.includes('partnerPostalCodes'));
    assert.ok(summary.preserve.includes('audienceZones'));
    assert.ok(summary.preserve.includes('subCategories'));
});

test('clean-slate flags expand the reset scope without touching users', () => {
    const plan = buildCleanSlatePlan({
        includeAudienceZones: true,
        includePartnerBoundaries: true,
        includeSubregionPostcodes: true,
        includeSubcategories: true,
    });
    const summary = summarizeCleanSlatePlan(plan);

    assert.ok(summary.reset.includes('audienceZonePostalCodes'));
    assert.ok(summary.reset.includes('audienceZones'));
    assert.ok(summary.reset.includes('partnerPostalCodes'));
    assert.ok(summary.reset.includes('subregionPostalCodes'));
    assert.ok(summary.reset.includes('subCategories'));
    assert.ok(!summary.reset.includes('users'));
    assert.ok(!summary.reset.includes('userSubregions'));
});
