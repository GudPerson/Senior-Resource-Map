import { createContext, useContext, useState, useEffect } from 'react';

const A11yContext = createContext(null);
const MIN_ZOOM = 0.6;
const ZOOM_STEP = 0.1;
const MAX_ZOOM_STEPS_FROM_MIN = 5;
const MAX_ZOOM = Number((MIN_ZOOM + (ZOOM_STEP * MAX_ZOOM_STEPS_FROM_MIN)).toFixed(1));
const DESKTOP_MAX_ZOOM = MAX_ZOOM;
const MOBILE_MAX_ZOOM = MAX_ZOOM;

function normalizeZoomLevel(value, maxZoom = getCurrentMaxZoom()) {
    const numericZoom = Number(value);
    const roundedZoom = Number.isFinite(numericZoom) ? Number(numericZoom.toFixed(1)) : 1;
    return Math.min(Math.max(roundedZoom, MIN_ZOOM), maxZoom);
}

function getCurrentMaxZoom() {
    if (typeof window === 'undefined') {
        return DESKTOP_MAX_ZOOM;
    }

    return window.matchMedia('(max-width: 1023px)').matches ? MOBILE_MAX_ZOOM : DESKTOP_MAX_ZOOM;
}

export function A11yProvider({ children }) {
    const [highContrast, setHighContrast] = useState(() => localStorage.getItem('sc_hc') === 'true');
    const [maxZoom, setMaxZoom] = useState(getCurrentMaxZoom);
    const [zoomLevel, setZoomLevel] = useState(() => {
        return normalizeZoomLevel(localStorage.getItem('sc_zoom') || 1);
    });

    useEffect(() => {
        document.documentElement.classList.toggle('high-contrast', highContrast);
        localStorage.setItem('sc_hc', highContrast);
    }, [highContrast]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const mediaQuery = window.matchMedia('(max-width: 1023px)');
        const updateMaxZoom = () => setMaxZoom(mediaQuery.matches ? MOBILE_MAX_ZOOM : DESKTOP_MAX_ZOOM);

        updateMaxZoom();
        mediaQuery.addEventListener('change', updateMaxZoom);
        return () => mediaQuery.removeEventListener('change', updateMaxZoom);
    }, []);

    useEffect(() => {
        setZoomLevel((currentZoom) => normalizeZoomLevel(currentZoom, maxZoom));
    }, [maxZoom]);

    useEffect(() => {
        document.documentElement.style.setProperty('--font-scale', zoomLevel);
        localStorage.setItem('sc_zoom', zoomLevel);
    }, [zoomLevel]);

    const canIncreaseZoom = zoomLevel < maxZoom - 0.001;
    const canDecreaseZoom = zoomLevel > MIN_ZOOM + 0.001;

    return (
        <A11yContext.Provider value={{
            highContrast,
            toggleHighContrast: () => setHighContrast(v => !v),
            zoomLevel,
            maxZoom,
            canIncreaseZoom,
            canDecreaseZoom,
            increaseZoom: () => setZoomLevel(z => normalizeZoomLevel(z + ZOOM_STEP, maxZoom)),
            decreaseZoom: () => setZoomLevel(z => normalizeZoomLevel(z - ZOOM_STEP, maxZoom))
        }}>
            {children}
        </A11yContext.Provider>
    );
}

export function useA11y() {
    const ctx = useContext(A11yContext);
    if (!ctx) throw new Error('useA11y must be inside A11yProvider');
    return ctx;
}
