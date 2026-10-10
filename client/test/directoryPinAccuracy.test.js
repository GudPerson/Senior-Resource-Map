import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    buildDirectoryPresentation,
    buildOwnerNumberedPinPresentation,
    buildPinVisibilityPresentation,
} from '../src/lib/directoryPresentation.js';

const place = (key, lat, lng, postalCode = '123456') => ({
    placeKey: key, name: key, lat, lng, postalCode, hasCoordinates: true,
    rows: [{ rowKey: key, assetKey: key, resourceType: 'hard', resourceId: key,
        name: key, subCategory: 'Community' }],
});
const presentation = (places) => buildDirectoryPresentation({ places }, { presentationMode: 'v2-cards' });
const positions = (pins) => pins.map(({ lat, lng }) => [lat, lng]).sort();

for (const [name, places] of [
    ['same postal code with distinct coordinates', [place('a', 1.3, 103.8), place('b', 1.301, 103.801)]],
    ['nearby locations formerly joined by tolerance', [place('a', 1.3, 103.8, '123456'), place('b', 1.3002, 103.8002, '654321')]],
    ['distinct locations formerly joined by rounding', [place('a', 1.300001, 103.800001, ''), place('b', 1.300002, 103.800002, '')]],
]) {
    test(`${name} retain their exact positions through owner grouping and Hide pin`, () => {
        const base = presentation(places);
        const expected = positions(places);
        assert.deepEqual(positions(base.pins), expected);
        assert.deepEqual(positions(buildPinVisibilityPresentation(base, []).pins), expected);
        assert.deepEqual(positions(buildOwnerNumberedPinPresentation(base).pins), expected);
        const hidden = buildPinVisibilityPresentation(base, ['a']);
        assert.deepEqual(positions(hidden.pins), positions([places[1]]));
        assert.equal(base.displayGroups.length, 2);
        assert.equal(hidden.displayGroups.length, 1);
    });
}

test('truly coincident locations retain both resource numbers and hover identities', () => {
    const base = presentation([place('a', 1.3, 103.8), place('b', '1.3000', '103.8000')]);
    const numbered = buildOwnerNumberedPinPresentation(base);
    assert.equal(base.pins.length, 1);
    assert.equal(numbered.pins.length, 1);
    assert.deepEqual(numbered.pins[0].memberPlaceKeys, ['a', 'b']);
    assert.deepEqual(numbered.pins[0].printBadgeItems.map(item => item.label), ['1', '2']);
    assert.deepEqual(numbered.hoverPlaceKeysByKey[numbered.pins[0].placeKey], ['a', 'b']);
});

test('hiding a third resource does not average the remaining same-postal pin positions', () => {
    const places = [place('a', 1.3, 103.8), place('b', 1.301, 103.801), place('c', 1.302, 103.802)];
    const base = presentation(places);
    const hidden = buildPinVisibilityPresentation(base, ['c']);
    assert.deepEqual(positions(hidden.pins), positions(places.slice(0, 2)));
    assert.deepEqual(positions(buildOwnerNumberedPinPresentation(hidden).pins), positions(places.slice(0, 2)));
});

test('live DirectoryMap cannot opt into automatic displacement by marker style or interaction suspension', () => {
    const source = readFileSync(new URL('../src/components/DirectoryMap.jsx', import.meta.url), 'utf8');
    const signature = source.slice(source.indexOf('export default function DirectoryMap'), source.indexOf('}) {', source.indexOf('export default function DirectoryMap')));
    assert.match(signature, /allowPinDisplacement = false/);
    assert.match(source, /spreadPinsForDisplay\(pins, interactive, allowPinDisplacement && spreadCoincidentPins\)/);
    assert.match(source, /spreadPinsForDisplay\(markerPins, interactive, allowPinDisplacement && spreadCoincidentPins\)/);
    assert.match(source, /enabled=\{allowPinDisplacement && \(markerMode === 'print-badge' \|\| markerMode === 'category-bubble'\)\}/);
});
