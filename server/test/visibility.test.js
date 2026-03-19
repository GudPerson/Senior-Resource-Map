import test from 'node:test';
import assert from 'node:assert/strict';

import { isAssetVisible } from '../src/utils/visibility.js';

function createAsset(overrides = {}) {
    return {
        id: 1,
        subregionId: 10,
        partnerId: 20,
        isDeleted: false,
        isHidden: false,
        isMemberOnly: false,
        audienceMode: 'public',
        hideFrom: null,
        hideUntil: null,
        ...overrides,
    };
}

test('super admins can still see assets hidden from normal discovery', () => {
    const visible = isAssetVisible(
        createAsset({ isHidden: true }),
        { id: 99, role: 'super_admin', subregionIds: [] }
    );

    assert.equal(visible, true);
});

test('guests cannot see member-only offerings', () => {
    const visible = isAssetVisible(createAsset({ isMemberOnly: true }), { role: 'guest' });
    assert.equal(visible, false);
});

test('standard users can only see partner-boundary offerings when managed by that partner and inside boundary', () => {
    const allowed = isAssetVisible(
        createAsset({ audienceMode: 'partner_boundary', partnerId: 42 }),
        { id: 7, role: 'standard', managerUserId: 42, postalCode: '680153' },
        { allowedPartnerAudienceIds: new Set([42]) }
    );
    const blocked = isAssetVisible(
        createAsset({ audienceMode: 'partner_boundary', partnerId: 42 }),
        { id: 8, role: 'standard', managerUserId: 41, postalCode: '680153' },
        { allowedPartnerAudienceIds: new Set([42]) }
    );

    assert.equal(allowed, true);
    assert.equal(blocked, false);
});

test('standard users can see audience-zone offerings when their postal code matches at least one assigned zone', () => {
    const allowed = isAssetVisible(
        createAsset({
            audienceMode: 'audience_zones',
            audienceZones: [
                { audienceZone: { id: 101, name: 'Falls Pilot' } },
                { audienceZone: { id: 202, name: 'Active Ageing Trial' } },
            ],
        }),
        { id: 7, role: 'standard', postalCode: '680153' },
        { allowedAudienceZoneIds: new Set([202]) }
    );
    const blocked = isAssetVisible(
        createAsset({
            audienceMode: 'audience_zones',
            audienceZones: [
                { audienceZone: { id: 101, name: 'Falls Pilot' } },
            ],
        }),
        { id: 8, role: 'standard', postalCode: '680153' },
        { allowedAudienceZoneIds: new Set([202]) }
    );

    assert.equal(allowed, true);
    assert.equal(blocked, false);
});

test('scheduled hide windows suppress public visibility', () => {
    const now = Date.now();
    const visible = isAssetVisible(
        createAsset({
            hideFrom: new Date(now - 60_000).toISOString(),
            hideUntil: new Date(now + 60_000).toISOString(),
        }),
        { role: 'guest' }
    );

    assert.equal(visible, false);
});

test('audience-zone offerings still respect hidden flags after postcode matching succeeds', () => {
    const visible = isAssetVisible(
        createAsset({
            audienceMode: 'audience_zones',
            isHidden: true,
            audienceZones: [
                { audienceZone: { id: 101, name: 'Falls Pilot' } },
            ],
        }),
        { id: 7, role: 'standard', postalCode: '680153' },
        { allowedAudienceZoneIds: new Set([101]) }
    );

    assert.equal(visible, false);
});
