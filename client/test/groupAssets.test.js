import test from 'node:test';
import assert from 'node:assert/strict';

import {
    formatGroupMemberCountLine,
    getGroupMemberCounts,
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
