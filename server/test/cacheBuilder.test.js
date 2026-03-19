import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMapCacheQuery, rebuildMapCache } from '../src/utils/cacheBuilder.js';

function stringifyQuery(query) {
    return query.queryChunks
        .map((chunk) => typeof chunk === 'string' ? chunk : (chunk?.value ?? String(chunk)))
        .join(' ');
}

test('buildMapCacheQuery keeps member-only and partner-boundary soft assets out of public cache', () => {
    const queryText = stringifyQuery(buildMapCacheQuery('all'));

    assert.match(queryText, /s\.is_member_only = false/);
    assert.match(queryText, /s\.audience_mode = 'public'/);
    assert.match(queryText, /COALESCE\(s\.asset_mode, 'standalone'\) = 'standalone'/);
    assert.match(queryText, /COALESCE\(s\.asset_mode, 'standalone'\) = 'child'/);
    assert.match(queryText, /s\.host_hard_asset_id = l\.id/);
    assert.match(queryText, /l\.is_hidden = false/);
});

test('rebuildMapCache writes both the scoped cache and the aggregate cache', async () => {
    const executedQueries = [];
    const writes = [];
    const fakeDb = {
        async execute(query) {
            executedQueries.push(stringifyQuery(query));
            return {
                rows: [{ id: writes.length + 1, title: 'Visible asset', lat: '1.3000', lng: '103.8000', asset_type: 'soft' }],
            };
        },
    };
    const fakeStore = {
        async setJSON(key, value) {
            writes.push({ key, value });
            return true;
        },
    };

    await rebuildMapCache(12, { MAP_CACHE: {} }, { db: fakeDb, store: fakeStore });

    assert.equal(executedQueries.length, 2);
    assert.deepEqual(
        writes.map((entry) => entry.key),
        ['locations-cache-region-12.json', 'locations-cache-region-all.json']
    );
});
