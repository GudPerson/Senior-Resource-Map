import test from 'node:test';
import assert from 'node:assert/strict';

import {
    formatGroupSaveErrorMessage,
    formatGroupMemberCountLine,
    formatGroupUpdateSummary,
    getGroupGalleryUrls,
    getGroupMemberCounts,
    getGroupVisibilitySummary,
    isGroupAsset,
} from '../src/lib/groupAssets.js';

test('Group asset helpers detect soft Group mode and format compact member counts', () => {
    const asset = {
        assetMode: 'group',
        groupMemberSummary: {
            counts: {
                places: 1,
                programmes: 2,
                services: 0,
                promotions: 1,
                total: 4,
            },
        },
    };

    assert.equal(isGroupAsset(asset), true);
    assert.equal(isGroupAsset({ assetMode: 'standalone' }), false);
    assert.deepEqual(getGroupMemberCounts(asset), {
        places: 1,
        programmes: 2,
        services: 0,
        promotions: 1,
        total: 4,
    });
    assert.equal(formatGroupMemberCountLine(asset), '1 Place | 2 Programmes | 1 Promotion');
});

test('Group save errors explain when the API does not support Groups yet', () => {
    assert.equal(
        formatGroupSaveErrorMessage(new Error('Generated child offerings must be created from a parent template.')),
        'Group saving needs the latest API. This preview is connected to an API that does not support Groups yet.'
    );
    assert.equal(
        formatGroupSaveErrorMessage(new Error('Database unavailable')),
        'Database unavailable'
    );
});

test('Group public detail helpers summarize visibility, updater accountability, and gallery safely', () => {
    assert.deepEqual(getGroupVisibilitySummary({ audienceMode: 'public' }), {
        label: 'Public',
        detail: 'Open to everyone',
    });
    assert.deepEqual(getGroupVisibilitySummary({ audienceMode: 'target_regions', coverageRegionIds: [129, '130'] }), {
        label: 'Target region/s',
        detail: '2 selected Regions',
    });
    assert.deepEqual(
        formatGroupUpdateSummary({
            updatedAt: '2026-06-24T00:00:00.000Z',
            updatedByName: 'SG Admin',
        }, 'en-SG'),
        { label: 'Last updated', detail: '24 Jun 2026 by SG Admin' },
    );
    assert.deepEqual(
        formatGroupUpdateSummary({
            updatedAt: 'not a date',
            updatedByName: 'SG Admin',
        }, 'en-SG'),
        { label: 'Last updated', detail: 'by SG Admin' },
    );
    assert.deepEqual(getGroupGalleryUrls({ galleryUrls: [' https://one.test/a.png ', '', null, 'https://two.test/b.png'] }), [
        'https://one.test/a.png',
        'https://two.test/b.png',
    ]);
});
