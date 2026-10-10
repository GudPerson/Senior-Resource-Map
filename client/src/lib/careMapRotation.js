import L from 'leaflet';
import './vendor/leaflet-rotate-0.3.0.js';

// Pinned MIT extension; original bytes/license retained in vendor/. All map
// constructors opt out by default. Only owner Care Map browsing opts in.
L.Map.mergeOptions({ dragRotate: false });
L.Map.TouchGestures.prototype._ROT_INERTIA = false;
L.Map.ShiftKeyRotate.prototype._ROTATE_STEP = 0.25;
const touchEnd = L.Map.TouchGestures.prototype._onTouchEnd;
L.Map.TouchGestures.prototype._onTouchEnd = function (...args) {
    const wasActive = this._active;
    const result = touchEnd.apply(this, args);
    if (wasActive) this._map.fire('gestureend');
    return result;
};
const rotateWheel = L.Map.ShiftKeyRotate.prototype._onWheel;
L.Map.ShiftKeyRotate.prototype._onWheel = function (event) {
    if (event.shiftKey && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return rotateWheel.call(this, {
            shiftKey: true, deltaY: event.deltaX, deltaMode: event.deltaMode,
            preventDefault: () => event.preventDefault(),
            stopPropagation: () => event.stopPropagation(),
        });
    }
    return rotateWheel.call(this, event);
};

export function alignCareMapGeographicLayers(map) {
    if (!map?._rotatePane) return;
    map.eachLayer(layer => {
        if (!(layer instanceof L.Path || layer instanceof L.ImageOverlay) || layer._map !== map) return;
        const pane = layer.getPane?.();
        const name = layer.options.pane;
        if (!pane || !/^print-annotation-|^carearound-fixed-town-/.test(name || '')) return;
        const element = layer instanceof L.Path ? layer._renderer?._container : layer.getElement?.();
        if (!element) return;
        const targetName = `care-map-geographic-${name}`;
        const target = map.getPane(targetName) || map.createPane(targetName, map._rotatePane);
        target.style.zIndex = pane.style.zIndex;
        target.style.pointerEvents = pane.style.pointerEvents;
        target.className = `${pane.className} care-map-geographic-pane`;
        if (element.parentElement !== target) target.appendChild(element);
    });
}

export function refreshCareMapSvgProjection(map) {
    map.eachLayer(layer => {
        if (layer instanceof L.SVG && layer._map === map) layer._reset();
    });
}
