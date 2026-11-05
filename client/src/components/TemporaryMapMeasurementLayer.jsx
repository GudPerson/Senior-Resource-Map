import { useEffect, useRef, useState } from 'react';
import { Circle, CircleMarker, Pane, Polyline, Tooltip, useMap } from 'react-leaflet';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getAnnotationToolMessages } from '../lib/annotationToolMessages.js';
import { formatRadiusDistance } from '../lib/mapSpatialGeometry.js';
import { mapMeasurementGeometry } from '../lib/mapMeasurement.js';

export default function TemporaryMapMeasurementLayer({ measurement, onPoint }) {
    const map = useMap();
    const { locale } = useLocale();
    const m = getAnnotationToolMessages(locale);
    const currentRef = useRef({ measurement, onPoint });
    currentRef.current = { measurement, onPoint };
    const [previewPoint, setPreviewPoint] = useState(null);
    const geometry = mapMeasurementGeometry(measurement, previewPoint);
    const complete = measurement.points.length === 2;
    useEffect(() => { setPreviewPoint(null); }, [measurement]);
    useEffect(() => {
        if (complete) return undefined;
        const container = map.getContainer();
        const oldCursor = container.style.cursor;
        const dragging = map.dragging.enabled(), doubleClick = map.doubleClickZoom.enabled();
        map.dragging.disable(); map.doubleClickZoom.disable(); container.style.cursor = 'crosshair';
        let previewFrame = null;
        let pendingPoint = null;
        const click = event => {
            if (event.originalEvent?.target?.closest?.('[data-care-map-gesture-ui], .leaflet-control, input, button, select, textarea')) return;
            if (currentRef.current.measurement.points.length < 2) currentRef.current.onPoint([event.latlng.lat, event.latlng.lng]);
        };
        const move = event => {
            if (currentRef.current.measurement.points.length !== 1) return;
            pendingPoint = [event.latlng.lat, event.latlng.lng];
            if (previewFrame !== null) return;
            previewFrame = requestAnimationFrame(() => { previewFrame = null; setPreviewPoint(pendingPoint); });
        };
        map.on('click', click); map.on('mousemove', move);
        return () => {
            if (previewFrame !== null) cancelAnimationFrame(previewFrame);
            map.off('click', click); map.off('mousemove', move);
            container.style.cursor = oldCursor;
            if (dragging) map.dragging.enable();
            if (doubleClick) map.doubleClickZoom.enable();
        };
    }, [complete, map, measurement.kind, measurement.points.length]);

    const pathOptions = { color: '#0f766e', weight: 2, dashArray: '6 5', fillColor: '#14b8a6', fillOpacity: 0.08 };
    return <Pane name="care-map-temporary-measurement" style={{ zIndex: 694, pointerEvents: 'none' }}>
        {geometry.points.length ? <CircleMarker center={geometry.points[0]} radius={5} interactive={false}
            pathOptions={{ color: '#fff', fillColor: '#0f766e', fillOpacity: 1, weight: 2 }} /> : null}
        {geometry.points.length === 2 ? <>
            {measurement.kind === 'radius' ? <Circle center={geometry.points[0]} radius={Math.max(1, geometry.meters)}
                interactive={false} pathOptions={pathOptions} /> : null}
            <Polyline positions={geometry.points} interactive={false} pathOptions={pathOptions}>
                <Tooltip permanent direction="center" opacity={1}>
                    <span data-map-temporary-measurement-label className="whitespace-nowrap text-xs font-bold">
                        {formatRadiusDistance(geometry.meters)} {m[measurement.kind]}
                    </span>
                </Tooltip>
            </Polyline>
        </> : null}
    </Pane>;
}
