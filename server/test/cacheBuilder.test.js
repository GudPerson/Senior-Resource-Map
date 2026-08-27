import test from 'node:test';
import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';

import {
    MAP_CACHE_SCHEMA_VERSION,
    buildCacheScheduleVisibilityPredicate,
    buildMapCacheQuery,
    rebuildMapCache,
} from '../src/utils/cacheBuilder.js';

function stringifyQuery(query) {
    return new PgDialect().sqlToQuery(query).sql;
}

test('buildMapCacheQuery keeps member-only and partner-boundary soft assets out of public cache', () => {
    const queryText = stringifyQuery(buildMapCacheQuery('all'));

    assert.match(queryText, /description/);
    assert.match(queryText, /postal_code/);
    assert.match(queryText, /logo_url/);
    assert.match(queryText, /whatsapp_contact/);
    assert.match(queryText, /location_whatsapp_contact/);
    assert.match(queryText, /location_hard_asset_id/);
    assert.match(queryText, /availability_enabled/);
    assert.match(queryText, /s\.is_member_only = false/);
    assert.match(queryText, /s\.audience_mode = 'public'/);
    assert.match(queryText, /COALESCE\(s\.asset_mode, 'standalone'\) = 'standalone'/);
    assert.match(queryText, /NOT EXISTS/);
    assert.match(queryText, /COALESCE\(s\.asset_mode, 'standalone'\) = 'child'/);
    assert.match(queryText, /s\.host_hard_asset_id = l\.id/);
    assert.match(queryText, /l\.is_hidden = false/);
    assert.match(queryText, /h\.hide_from/);
    assert.match(queryText, /s\.hide_from/);
    assert.match(queryText, /l\.hide_from/);
    assert.match(queryText, /CURRENT_TIMESTAMP BETWEEN/);
    assert.match(queryText, /location_hide_from/);
    assert.match(queryText, /location_hide_until/);
});

test('cache schedule predicates accept only fixed internal table aliases', () => {
    assert.match(stringifyQuery(buildCacheScheduleVisibilityPredicate('s')), /s\.hide_from/);
    assert.throws(
        () => buildCacheScheduleVisibilityPredicate('s; DROP TABLE soft_assets'),
        /Unsupported cache visibility table alias/,
    );
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
    assert.equal(writes[0].value.version, MAP_CACHE_SCHEMA_VERSION);
    assert.deepEqual(writes[0].value.data, [{ id: 1, title: 'Visible asset', lat: '1.3000', lng: '103.8000', asset_type: 'soft' }]);
});

test('rebuildMapCache can skip aggregate recursion for batched refreshes', async () => {
    const executedQueries = [];
    const writes = [];
    const fakeDb = {
        async execute(query) {
            executedQueries.push(stringifyQuery(query));
            return {
                rows: [{ id: 1, title: 'Visible asset', lat: '1.3000', lng: '103.8000', asset_type: 'soft' }],
            };
        },
    };
    const fakeStore = {
        async setJSON(key, value) {
            writes.push({ key, value });
            return true;
        },
    };

    await rebuildMapCache(12, { MAP_CACHE: {} }, {
        db: fakeDb,
        store: fakeStore,
        rebuildAggregate: false,
    });

    assert.equal(executedQueries.length, 1);
    assert.deepEqual(
        writes.map((entry) => entry.key),
        ['locations-cache-region-12.json']
    );
});

test('rebuildMapCache emits privacy-safe duration and row-count events', async () => {
    const events = [];
    const times = [1000, 1010, 1025];
    const result = await rebuildMapCache(12, { MAP_CACHE: {} }, {
        db: {
            async execute() {
                return { rows: [{ id: 1 }, { id: 2 }] };
            },
        },
        store: { async setJSON() {} },
        rebuildAggregate: false,
        now: () => times.shift(),
        log: (value) => events.push(JSON.parse(value)),
    });

    assert.equal(result.ok, true);
    assert.equal(result.rowCount, 2);
    assert.deepEqual(events, [{
        event: 'map_cache_rebuild',
        outcome: 'success',
        region: '12',
        rowCount: 2,
        durationMs: 25,
        aggregateRequested: false,
    }]);
    assert.doesNotMatch(JSON.stringify(events), /title|description|address/);
});
