import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CARE_MAP_PAGE_SCROLL_PINCH,
    createCareMapPinchAccumulator,
    isCareMapZoomWheel,
    normalizeCareMapPinchGain,
    normalizeCareMapWheelPolicy,
} from '../src/lib/careMapDesktopInput.js';

const event = (overrides = {}) => ({ deltaY: -1, ctrlKey: false, shiftKey: false, cancelable: true, ...overrides });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);

test('the policy opts in explicitly and leaves legacy callers unchanged', () => {
    assert.equal(normalizeCareMapWheelPolicy(), 'legacy');
    assert.equal(normalizeCareMapWheelPolicy('unknown'), 'legacy');
    assert.equal(normalizeCareMapWheelPolicy(CARE_MAP_PAGE_SCROLL_PINCH), CARE_MAP_PAGE_SCROLL_PINCH);
    assert.equal(isCareMapZoomWheel(event()), true);
    assert.equal(isCareMapZoomWheel(event({ ctrlKey: true })), true);
    assert.equal(isCareMapZoomWheel(event({ shiftKey: true })), false);
});

test('ordinary page/panel wheel is never map zoom, independently of magnitude', () => {
    for (const deltaY of [-1000, -1, 1, 1000]) {
        assert.equal(isCareMapZoomWheel(event({ deltaY }), CARE_MAP_PAGE_SCROLL_PINCH), false);
        assert.equal(isCareMapZoomWheel(event({ deltaY, ctrlKey: true }), CARE_MAP_PAGE_SCROLL_PINCH), true);
    }
    for (const override of [{ shiftKey: true }, { metaKey: true }, { altKey: true }, { defaultPrevented: true }, { cancelable: false }, { deltaY: 0 }]) {
        assert.equal(isCareMapZoomWheel(event({ ctrlKey: true, ...override }), CARE_MAP_PAGE_SCROLL_PINCH), false);
    }
});

test('map UI is excluded without excluding geographic labels by their role', () => {
    const ui = { closest: () => ({}) };
    const label = { closest: () => null, role: 'button' };
    assert.equal(isCareMapZoomWheel(event({ ctrlKey: true, target: ui }), CARE_MAP_PAGE_SCROLL_PINCH), false);
    assert.equal(isCareMapZoomWheel(event({ ctrlKey: true, target: label }), CARE_MAP_PAGE_SCROLL_PINCH), true);
});

test('the tentative gain is finite and bounded to one through two', () => {
    assert.equal(normalizeCareMapPinchGain(), 1.5);
    assert.equal(normalizeCareMapPinchGain(Infinity), 1.5);
    assert.equal(normalizeCareMapPinchGain(0.5), 1);
    assert.equal(normalizeCareMapPinchGain(5), 2);
});

function accumulate(deltas, { zoom = 13, gain = 1.5, minZoom = 11, maxZoom = 19 } = {}) {
    const input = createCareMapPinchAccumulator({ gain });
    const frames = deltas.map(delta => input.add({ zoom, delta, minZoom, maxZoom }));
    return { frames, final: input.finish() };
}

test('equal totals split into one, ten or one hundred packets produce the same camera', () => {
    const one = accumulate([40]).final;
    near(accumulate(Array(10).fill(4)).final, one);
    near(accumulate(Array(100).fill(0.4)).final, one);
    assert.ok(accumulate([80]).final > one);
    assert.ok(accumulate([40], { gain: 2 }).final > accumulate([40], { gain: 1 }).final);
});

test('tiny nonzero completed gestures retain a directed tenth without per-packet rounding', () => {
    for (const zoom of [13, 14]) {
        for (const count of [1, 10, 100]) {
            const result = accumulate(Array(count).fill(0.001 / count), { zoom });
            assert.ok(result.frames.every(value => value === zoom), 'sub-step residual stays unrounded during the burst');
            near(result.final, zoom + 0.1);
            near(accumulate(Array(count).fill(-0.001 / count), { zoom }).final, zoom - 0.1);
        }
    }
});

test('a net-zero gesture returns to its starting camera', () => {
    near(accumulate([10, -10]).final, 13);
});

test('clamped overshoot creates no debt before a tiny reversal', () => {
    near(accumulate([10000, -0.001], { zoom: 18 }).final, 18.9);
    near(accumulate([-10000, 0.001], { zoom: 12 }).final, 11.1);
    near(accumulate([10000], { zoom: 19 }).final, 19);
    near(accumulate([-10000], { zoom: 11 }).final, 11);
});

test('reset discards old residual and rebases on the next actual camera', () => {
    const input = createCareMapPinchAccumulator();
    input.add({ zoom: 13, delta: 10, minZoom: 11, maxZoom: 19 });
    input.reset();
    input.add({ zoom: 14, delta: 0.001, minZoom: 11, maxZoom: 19 });
    near(input.finish(), 14.1);
    assert.equal(input.finish(), null);
});

test('invalid or empty input cannot manufacture a gesture', () => {
    const input = createCareMapPinchAccumulator();
    for (const delta of [0, NaN, Infinity]) assert.equal(input.add({ zoom: 13, delta, minZoom: 11, maxZoom: 19 }), null);
    assert.equal(input.finish(), null);
});
