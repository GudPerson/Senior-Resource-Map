import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildChildEditablePatch,
    buildChildOverrideResetPatch,
    buildChildPropagationPatch,
    buildChildValuesFromParent,
    getMissingChildHostIds,
    getSoftAssetLocations,
} from '../src/utils/softAssetHierarchy.js';

test('buildChildValuesFromParent materializes a hidden child for one host', () => {
    const parent = {
        id: 10,
        partnerId: 7,
        name: 'Neighbourhood Health Talk',
        bucket: 'Programmes',
        subCategory: 'Programmes',
        description: 'Shared programme description',
        schedule: 'Fridays 3pm',
        logoUrl: 'https://example.com/logo.png',
        bannerUrl: 'https://example.com/banner.png',
        galleryUrls: ['https://example.com/1.png'],
        audienceMode: 'public',
        isMemberOnly: false,
    };
    const host = {
        id: 44,
        subregionId: 3,
        phone: '+65 6000 1111',
    };
    const actor = { id: 19 };

    const child = buildChildValuesFromParent(parent, host, actor);

    assert.equal(child.assetMode, 'child');
    assert.equal(child.parentSoftAssetId, 10);
    assert.equal(child.hostHardAssetId, 44);
    assert.equal(child.subregionId, 3);
    assert.equal(child.partnerId, 7);
    assert.equal(child.createdByUserId, 19);
    assert.equal(child.bucket, 'Programmes');
    assert.equal(child.isHidden, true);
    assert.deepEqual(child.overriddenFields, []);
    assert.equal(child.contactPhone, '+65 6000 1111');
});

test('buildChildPropagationPatch keeps local overrides while syncing canonical fields', () => {
    const parent = {
        partnerId: 9,
        name: 'Falls Prevention',
        bucket: 'Services',
        subCategory: 'Services',
        description: 'Updated parent description',
        schedule: 'Mondays 9am',
        logoUrl: null,
        bannerUrl: 'https://example.com/banner.png',
        galleryUrls: ['https://example.com/a.png'],
        audienceMode: 'partner_boundary',
        isMemberOnly: true,
    };
    const child = {
        overriddenFields: ['schedule'],
    };

    const patch = buildChildPropagationPatch(parent, child);

    assert.equal(patch.partnerId, 9);
    assert.equal(patch.name, 'Falls Prevention');
    assert.equal(patch.bucket, 'Services');
    assert.equal(patch.description, 'Updated parent description');
    assert.equal(patch.schedule, undefined);
    assert.equal(patch.audienceMode, 'partner_boundary');
    assert.equal(patch.isMemberOnly, true);
    assert.deepEqual(patch.galleryUrls, ['https://example.com/a.png']);
});

test('buildChildEditablePatch only accepts host-local fields and records overrides', () => {
    const patch = buildChildEditablePatch({
        schedule: 'Wednesdays 11am',
        contactEmail: 'host@example.com',
        isHidden: false,
    }, {
        overriddenFields: ['ctaLabel'],
    });

    assert.equal(patch.schedule, 'Wednesdays 11am');
    assert.equal(patch.contactEmail, 'host@example.com');
    assert.equal(patch.isHidden, false);
    assert.deepEqual(patch.overriddenFields.sort(), ['contactEmail', 'ctaLabel', 'schedule']);
});

test('buildChildEditablePatch rejects parent-controlled fields', () => {
    assert.throws(
        () => buildChildEditablePatch({ name: 'Illegal rename' }, { overriddenFields: [] }),
        /cannot be edited/
    );
});

test('buildChildOverrideResetPatch clears selected overrides back to parent values', () => {
    const patch = buildChildOverrideResetPatch({
        schedule: 'Tuesdays 2pm',
        description: 'Canonical description',
    }, {
        overriddenFields: ['schedule', 'contactPhone'],
    }, ['schedule']);

    assert.equal(patch.schedule, 'Tuesdays 2pm');
    assert.deepEqual(patch.overriddenFields, ['contactPhone']);
});

test('getMissingChildHostIds only returns hosts without active children', () => {
    const missing = getMissingChildHostIds([
        { hostHardAssetId: 1, isDeleted: false },
        { hostHardAssetId: 2, isDeleted: true },
    ], [1, 2, 3]);

    assert.deepEqual(missing, [2, 3]);
});

test('getSoftAssetLocations resolves child host and legacy multi-host links', () => {
    assert.deepEqual(
        getSoftAssetLocations({
            assetMode: 'child',
            hostHardAsset: { id: 10, name: 'Host A' },
        }),
        [{ id: 10, name: 'Host A' }]
    );

    assert.deepEqual(
        getSoftAssetLocations({
            assetMode: 'standalone',
            locations: [
                { hardAsset: { id: 1, name: 'Host B' } },
                { hardAsset: { id: 2, name: 'Host C' } },
            ],
        }),
        [{ id: 1, name: 'Host B' }, { id: 2, name: 'Host C' }]
    );
});
