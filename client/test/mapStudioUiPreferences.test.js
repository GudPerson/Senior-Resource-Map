import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT,
    MAP_STUDIO_LAYOUT_PANEL_SIDE_RIGHT,
    MAP_STUDIO_LAYOUT_PANEL_SIDE_STORAGE_KEY,
    normalizeMapStudioLayoutPanelSide,
    readMapStudioLayoutPanelSide,
    writeMapStudioLayoutPanelSide,
} from '../src/lib/mapStudioUiPreferences.js';

function createStorage(initialValue = null) {
    let storedValue = initialValue;
    return {
        getItem(key) {
            assert.equal(key, MAP_STUDIO_LAYOUT_PANEL_SIDE_STORAGE_KEY);
            return storedValue;
        },
        setItem(key, value) {
            assert.equal(key, MAP_STUDIO_LAYOUT_PANEL_SIDE_STORAGE_KEY);
            storedValue = value;
        },
    };
}

test('layout panel defaults to the established right dock', () => {
    assert.equal(normalizeMapStudioLayoutPanelSide(null), MAP_STUDIO_LAYOUT_PANEL_SIDE_RIGHT);
    assert.equal(readMapStudioLayoutPanelSide(createStorage('unknown')), MAP_STUDIO_LAYOUT_PANEL_SIDE_RIGHT);
});

test('layout panel remembers a valid left or right browser preference', () => {
    const storage = createStorage();

    assert.equal(writeMapStudioLayoutPanelSide(MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT, storage), MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT);
    assert.equal(readMapStudioLayoutPanelSide(storage), MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT);
    assert.equal(writeMapStudioLayoutPanelSide(MAP_STUDIO_LAYOUT_PANEL_SIDE_RIGHT, storage), MAP_STUDIO_LAYOUT_PANEL_SIDE_RIGHT);
    assert.equal(readMapStudioLayoutPanelSide(storage), MAP_STUDIO_LAYOUT_PANEL_SIDE_RIGHT);
});

test('layout panel preference degrades safely when storage is unavailable', () => {
    const unavailableStorage = {
        getItem() { throw new Error('blocked'); },
        setItem() { throw new Error('blocked'); },
    };

    assert.equal(readMapStudioLayoutPanelSide(unavailableStorage), MAP_STUDIO_LAYOUT_PANEL_SIDE_RIGHT);
    assert.equal(writeMapStudioLayoutPanelSide(MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT, unavailableStorage), MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT);
});
