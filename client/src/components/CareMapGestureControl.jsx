import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigation, RotateCcw, RotateCw } from 'lucide-react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { alignCareMapGeographicLayers, refreshCareMapSvgProjection } from '../lib/careMapRotation.js';
import { isCareMapGestureActive, normalizeCareMapBearing } from '../lib/careMapGestureState.js';

export default function CareMapGestureControl({ configuration, interactive = true }) {
    const map = useMap();
    const { t } = useLocale();
    const [target, setTarget] = useState(null);
    const configurationRef = useRef(configuration);
    configurationRef.current = configuration;
    const active = configuration?.active !== false;
    const paused = Boolean(configuration?.paused);
    const bearing = normalizeCareMapBearing(configuration?.bearing);

    useEffect(() => {
        if (!map._rotate) return undefined;
        const refreshSvg = () => refreshCareMapSvgProjection(map);
        const align = () => {
            alignCareMapGeographicLayers(map);
            // Run after newly added paths receive their live zoom projection.
            map.off('zoom', refreshSvg); map.on('zoom', refreshSvg);
        };
        align(); map.on('layeradd', align);
        return () => { map.off('layeradd', align); map.off('zoom', refreshSvg); };
    }, [map]);

    useEffect(() => {
        if (!map._rotate) return undefined;
        const canRotate = interactive && active && !paused;
        if (interactive && active) map.scrollWheelZoom?.enable(); else map.scrollWheelZoom?.disable();
        map.options.touchRotate = canRotate;
        map.options.shiftKeyRotate = canRotate;
        map.options.dragRotate = canRotate;
        for (const handler of [map.shiftKeyRotate, map.dragRotate]) {
            if (canRotate) handler?.enable(); else handler?.disable();
        }
        if (canRotate) { map.touchZoom?.disable(); map.touchGestures?.enable(); }
        else { map.touchGestures?.disable(); if (interactive && active) map.touchZoom?.enable(); else map.touchZoom?.disable(); }
        if (Math.abs(map.getBearing() - bearing) > 0.000001) map.setBearing(bearing);
        return undefined;
    }, [active, bearing, interactive, map, paused]);

    useEffect(() => {
        if (!active || !map._rotate) return undefined;
        let timer;
        const publish = () => {
            window.clearTimeout(timer);
            if (isCareMapGestureActive(map)) return;
            configurationRef.current?.onBearingChange?.(map.getBearing());
        };
        const rotate = () => {
            // Detailed's loader follows move/zoom; rotation expands its viewport.
            map.fire('move');
            window.clearTimeout(timer); timer = window.setTimeout(publish, 120);
        };
        map.on('rotate', rotate); map.on('moveend zoomend rotateend', publish);
        return () => {
            window.clearTimeout(timer); map.off('rotate', rotate);
            map.off('moveend zoomend rotateend', publish);
        };
    }, [active, map]);

    useEffect(() => {
        if (!active || !map._rotate) return undefined;
        const control = L.control({ position: 'topleft' });
        control.onAdd = () => {
            const container = L.DomUtil.create('div', 'care-map-gesture-control');
            L.DomEvent.disableClickPropagation(container); L.DomEvent.disableScrollPropagation(container);
            setTarget(container); return container;
        };
        control.addTo(map);
        return () => { setTarget(null); control.remove(); };
    }, [active, map]);

    if (!target) return null;
    const rotate = delta => {
        map.setBearing(normalizeCareMapBearing(map.getBearing() + delta));
        configurationRef.current?.onBearingChange?.(map.getBearing());
    };
    const className = 'inline-flex h-11 w-11 items-center justify-center bg-white text-slate-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 disabled:text-slate-300';
    return createPortal(
        <div role="group" aria-label={t('careMapRotationControls')} title={t('careMapGesturesHint')}
            className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-care-map-gestures="true">
            <button type="button" className={className} disabled={paused || !interactive}
                onClick={() => rotate(-45)} aria-label={t('careMapRotateLeft')} title={t('careMapRotateLeft')}>
                <RotateCcw size={19} aria-hidden="true" />
            </button>
            <button type="button" className={className} disabled={!interactive} onClick={() => rotate(-map.getBearing())}
                aria-label={t('careMapResetNorth')} title={t('careMapResetNorth')}>
                <Navigation size={20} style={{ transform: `rotate(${-bearing}deg)` }} aria-hidden="true" />
            </button>
            <button type="button" className={className} disabled={paused || !interactive}
                onClick={() => rotate(45)} aria-label={t('careMapRotateRight')} title={t('careMapRotateRight')}>
                <RotateCw size={19} aria-hidden="true" />
            </button>
        </div>, target,
    );
}
