import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/SharedMapDirectoryList.jsx', import.meta.url), 'utf8');
const start = source.indexOf('    function handleMobileFullMapTouchStart(event)');
const end = source.indexOf('\n    useEffect(', start);
assert.ok(start >= 0 && end > start, 'The mounted fullscreen gesture handlers must be present');

// Execute the component's actual handlers; the native-touch browser probe covers
// event bubbling and camera retention with the real owner page and Leaflet map.
function gesture(mode = 'owner') {
    const ref = { current: null };
    let closes = 0;
    const handlers = new Function(
        'mode', 'window', 'mobileFullMapSwipeRef', 'closeMobileFullMap',
        'MOBILE_FULL_MAP_BOTTOM_EDGE_PX', 'MOBILE_FULL_MAP_EXIT_SWIPE_PX',
        `${source.slice(start, end)}\nreturn {
            start: handleMobileFullMapTouchStart,
            move: handleMobileFullMapTouchMove,
            end: handleMobileFullMapTouchEnd,
            cancel: typeof handleMobileFullMapTouchCancel === 'function' ? handleMobileFullMapTouchCancel : undefined,
        };`,
    )(mode, { innerHeight: 844 }, ref, () => { closes += 1; }, 180, 88);
    return { ...handlers, get closes() { return closes; } };
}

function touch(y, { map = false, count = 1, identifier = 1 } = {}) {
    return {
        target: { closest: (selector) => map && selector === '.leaflet-container' ? {} : null },
        touches: Array.from({ length: count }, (_, index) => ({ clientY: y, identifier: identifier + index })),
    };
}

test('private fullscreen map pans cannot start the bottom-edge exit gesture', () => {
    const g = gesture();
    g.start(touch(780, { map: true }));
    g.move(touch(620, { map: true }));
    g.end();
    assert.equal(g.closes, 0);
});

test('an intentional single-finger swipe outside the map still returns to the list', () => {
    const g = gesture();
    g.start(touch(820));
    g.move(touch(690));
    g.end();
    g.end();
    assert.equal(g.closes, 1);
});

test('short swipes and gestures that start above the exit region stay fullscreen', () => {
    for (const [startY, endY] of [[820, 790], [500, 300]]) {
        const g = gesture();
        g.start(touch(startY));
        g.move(touch(endY));
        g.end();
        assert.equal(g.closes, 0);
    }
});

test('private multi-finger and changed-touch gestures cannot close fullscreen', () => {
    for (const [initial, move] of [
        [touch(820, { count: 2 }), touch(650, { count: 2 })],
        [touch(820), touch(650, { count: 2 })],
        [touch(820), touch(650, { identifier: 2 })],
    ]) {
        const g = gesture();
        g.start(initial);
        g.move(move);
        g.end();
        assert.equal(g.closes, 0);
    }
});

test('an interrupted private swipe is cancelled without closing fullscreen', () => {
    const g = gesture();
    assert.equal(typeof g.cancel, 'function');
    g.start(touch(820));
    g.move(touch(650));
    g.cancel();
    g.end();
    assert.equal(g.closes, 0);
});

test('Shared Map retains its existing bottom-edge gesture behavior', () => {
    const g = gesture('shared');
    g.start(touch(780, { map: true }));
    g.move(touch(620, { map: true }));
    g.end();
    assert.equal(g.closes, 1);
});

test('the mounted fullscreen overlay wires cancellation separately from completion', () => {
    assert.match(source, /onTouchCancel=\{handleMobileFullMapTouchCancel\}/);
    assert.match(source, /onClick=\{closeMobileFullMap\}/);
});
