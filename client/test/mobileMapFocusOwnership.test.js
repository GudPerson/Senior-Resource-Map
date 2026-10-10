import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/SharedMapDirectoryList.jsx', import.meta.url), 'utf8');
function focusRequest({ mode = 'owner', handled = null, key = 'a', selection = { type: 'place', group: { placeKey: 'a' } } } = {}) {
    const start = source.indexOf('const mobileFullMapFocusRequest = useMemo(');
    const end = source.indexOf('\n\n    useMobileViewportScaleLock', start);
    return new Function('useMemo', 'mobileFullMapOpen', 'mobileFocusTraySelection', 'mode',
        'mobileFullMapHandledFocusKey', 'mobileFocusTrayPlaceKey',
        `${source.slice(start, end)}; return mobileFullMapFocusRequest;`)(callback => callback(), true, selection, mode, handled, key);
}

test('an acknowledged owner fullscreen selection stops requesting camera focus', () => {
    assert.equal(focusRequest().focusedPlaceKey, 'a:zoom');
    assert.deepEqual(focusRequest({ handled: 'a' }), { focusedPlaceKey: null, focusedPlaceKeys: [] });
});

test('an acknowledged group selection also stops requesting fit bounds', () => {
    const options = { key: 'group', selection: { type: 'group', members: [{ placeKey: 'a' }, { placeKey: 'b' }] } };
    assert.deepEqual(focusRequest(options).focusedPlaceKeys, ['a', 'b']);
    assert.deepEqual(focusRequest({ ...options, handled: 'group' }), { focusedPlaceKey: null, focusedPlaceKeys: [] });
});

test('a different selection and explicitly renewed same selection can focus again', () => {
    assert.equal(focusRequest({ handled: 'a', key: 'b', selection: { type: 'place', group: { placeKey: 'b' } } }).focusedPlaceKey, 'b:zoom');
    assert.equal(focusRequest({ handled: null }).focusedPlaceKey, 'a:zoom');
});

test('Shared Map focus requests retain their existing contract', () => {
    assert.equal(focusRequest({ mode: 'shared', handled: 'a' }).focusedPlaceKey, 'a:zoom');
});
