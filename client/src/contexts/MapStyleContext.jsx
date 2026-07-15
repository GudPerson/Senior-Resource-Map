import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
    CAREAROUND_MAP_STYLE_DEFAULT,
    CAREAROUND_MAP_STYLE_STORAGE_KEY,
    normalizeCareAroundMapStyle,
} from '../lib/mapTheme.js';

const MapStyleContext = createContext({
    mapStyle: CAREAROUND_MAP_STYLE_DEFAULT,
    setMapStyle: () => {},
});

function readStoredMapStyle() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return CAREAROUND_MAP_STYLE_DEFAULT;
    }
    try {
        return normalizeCareAroundMapStyle(window.localStorage.getItem(CAREAROUND_MAP_STYLE_STORAGE_KEY));
    } catch {
        return CAREAROUND_MAP_STYLE_DEFAULT;
    }
}

export function MapStyleProvider({ children }) {
    const [mapStyle, setMapStyleState] = useState(readStoredMapStyle);

    const setMapStyle = useCallback((nextStyle) => {
        setMapStyleState(normalizeCareAroundMapStyle(nextStyle));
    }, []);

    useEffect(() => {
        try {
            window.localStorage?.setItem(CAREAROUND_MAP_STYLE_STORAGE_KEY, mapStyle);
        } catch {
            // The current page still uses the selected style when storage is unavailable.
        }
    }, [mapStyle]);

    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key !== CAREAROUND_MAP_STYLE_STORAGE_KEY) return;
            setMapStyleState(normalizeCareAroundMapStyle(event.newValue));
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const value = useMemo(() => ({ mapStyle, setMapStyle }), [mapStyle, setMapStyle]);

    return (
        <MapStyleContext.Provider value={value}>
            {children}
        </MapStyleContext.Provider>
    );
}

export function useMapStyle() {
    return useContext(MapStyleContext);
}
