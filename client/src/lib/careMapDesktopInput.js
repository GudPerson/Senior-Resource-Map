export const CARE_MAP_LEGACY_WHEEL = 'legacy';
export const CARE_MAP_PAGE_SCROLL_PINCH = 'page-scroll-pinch';
export const CARE_MAP_PINCH_IDLE_MS = 150;

const MAP_INPUT_UI = '.leaflet-control, .leaflet-popup, [data-care-map-gesture-ui], input, textarea, select, [contenteditable="true"]';

export function normalizeCareMapWheelPolicy(value) {
    return value === CARE_MAP_PAGE_SCROLL_PINCH ? value : CARE_MAP_LEGACY_WHEEL;
}

export function normalizeCareMapPinchGain(value) {
    if (value === null || value === undefined || value === '') return 1.5;
    const gain = Number(value);
    return Number.isFinite(gain) ? Math.max(1, Math.min(2, gain)) : 1.5;
}

export function isCareMapZoomWheel(event, policy = CARE_MAP_LEGACY_WHEEL) {
    if (!event || event.shiftKey || !Number.isFinite(event.deltaY) || event.deltaY === 0) return false;
    if (normalizeCareMapWheelPolicy(policy) === CARE_MAP_LEGACY_WHEEL) return true;
    return Boolean(event.ctrlKey && !event.metaKey && !event.altKey
        && !event.defaultPrevented && event.cancelable !== false
        && !event.target?.closest?.(MAP_INPUT_UI));
}

// Keep intent unrounded across packets. The scale matches the tangent of
// Leaflet's existing wheel curve; gain changes only the admitted desktop pinch.
export function createCareMapPinchAccumulator({ gain = 1.5, snap = 0.1 } = {}) {
    const sensitivity = normalizeCareMapPinchGain(gain) / (120 * Math.LN2);
    const step = Number.isFinite(snap) && snap > 0 ? snap : 0.1;
    let state = null;
    const round = value => Number((Math.round((value + Number.EPSILON) / step) * step).toFixed(10));
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    return {
        add({ zoom, delta, minZoom, maxZoom }) {
            if (![zoom, delta, minZoom, maxZoom].every(Number.isFinite) || delta === 0 || minZoom > maxZoom) return null;
            if (!state) {
                const origin = clamp(zoom, minZoom, maxZoom);
                state = { origin, intent: origin, min: minZoom, max: maxZoom };
            }
            state.min = minZoom; state.max = maxZoom;
            state.origin = clamp(state.origin, minZoom, maxZoom);
            state.intent = clamp(state.intent, minZoom, maxZoom);
            const next = state.intent + delta * sensitivity;
            state.intent = clamp(next, minZoom, maxZoom);
            // Discard excess at a bound and rebase the directed minimum response.
            // A tiny reversal must not pay back a previous overshoot first.
            if (next <= minZoom || next >= maxZoom) state.origin = state.intent;
            return clamp(round(state.intent), minZoom, maxZoom);
        },
        finish() {
            if (!state) return null;
            let target = round(state.intent);
            const net = state.intent - state.origin;
            // The minimum applies once to a completed net gesture, not packets.
            if (Math.abs(net) > 1e-12 && Math.abs(target - round(state.origin)) < 1e-12) {
                target = round(state.origin) + Math.sign(net) * step;
            }
            target = clamp(Number(target.toFixed(10)), state.min, state.max);
            state = null;
            return target;
        },
        reset() { state = null; },
    };
}
