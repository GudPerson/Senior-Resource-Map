import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { alignCareMapGeographicLayers, refreshCareMapSvgProjection } from '../lib/careMapRotation.js';
import { isCareMapGestureActive, normalizeCareMapBearing } from '../lib/careMapGestureState.js';
import CareMapNorthButton from './CareMapNorthButton.jsx';

export default function CareMapGestureControl({ configuration, interactive = true }) {
    const map = useMap();
    const { t } = useLocale();
    const [target, setTarget] = useState(null);
    const configurationRef = useRef(configuration);
    configurationRef.current = configuration;
    const active = configuration?.active !== false;
    const paused = Boolean(configuration?.paused);
    const bearing = normalizeCareMapBearing(configuration?.bearing);
    const showNorthControl = configuration?.showNorthControl !== false;

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
        if (!active || !showNorthControl || !map._rotate) return undefined;
        const control = L.control({ position: 'bottomright' });
        control.onAdd = () => {
            const container = L.DomUtil.create('div', 'care-map-gesture-control');
            L.DomEvent.disableClickPropagation(container); L.DomEvent.disableScrollPropagation(container);
            setTarget(container); return container;
        };
        control.addTo(map);
        return () => { setTarget(null); control.remove(); };
    }, [active, map, showNorthControl]);

    if (!target || !showNorthControl) return null;
    const resetNorth = () => {
        map.setBearing(0);
        configurationRef.current?.onBearingChange?.(map.getBearing());
    };
    return createPortal(
        <div role="group" aria-label={t('careMapRotationControls')} title={t('careMapGesturesHint')}
            data-care-map-gestures="true">
            <CareMapNorthButton configuration={configuration} interactive={interactive} onReset={resetNorth} />
        </div>, target,
    );
}
