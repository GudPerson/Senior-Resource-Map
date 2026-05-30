import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildHardAssetSearchWhere,
    normalizeHardAssetSearchTerm,
} from '../src/utils/hardAssetSearch.js';

function stringifyQuery(query) {
    if (!query) return '';
    if (typeof query === 'string') return query;
    if (Array.isArray(query)) return query.map(stringifyQuery).join(' ');
    if (query.queryChunks) return query.queryChunks.map(stringifyQuery).join(' ');
    if (query.value) return stringifyQuery(query.value);
    if (query.name) return query.name;
    return String(query);
}

test('hard asset search trims empty input', () => {
    assert.equal(normalizeHardAssetSearchTerm('  aac  '), 'aac');
    assert.equal(buildHardAssetSearchWhere('   '), null);
});

test('hard asset search includes category, postal, address, description, and tag names', () => {
    const queryText = stringifyQuery(buildHardAssetSearchWhere('health'));

    assert.match(queryText, /sub_category/);
    assert.match(queryText, /address/);
    assert.match(queryText, /postal_code/);
    assert.match(queryText, /description/);
    assert.match(queryText, /hard_asset_tags/);
    assert.match(queryText, /search_hard_tag\.hard_asset_id =/);
    assert.match(queryText, /search_tag\.name ILIKE/);
});
