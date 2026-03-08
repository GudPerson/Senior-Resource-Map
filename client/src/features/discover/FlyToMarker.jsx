import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

export function FlyToMarker({ target, bottomOffsetPx = 0 }) {
    const map = useMap();
    const prevTarget = useRef(null);

    useEffect(() => {
        if (!target) return;
        const key = JSON.stringify(target) + bottomOffsetPx;
        if (key === prevTarget.current) return;

        const size = map.getSize();
        if (size.x === 0 || size.y === 0) return;

        prevTarget.current = key;
        const zoom = target.zoom || 15;

        if (bottomOffsetPx > 0) {
            const targetPoint = map.project([target.lat, target.lng], zoom);
            targetPoint.y += bottomOffsetPx / 2;
            const offsetLatLng = map.unproject(targetPoint, zoom);
            map.flyTo(offsetLatLng, zoom, { animate: true, duration: 0.8 });
            return;
        }

        map.flyTo([target.lat, target.lng], zoom, { animate: true, duration: 0.8 });
    }, [target, map, bottomOffsetPx]);

    return null;
}
