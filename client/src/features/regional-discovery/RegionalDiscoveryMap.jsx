import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import DirectoryMap from '../../components/DirectoryMap.jsx';
import { regionalDiscoveryCopy, regionalDiscoveryMarkerEvent } from './regionalDiscoveryPresentation.js';

/** Sole regional camera owner. Back/dismiss/hover and directory filters never issue camera requests. */
export function RegionalMapCamera({ regionBounds, pins, cameraRequest }) {
    const map = useMap();
    const lastRequest = useRef(null);
    const regionSignature = JSON.stringify(regionBounds);
    useEffect(() => {
        map.fitBounds(JSON.parse(regionSignature), { animate: false, padding: [24, 24] });
    }, [map, regionSignature]);
    useEffect(() => {
        if (!cameraRequest || cameraRequest.id === lastRequest.current) return;
        lastRequest.current = cameraRequest.id;
        const animate = !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (cameraRequest.type === 'reset') {
            map.fitBounds(pins.length ? pins.map(pin => [pin.lat, pin.lng]) : regionBounds, { animate, padding: [24, 24], ...(pins.length ? {maxZoom:16} : {}) });
            return;
        }
        const selected = pins.filter(pin => pin.memberPlaceKeys.some(key => cameraRequest.placeKeys.includes(key)));
        if (selected.length === 1) map.setView([selected[0].lat, selected[0].lng], Math.max(15, map.getZoom()), {animate});
        else if (selected.length > 1) map.fitBounds(selected.map(pin => [pin.lat, pin.lng]), {animate, padding:[36,36], maxZoom:16});
    }, [cameraRequest, map, pins, regionBounds]);
    useEffect(() => {
        const resize = () => map.invalidateSize({animate:false, pan:false});
        resize();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
        observer?.observe(map.getContainer());
        return () => observer?.disconnect();
    }, [map]);
    return null;
}

export default function RegionalDiscoveryMap({ presentation, selection, onEvent, cameraRequest, onResetMap, copy: overrides }) {
    const copy = regionalDiscoveryCopy(overrides);
    const [coarsePointer, setCoarsePointer] = useState(() => Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches));
    const [interacting, setInteracting] = useState(false);
    const mapEnabled = !coarsePointer || interacting;
    const guardRef = useRef(null);
    const mapRegionRef = useRef(null);
    const hasInteractedRef = useRef(false);
    useEffect(() => {
        const media = globalThis.matchMedia?.('(pointer: coarse)');
        if (!media) return undefined;
        const update = () => {
            hasInteractedRef.current = false;
            setInteracting(false);
            setCoarsePointer(media.matches);
        };
        media.addEventListener?.('change', update);
        return () => media.removeEventListener?.('change', update);
    }, []);
    useLayoutEffect(() => {
        if (!coarsePointer || !hasInteractedRef.current) return;
        // Refs/inert now reflect the committed interaction state. Never focus on initial mount.
        (interacting ? mapRegionRef.current : guardRef.current)?.focus({preventScroll:true});
    }, [coarsePointer, interacting]);
    function release() {
        setInteracting(false);
    }
    function marker(type, placeKey, detail) {
        if ((type === 'PIN_ENTER' || type === 'PIN_LEAVE') && !globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
        onEvent?.(regionalDiscoveryMarkerEvent(type, placeKey, detail, presentation.entryKeysByPlaceKey));
    }
    return <section className="relative flex h-full min-h-0 flex-col" aria-label={copy.mapLabel}
        onMouseDownCapture={event => {
            // Activate on the real click, after mouseup; early activation can move the pin beneath the pointer.
            const target = event.target.closest?.('.leaflet-marker-icon');
            if (event.button === 0 && target && event.currentTarget.contains(target)) event.stopPropagation();
        }}
        onKeyDown={event => { if (event.key === 'Escape' && coarsePointer && interacting) { event.preventDefault(); event.stopPropagation(); release(); } }}>
        {/* Decorative marker children can be replaced on highlight; keep the stable outer icon as the pointer target. */}
        <style>{`.regional-discovery .leaflet-marker-icon *{pointer-events:none}`}</style>
        <div className="flex flex-wrap gap-2 border-b bg-white p-2">
            <button type="button" onClick={onResetMap} className="min-h-[44px] rounded border px-3 focus-visible:outline focus-visible:outline-2">{copy.resetMap}</button>
            {coarsePointer && interacting && <button type="button" onClick={release} className="min-h-[44px] rounded border px-3 focus-visible:outline focus-visible:outline-2">{copy.done}</button>}
        </div>
        <div className="relative min-h-0 flex-1" style={{touchAction:coarsePointer && interacting ? 'none' : 'pan-y'}}>
            <div ref={mapRegionRef} tabIndex={-1} inert={!mapEnabled} className="h-full min-h-0 focus-visible:outline focus-visible:outline-2">
                <DirectoryMap pins={presentation.pins} resourceSelectionMode="external" showResetControl={false}
                    markerMode="number" clusterMarkerMode="none" showPopup={false} showMapStyleControl={false}
                    mapHeightClassName="h-full" className="h-full rounded-none" observeFrameResize={false}
                    activePlaceKeys={selection.placeKeys}
                    onViewSection={(key, detail) => marker('PIN_ACTIVATE', key, detail)}
                    onHoverPlaceStart={(key, detail) => marker('PIN_ENTER', key, detail)}
                    onHoverPlaceEnd={(key, detail) => marker('PIN_LEAVE', key, detail)}
                    onMapClick={() => onEvent?.({type:'DISMISS'})}
                    mapOverlay={<RegionalMapCamera regionBounds={presentation.regionBounds} pins={presentation.pins} cameraRequest={cameraRequest} />} />
            </div>
            {coarsePointer && !interacting && <button type="button" ref={guardRef}
                onClick={() => { hasInteractedRef.current = true; setInteracting(true); }}
                className="absolute inset-0 z-[1100] flex min-h-[44px] items-center justify-center bg-white/30 focus-visible:outline focus-visible:outline-4 focus-visible:outline-teal-700"
                style={{touchAction:'pan-y'}}><span className="rounded-xl bg-white px-5 py-3 font-semibold text-teal-900 shadow">{copy.interact}</span></button>}
        </div>
    </section>;
}
