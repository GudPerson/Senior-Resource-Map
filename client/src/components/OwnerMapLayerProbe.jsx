import { useLayoutEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { useOwnerMapEditingCanvas } from '../contexts/OwnerMapEditingCanvasContext.jsx';
import { buildAnnotationInspectionIndex, buildResourceInspectionIndex, inspectMapLayers } from '../lib/mapLayerInspection.js';

const UI = '[data-care-map-gesture-ui],.leaflet-control,[data-print-annotation-toolbar],[data-map-settings-control],button,a,input,select,textarea';
const placeKeyOf = marker => marker.options?.icon?.options?.placeKey || marker.options?.placeKey;
const rectOf = element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
};

// A read-only bridge inside the existing mapOverlay. Leaflet and the page keep
// complete ownership of gestures, camera, annotation rendering and saved data.
export default function OwnerMapLayerProbe({ annotations, presentation, showPins, scopeKey }) {
    const map = useMap();
    const canvas = useOwnerMapEditingCanvas();
    const enabledRef = useRef(false);
    const sceneRef = useRef(null);
    const callbacksRef = useRef(null);
    const lifecycleRef = useRef(null);
    useLayoutEffect(() => {
        sceneRef.current = { annotations, presentation, showPins };
        callbacksRef.current = { register: canvas?.registerLayerInspection, hover: canvas?.onLayerHover,
            invalidate: canvas?.onLayerMapChange, sceneChanged: canvas?.onLayerSceneChange };
        enabledRef.current = Boolean(canvas?.showLayers);
    });

    useLayoutEffect(() => {
        if (!callbacksRef.current.register) return undefined;
        const container = map.getContainer();
        let disposed = false, dirty = true, timer = null, domTimer = null, pending = null, lastPointer = null, moving = false;
        let index = [], annotationFootprints = [], resourceFootprints = [];
        let resourceIndex = new Map();
        const project = point => {
            const p = map.latLngToContainerPoint(point), rect = container.getBoundingClientRect();
            return { x: p.x + rect.left, y: p.y + rect.top };
        };
        const rebuild = () => {
            dirty = false;
            const { annotations, presentation, showPins } = sceneRef.current;
            resourceIndex = buildResourceInspectionIndex(presentation);
            const visibleIds = new Set(annotations.map(item => item.id));
            annotationFootprints = [...container.querySelectorAll('[data-annotation-label-id],[data-annotation-pin-id]')]
                .map(element => ({ id: element.dataset.annotationLabelId || element.dataset.annotationPinId, rect: rectOf(element) }))
                .filter(item => visibleIds.has(item.id) && item.rect.right > item.rect.left && item.rect.bottom > item.rect.top);
            resourceFootprints = [];
            const renderedStyles = new Map();
            map.eachLayer(layer => {
                const pane = layer.options?.pane;
                const id = typeof pane === 'string' && pane.startsWith('print-annotation-') ? pane.slice('print-annotation-'.length) : null;
                if (visibleIds.has(id) && Number.isFinite(layer.options.weight)) renderedStyles.set(id, layer.options);
                if (!showPins) return;
                const element = layer.getElement?.();
                if (!element?.matches?.('.leaflet-marker-icon') || !container.contains(element)) return;
                const keys = layer.getAllChildMarkers ? layer.getAllChildMarkers().map(placeKeyOf).filter(Boolean) : [placeKeyOf(layer)].filter(Boolean);
                if (!keys.some(key => resourceIndex.has(key))) return;
                const zones = [...element.querySelectorAll('[data-category-bubble-place-key],[data-print-lobe-place-key],.directory-asset-spread-cluster__hit-zone[data-place-key]')];
                if (zones.length) {
                    zones.forEach(zone => {
                        const key = zone.dataset.categoryBubblePlaceKey || zone.dataset.printLobePlaceKey || zone.dataset.placeKey;
                        if (resourceIndex.has(key)) resourceFootprints.push({ placeKeys: [key], rect: rectOf(zone) });
                    });
                } else resourceFootprints.push({ placeKeys: keys, rect: rectOf(element), cluster: Boolean(layer.getAllChildMarkers) });
            });
            index = buildAnnotationInspectionIndex(annotations, { project, renderedStyles });
        };
        const inspect = (point, screenPoint) => {
            if (dirty) rebuild();
            return inspectMapLayers({ index, point, screenPoint, annotationFootprints, resourceIndex, resourceFootprints });
        };
        const controller = {
            capture: ({ x, y }) => {
                const rect = container.getBoundingClientRect();
                const p = map.containerPointToLatLng([x - rect.left, y - rect.top]);
                return { point: [p.lat, p.lng], x, y, scopeKey };
            },
            inspect: anchor => inspect(anchor.point, { x: anchor.x, y: anchor.y }),
        };
        callbacksRef.current.register(controller);
        const clear = () => {
            pending = null;
            lastPointer = null;
            if (timer !== null) clearTimeout(timer);
            if (domTimer !== null) clearTimeout(domTimer);
            timer = null;
            domTimer = null;
            callbacksRef.current.hover?.(null);
        };
        const queuePointer = point => {
            pending = point;
            lastPointer = point;
            if (timer !== null) return;
            // Bound geometry/DOM work to at most 12.5 updates/second. All
            // projection and marker footprints are cached until invalidated.
            timer = setTimeout(() => {
                timer = null;
                if (disposed || !pending || !enabledRef.current || moving) return;
                const anchor = controller.capture(pending);
                pending = null;
                callbacksRef.current.hover?.({ ...anchor, result: controller.inspect(anchor) });
            }, 80);
        };
        const moved = event => {
            if (!enabledRef.current || moving || event.buttons || event.target.closest?.(UI)) { clear(); return; }
            queuePointer({ x: event.clientX, y: event.clientY });
        };
        const start = () => { moving = true; clear(); callbacksRef.current.invalidate?.(); };
        const end = () => { moving = false; dirty = true; callbacksRef.current.invalidate?.(); };
        const changed = () => {
            dirty = true;
            callbacksRef.current.sceneChanged?.();
            // Fresh visible inputs invalidate results, not the pointer stream.
            // Preserve a pending timer through ordinary parent hover renders.
            if (lastPointer && enabledRef.current && !moving) queuePointer(lastPointer);
        };
        const domChanged = () => {
            dirty = true;
            if (domTimer !== null) return;
            domTimer = setTimeout(() => {
                domTimer = null;
                if (!disposed) callbacksRef.current.sceneChanged?.();
            }, 80);
        };
        lifecycleRef.current = { changed, clear };
        const scrolled = event => {
            const target = event.target;
            // Only scrolling that can move this map changes client footprints.
            // Readout and sibling-inspector scrolling must remain usable.
            if (target === document || target === window || (target instanceof Element
                && target !== container && target.contains(container))) {
                dirty = true;
                clear();
                callbacksRef.current.invalidate?.();
            }
        };
        const observer = new MutationObserver(domChanged);
        observer.observe(container, { childList: true, subtree: true });
        container.addEventListener('pointermove', moved, { passive: true });
        container.addEventListener('pointerleave', clear);
        container.addEventListener('pointerdown', clear, { passive: true });
        window.addEventListener('scroll', scrolled, { capture: true, passive: true });
        map.on('movestart zoomstart rotatestart', start);
        map.on('moveend zoomend rotate resize', end);
        map.on('layeradd layerremove', domChanged);
        return () => {
            disposed = true;
            lifecycleRef.current = null;
            clear();
            observer.disconnect();
            container.removeEventListener('pointermove', moved);
            container.removeEventListener('pointerleave', clear);
            container.removeEventListener('pointerdown', clear);
            window.removeEventListener('scroll', scrolled, true);
            map.off('movestart zoomstart rotatestart', start);
            map.off('moveend zoomend rotate resize', end);
            map.off('layeradd layerremove', domChanged);
            callbacksRef.current.register?.(null);
        };
    }, [map, scopeKey]);

    useLayoutEffect(() => {
        lifecycleRef.current?.changed();
    }, [annotations, presentation, showPins]);
    useLayoutEffect(() => {
        if (!canvas?.showLayers) lifecycleRef.current?.clear();
    }, [canvas?.showLayers]);

    return null;
}
