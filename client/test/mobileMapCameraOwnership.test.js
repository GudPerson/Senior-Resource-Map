import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/SharedMapDirectoryList.jsx', import.meta.url), 'utf8');

// Exercise both mounted clone configurations, including inherited props. The
// native-touch replay covers the corresponding Leaflet camera feedback cycle.
function mountedMaps({ mode = 'owner', fullscreen = false } = {}) {
    const camera = { center: [1.30, 103.85], zoom: 16.1 };
    const changes = [];
    const callback = (value) => changes.push(value);
    const element = { props: { mapViewState: camera, onMapViewStateChange: callback } };
    const clone = (name) => {
        const start = source.indexOf(`React.cloneElement(${name}, {`);
        const end = source.indexOf('\n                                })', start);
        assert.ok(start >= 0 && end > start, `Mounted ${name} configuration exists`);
        return new Function(
            'React', 'mobileMapElement', 'mobileFullMapElement', 'mode', 'mobileFullMapOpen',
            'setClusterMapping', 'handleMobileMapViewSection', 'handleMobileMapClusterSelect',
            'preserveMobileMapFrameInFlow', 'mobileMapLayoutSignature', 'mobileMapListFocused',
            'mobileFullMapFocusRequest',
            `return ${source.slice(start, end)}\n});`,
        )(
            { cloneElement: (original, props) => ({ ...original.props, ...props }) },
            element, element, mode, fullscreen, () => {}, () => {}, () => {},
            true, 'v2-map', false, { focusedPlaceKey: '', focusedPlaceKeys: [] },
        );
    };
    return { inline: clone('mobileMapElement'), full: clone('mobileFullMapElement'), camera, changes, callback };
}

test('only the visible owner fullscreen map reports camera changes', () => {
    const maps = mountedMaps({ fullscreen: true });
    maps.full.onMapViewStateChange({ center: [1.31, 103.84], zoom: 16.1 });
    maps.inline.onMapViewStateChange?.({ center: [1.30, 103.85], zoom: 16.1 });
    assert.deepEqual(maps.changes, [{ center: [1.31, 103.84], zoom: 16.1 }]);
});

test('owner inline camera reporting resumes when fullscreen closes', () => {
    const maps = mountedMaps();
    assert.equal(maps.inline.onMapViewStateChange, maps.callback);
    maps.inline.onMapViewStateChange(maps.camera);
    assert.deepEqual(maps.changes, [maps.camera]);
});

test('the retained inline map continues following the owner camera', () => {
    const maps = mountedMaps({ fullscreen: true });
    assert.equal(maps.inline.mapViewState, maps.camera);
    assert.equal(maps.full.mapViewState, maps.camera);
    assert.equal(maps.full.onMapViewStateChange, maps.callback);
});

test('Shared Map camera callbacks keep their existing behavior', () => {
    for (const fullscreen of [false, true]) {
        const maps = mountedMaps({ mode: 'shared', fullscreen });
        assert.equal(maps.inline.onMapViewStateChange, maps.callback);
        assert.equal(maps.full.onMapViewStateChange, maps.callback);
    }
});
