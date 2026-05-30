import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildSoftAssetSearchWhere,
    normalizeSoftAssetSearchTerm,
} from '../src/utils/softAssetSearch.js';

function stringifyQuery(query) {
    if (!query) return '';
    if (typeof query === 'string') return query;
    if (Array.isArray(query)) return query.map(stringifyQuery).join(' ');
    if (query.queryChunks) return query.queryChunks.map(stringifyQuery).join(' ');
    if (query.value) return stringifyQuery(query.value);
    if (query.name) return query.name;
    return String(query);
}

test('soft asset search trims empty input', () => {
    assert.equal(normalizeSoftAssetSearchTerm('  frcs  '), 'frcs');
    assert.equal(buildSoftAssetSearchWhere('   '), null);
});

test('soft asset search includes linked host place fields', () => {
    const queryText = stringifyQuery(buildSoftAssetSearchWhere('frcs'));

    assert.match(queryText, /soft_asset_locations/);
    assert.match(queryText, /search_host\.id =/);
    assert.match(queryText, /search_link\.soft_asset_id =/);
    assert.match(queryText, /search_location\.name ILIKE/);
    assert.match(queryText, /search_location\.address ILIKE/);
    assert.match(queryText, /search_location\.postal_code ILIKE/);
});

test('soft asset search includes tag names', () => {
    const queryText = stringifyQuery(buildSoftAssetSearchWhere('health'));

    assert.match(queryText, /soft_asset_tags/);
    assert.match(queryText, /search_soft_tag\.soft_asset_id =/);
    assert.match(queryText, /search_tag\.name ILIKE/);
});
