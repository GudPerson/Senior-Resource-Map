import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { isCareMapGestureActive } from '../lib/careMapGestureState.js';

// Input origin stays outside React's camera updates: fit/reset/resize must keep
// their existing containment, while an owner's outward gesture keeps its scale.
export default function DirectoryMapRequestedScaleSync({ enabled, preferenceRef, onChange, mobileControlTarget = null }) {
    const map = useMap();
    const candidateRef = useRef(null);
    useEffect(() => {
        if (!enabled) return undefined;
        const container = map.getContainer();
        let timer = null;
        const stopTimer = () => { if (timer !== null) window.clearTimeout(timer); timer = null; };
        const setPreference = (value) => {
            preferenceRef.current = value;
            onChange?.(value);
        };
        const begin = () => {
            candidateRef.current ||= {
                zoom: Number(map.getZoom()),
                previous: preferenceRef.current,
            };
            stopTimer();
            timer = window.setTimeout(settled, 1500);
            // Publish before Leaflet handles the input, so an old native effect
            // cannot reverse the camera before the overview selection renders.
            setPreference(true);
        };
        const clear = () => {
            stopTimer();
            candidateRef.current = null;
            setPreference(false);
        };
        const wheel = (event) => {
            if (!event.shiftKey && event.deltaY > 0) begin();
        };
        const touch = (event) => {
            if (event.touches.length >= 2) begin();
        };
        const click = (event) => {
            const target = event.target;
            const inside = container.closest('[data-map-basemap-mode]')?.contains(target);
            const mobile = mobileControlTarget?.contains(target);
            if (!inside && !mobile) return;
            if (target.closest?.('.carearound-map-recenter-control')) clear();
            else if (target.closest?.('.leaflet-control-zoom-out, [data-map-zoom-action="out"]')) begin();
        };
        const key = (event) => {
            if (event.target.closest?.('input, textarea, [contenteditable="true"]')) return;
            if (event.key === '-' || event.key === '_') begin();
        };
        const settled = () => {
            const candidate = candidateRef.current;
            if (!candidate) return;
            if (isCareMapGestureActive(map)) {
                stopTimer();
                timer = window.setTimeout(settled, 400);
                return;
            }
            stopTimer();
            candidateRef.current = null;
            if (Number(map.getZoom()) >= candidate.zoom && !candidate.previous) clear();
        };
        const cancel = () => {
            const candidate = candidateRef.current;
            stopTimer();
            candidateRef.current = null;
            if (candidate) setPreference(candidate.previous);
        };
        container.addEventListener('wheel', wheel, { capture: true, passive: true });
        container.addEventListener('touchstart', touch, { capture: true, passive: true });
        container.addEventListener('keydown', key, true);
        container.addEventListener('touchcancel', cancel, true);
        window.addEventListener('blur', cancel);
        document.addEventListener('click', click, true);
        map.on('zoomend gestureend', settled);
        map.on('resize carearound-requested-scale-reset', clear);
        return () => {
            stopTimer();
            container.removeEventListener('wheel', wheel, true);
            container.removeEventListener('touchstart', touch, true);
            container.removeEventListener('keydown', key, true);
            container.removeEventListener('touchcancel', cancel, true);
            window.removeEventListener('blur', cancel);
            document.removeEventListener('click', click, true);
            map.off('zoomend gestureend', settled);
            map.off('resize carearound-requested-scale-reset', clear);
        };
    }, [enabled, map, mobileControlTarget, onChange, preferenceRef]);
    return null;
}
