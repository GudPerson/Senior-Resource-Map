import test from 'node:test';
import assert from 'node:assert/strict';
import { attachCareMapDesktopInput } from '../src/lib/careMapDesktopInputController.js';
import { isCareMapGestureActive } from '../src/lib/careMapGestureState.js';

class Target {
    listeners = new Map();
    isConnected = true;
    addEventListener(type, fn) { const set = this.listeners.get(type) || new Set(); set.add(fn); this.listeners.set(type, set); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    dispatch(type, event = {}) { for (const fn of [...(this.listeners.get(type) || [])]) fn(event); }
}

function fixture() {
    const container = new Target(), host = new Target(); host.document = new Target();
    let id = 0;
    const frames = new Map(), timers = new Map(), events = [], calls = [], errors = [];
    host.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
    host.cancelAnimationFrame = key => frames.delete(key);
    host.setTimeout = fn => { timers.set(++id, fn); return id; };
    host.clearTimeout = key => timers.delete(key);
    const handlers = new Map();
    const map = {
        zoom: 13,
        getContainer: () => container,
        getZoom() { return this.zoom; },
        getMinZoom: () => 11,
        getMaxZoom: () => 19,
        mouseEventToContainerPoint: e => ({ x: e.clientX, y: e.clientY }),
        on(names, fn) { for (const name of names.split(' ')) { const set = handlers.get(name) || new Set(); set.add(fn); handlers.set(name, set); } },
        off(names, fn) { for (const name of names.split(' ')) handlers.get(name)?.delete(fn); },
        fire(name) { events.push(name); for (const fn of [...(handlers.get(name) || [])]) fn(); },
        setZoomAround(point, zoom, options) {
            calls.push({ point, zoom, options });
            this.fire('movestart'); this.fire('zoomstart'); this.zoom = zoom;
            this.fire('zoomend'); this.fire('moveend');
        },
    };
    let controlledZoom = map.zoom;
    const controller = attachCareMapDesktopInput({ map, host, normalizeWheelDelta: e => -e.deltaY, onError: error => errors.push(error) });
    map.on('zoomend moveend gestureend', () => { if (!isCareMapGestureActive(map)) controlledZoom = map.zoom; });
    const wheel = (deltaY, override = {}) => {
        const e = { deltaY, ctrlKey: true, shiftKey: false, cancelable: true, clientX: 80, clientY: 50,
            target: { closest: () => null }, prevented: false, stopped: false,
            preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...override };
        container.dispatch('wheel', e); return e;
    };
    return { map, container, host, controller, calls, errors, events, wheel,
        frame() { const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(); },
        idle() { const pending = [...timers.values()]; timers.clear(); for (const fn of pending) fn(); },
        get pending() { return frames.size + timers.size; }, get controlledZoom() { return controlledZoom; } };
}

test('ordinary wheel, map UI and Shift are untouched by the desktop controller', () => {
    const f = fixture();
    for (const e of [f.wheel(120, { ctrlKey: false }), f.wheel(-120, { shiftKey: true }), f.wheel(-1, { target: { closest: () => ({}) } })]) {
        assert.equal(e.prevented, false); assert.equal(e.stopped, false);
    }
    assert.equal(f.pending, 0); assert.equal(f.calls.length, 0); assert.equal(isCareMapGestureActive(f.map), false);
    f.controller.dispose();
});

test('one admitted tiny Ctrl gesture commits exactly a tenth at idle, then settles', () => {
    const f = fixture(); const e = f.wheel(-1);
    assert.equal(e.prevented, true); assert.equal(isCareMapGestureActive(f.map), true);
    f.frame(); assert.equal(f.map.zoom, 13, 'tiny residual is not rounded per packet');
    f.idle(); assert.equal(f.map.zoom, 13.1); assert.equal(isCareMapGestureActive(f.map), false);
    assert.deepEqual(f.calls[0].point, { x: 80, y: 50 });
    assert.equal(f.calls[0].options.animate, false);
    assert.ok(f.events.includes('gestureend')); assert.equal(f.pending, 0);
    f.wheel(-1); f.idle(); assert.equal(f.map.zoom, 13.2);
    f.controller.dispose();
});

test('packet splitting does not change the final public camera', () => {
    const results = [1, 10, 100].map(count => {
        const f = fixture(); for (let i = 0; i < count; i++) { f.wheel(-40 / count); f.frame(); }
        f.idle(); const zoom = f.map.zoom; f.controller.dispose(); return zoom;
    });
    assert.equal(new Set(results).size, 1);
});

test('a bounded overshoot does not delay a tiny reverse gesture', () => {
    const f = fixture(); f.map.zoom = 18;
    f.wheel(-10000); f.frame(); assert.equal(f.map.zoom, 19);
    f.wheel(0.001); f.idle(); assert.equal(f.map.zoom, 18.9);
    f.controller.dispose();
});

test('external camera/reset/drag actions cancel queued input without publishing stale state', () => {
    for (const name of ['movestart', 'zoomstart', 'dragstart', 'carearound-requested-scale-reset']) {
        const f = fixture(); f.wheel(-40); f.map.fire(name); f.map.zoom = 14;
        f.frame(); f.idle(); assert.equal(f.map.zoom, 14, name); assert.equal(f.calls.length, 0, name);
        assert.equal(f.events.includes('gestureend'), false, name); assert.equal(isCareMapGestureActive(f.map), false, name);
        f.controller.dispose();
    }
});

test('blur, touch start, unmount and explicit view cancellation clear flags and callbacks', () => {
    for (const kind of ['blur', 'touchstart', 'dispose', 'cancel']) {
        const f = fixture(); f.wheel(-40);
        if (kind === 'blur') f.host.dispatch('blur');
        else if (kind === 'touchstart') f.container.dispatch('touchstart');
        else f.controller[kind]();
        f.frame(); f.idle(); assert.equal(f.calls.length, 0, kind); assert.equal(f.pending, 0, kind);
        assert.equal(isCareMapGestureActive(f.map), false, kind);
        f.controller.dispose();
    }
});

test('clearing desktop membership never clears an overlapping native touch gesture', () => {
    const f = fixture(); f.wheel(-1); f.map.touchGestures = { _active: true };
    f.idle(); assert.equal(isCareMapGestureActive(f.map), true); assert.equal(f.map.touchGestures._active, true);
    assert.equal(f.events.includes('gestureend'), false, 'native completion owns its settlement');
    f.map.touchGestures._active = false; assert.equal(isCareMapGestureActive(f.map), false);
    f.controller.dispose();
});

test('public camera errors clear membership and report once without a stale follow-up', () => {
    const f = fixture(); f.map.setZoomAround = () => { throw new Error('synthetic camera failure'); };
    f.wheel(-40); f.frame(); f.idle();
    assert.equal(f.errors.length, 1); assert.equal(isCareMapGestureActive(f.map), false); assert.equal(f.pending, 0);
    f.controller.dispose();
});

test('detached maps and disposed listeners cannot apply late wheel input', () => {
    const f = fixture(); f.wheel(-40); f.container.isConnected = false; f.frame(); f.idle();
    assert.equal(f.calls.length, 0); assert.equal(isCareMapGestureActive(f.map), false);
    f.controller.dispose(); f.container.isConnected = true; f.wheel(-40); f.frame(); f.idle();
    assert.equal(f.calls.length, 0);
});

test('retained-camera interruptions publish only the last applied camera, without pending intent', () => {
    for (const reason of ['ordinary-wheel', 'blur', 'selection']) {
        const f = fixture(); f.wheel(-40); f.frame();
        assert.ok(f.map.zoom > 13); assert.equal(f.controlledZoom, 13, 'active frames defer controlled publication');
        const retained = f.map.zoom;
        if (reason === 'ordinary-wheel') f.wheel(120, { ctrlKey: false });
        else if (reason === 'blur') f.host.dispatch('blur');
        else f.container.dispatch('mousedown', { target: { closest: () => null } });
        f.frame(); f.idle();
        assert.equal(f.map.zoom, retained, reason); assert.equal(f.controlledZoom, retained, reason);
        assert.equal(isCareMapGestureActive(f.map), false); f.controller.dispose();
    }
});

test('retained resize publishes the applied camera and discards unapplied pinch intent', () => {
    for (const applied of [false, true]) {
        const f = fixture(); f.wheel(-40);
        if (applied) f.frame();
        const retained = f.map.zoom;
        assert.equal(f.controlledZoom, 13, 'active frames defer controlled publication');
        // Leaflet invalidateSize may publish moveend before its resize event.
        f.map.fire('moveend'); f.map.fire('resize');
        f.frame(); f.idle();
        assert.equal(f.map.zoom, retained); assert.equal(f.controlledZoom, retained);
        assert.equal(isCareMapGestureActive(f.map), false); assert.equal(f.pending, 0);
        f.controller.dispose();
    }
});

test('authoritative replacement cancels an applied gesture without replaying its old controlled pose', () => {
    const f = fixture(); f.wheel(-40); f.frame(); assert.equal(f.controlledZoom, 13);
    f.map.fire('carearound-requested-scale-reset');
    assert.equal(f.controlledZoom, 13, 'cancellation does not publish the superseded pose');
    f.map.zoom = 14; f.map.fire('zoomend'); f.map.fire('moveend');
    f.frame(); f.idle(); assert.equal(f.map.zoom, 14); assert.equal(f.controlledZoom, 14);
    f.controller.dispose();
});

test('retained settlement waits for an overlapping native rotation to finish', () => {
    const f = fixture(); f.wheel(-40); f.frame(); const retained = f.map.zoom;
    f.map._rotating = true; f.wheel(10, { ctrlKey: false });
    assert.equal(f.controlledZoom, 13); assert.equal(isCareMapGestureActive(f.map), true);
    f.map._rotating = false; f.map.fire('rotateend');
    assert.equal(f.controlledZoom, retained); assert.equal(isCareMapGestureActive(f.map), false);
    f.controller.dispose();
});
