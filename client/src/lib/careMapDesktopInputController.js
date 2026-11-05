import { CARE_MAP_PAGE_SCROLL_PINCH, CARE_MAP_PINCH_IDLE_MS, createCareMapPinchAccumulator, isCareMapZoomWheel } from './careMapDesktopInput.js';
import { isCareMapGestureActive, setCareMapDesktopPinchActive } from './careMapGestureState.js';

// All camera operations use Leaflet's public API. The caller exclusively disables
// the legacy wheel handler before mounting this owner-only controller.
export function attachCareMapDesktopInput({ map, host = window, normalizeWheelDelta, gain = 1.5, onError = () => {} }) {
    const container = map.getContainer();
    const accumulator = createCareMapPinchAccumulator({ gain });
    let active = false, applying = false, disposed = false, retainedSettlementPending = false;
    let frame = null, timer = null, generation = 0, target = null, point = null;
    const applicable = () => !disposed && container.isConnected !== false && Number.isFinite(map.getZoom());
    const membership = value => { active = value; setCareMapDesktopPinchActive(map, value); };
    const clearScheduled = () => {
        generation += 1;
        if (frame !== null) host.cancelAnimationFrame(frame);
        if (timer !== null) host.clearTimeout(timer);
        frame = null; timer = null;
    };
    const publishRetained = () => {
        if (!retainedSettlementPending || disposed) return;
        if (!applicable()) { retainedSettlementPending = false; return; }
        if (isCareMapGestureActive(map)) return;
        retainedSettlementPending = false;
        try {
            map.fire('gestureend');
            // Existing final coverage/budget containment runs after the marker
            // clears. Read the applicable camera now, never a saved old target.
            map.fire('moveend');
        } catch (error) { onError(error); }
    };
    const cancel = ({ settleRetained = false } = {}) => {
        if (disposed) return;
        const wasActive = active;
        clearScheduled(); accumulator.reset(); membership(false); target = null; point = null;
        retainedSettlementPending = settleRetained ? retainedSettlementPending || wasActive : false;
        publishRetained();
    };
    const interruptRetained = () => cancel({ settleRetained: true });
    const fail = error => { cancel(); onError(error); };
    const otherGestureActive = () => {
        // Membership is independent of native touch/rotation. No events occur
        // during this synchronous check and native flags are never overwritten.
        setCareMapDesktopPinchActive(map, false);
        const other = isCareMapGestureActive(map);
        setCareMapDesktopPinchActive(map, active);
        return other;
    };
    const apply = zoom => {
        if (!applicable() || !Number.isFinite(zoom) || !point) return;
        if (Math.abs(map.getZoom() - zoom) < 1e-9) return;
        applying = true;
        try { map.setZoomAround(point, zoom, { animate: false }); }
        finally { applying = false; }
    };
    const complete = () => {
        clearScheduled();
        if (!active || !applicable()) { cancel(); return; }
        if (otherGestureActive()) { interruptRetained(); return; }
        try {
            apply(accumulator.finish());
            membership(false);
            target = null; point = null;
            retainedSettlementPending = true;
            publishRetained();
        } catch (error) { fail(error); }
    };
    const wheel = event => {
        if (!isCareMapZoomWheel(event, CARE_MAP_PAGE_SCROLL_PINCH)) { interruptRetained(); return; }
        try {
            if (!applicable()) { cancel(); return; }
            const delta = normalizeWheelDelta(event);
            const nextPoint = map.mouseEventToContainerPoint(event);
            if (!Number.isFinite(delta) || delta === 0 || !Number.isFinite(nextPoint.x) || !Number.isFinite(nextPoint.y)) return;
            event.preventDefault();
            if (otherGestureActive()) { interruptRetained(); return; }
            const next = accumulator.add({ zoom: map.getZoom(), delta, minZoom: map.getMinZoom(), maxZoom: map.getMaxZoom() });
            if (next === null) return;
            point = nextPoint; target = next; membership(true);
            if (frame === null) {
                const version = generation;
                frame = host.requestAnimationFrame(() => {
                    if (disposed || version !== generation) return;
                    frame = null;
                    if (!applicable()) { cancel(); return; }
                    if (otherGestureActive()) { interruptRetained(); return; }
                    try { apply(target); } catch (error) { fail(error); }
                });
            }
            if (timer !== null) host.clearTimeout(timer);
            const version = generation;
            timer = host.setTimeout(() => { if (!disposed && version === generation) complete(); }, CARE_MAP_PINCH_IDLE_MS);
        } catch (error) { fail(error); }
    };
    const externalCamera = () => { if (!applying) cancel(); };
    const pointer = event => {
        if (event.target?.closest?.('.leaflet-control-zoom-in, .leaflet-control-zoom-out, .carearound-map-recenter-control, [data-map-zoom-action]')) cancel();
        else interruptRetained();
    };
    const key = event => {
        if (event.key === 'Escape') interruptRetained();
        else if (['+', '=', '-', '_', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) cancel();
    };
    const visibility = () => { if (host.document?.hidden) interruptRetained(); };
    container.addEventListener('wheel', wheel, { passive: false });
    container.addEventListener('mousedown', pointer, true);
    container.addEventListener('touchstart', interruptRetained, true);
    container.addEventListener('keydown', key, true);
    host.addEventListener('blur', interruptRetained);
    host.document?.addEventListener('visibilitychange', visibility);
    map.on('movestart zoomstart dragstart carearound-requested-scale-reset', externalCamera);
    map.on('resize', interruptRetained);
    map.on('gestureend rotateend zoomend moveend', publishRetained);
    return {
        cancel,
        dispose() {
            if (disposed) return;
            cancel(); disposed = true;
            container.removeEventListener('wheel', wheel);
            container.removeEventListener('mousedown', pointer, true);
            container.removeEventListener('touchstart', interruptRetained, true);
            container.removeEventListener('keydown', key, true);
            host.removeEventListener('blur', interruptRetained);
            host.document?.removeEventListener('visibilitychange', visibility);
            map.off('movestart zoomstart dragstart carearound-requested-scale-reset', externalCamera);
            map.off('resize', interruptRetained);
            map.off('gestureend rotateend zoomend moveend', publishRetained);
        },
    };
}
