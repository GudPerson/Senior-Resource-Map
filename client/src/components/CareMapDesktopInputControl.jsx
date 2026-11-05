import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { attachCareMapDesktopInput } from '../lib/careMapDesktopInputController.js';

export default function CareMapDesktopInputControl({ enabled = false, gain = 1.5, scopeKey = '', cameraKey = '' }) {
    const map = useMap();
    useEffect(() => {
        if (!enabled) return undefined;
        const controller = attachCareMapDesktopInput({
            map,
            gain,
            normalizeWheelDelta: event => L.DomEvent.getWheelDelta(event),
            onError: error => console.error('Care Map desktop input failed', error),
        });
        return () => controller.dispose();
    }, [cameraKey, enabled, gain, map, scopeKey]);
    return null;
}
