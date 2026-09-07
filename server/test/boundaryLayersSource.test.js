import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routes = readFileSync(new URL('../src/routes/boundaryLayers.js', import.meta.url), 'utf8');
const routing = readFileSync(new URL('../src/utils/subregionRouting.js', import.meta.url), 'utf8');

test('boundary-layer writes remain Super Admin-only', () => {
    assert.match(routes, /router\.post\('\/regions', authenticateToken, authorize\('super_admin'\)/);
    assert.match(routes, /router\.post\('\/unmapped', authenticateToken, authorize\('super_admin'\)/);
});

test('operational postcode routing still queries only the Subregion layer', () => {
    assert.match(routing, /from\(subregionPostalCodes\)/);
    assert.match(routing, /innerJoin\(subregions/);
    assert.doesNotMatch(routing, /\b(?:regionPostalCodes|unmappedPostalCodes|regionSubregions)\b/);
});
