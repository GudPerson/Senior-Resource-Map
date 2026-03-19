import { createContext, useContext, useState, useEffect } from 'react';

const A11yContext = createContext(null);
const MIN_ZOOM = 0.6;
const DESKTOP_MAX_ZOOM = 1.6;
const MOBILE_MAX_ZOOM = 1.2;

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
        const storedZoom = Number(localStorage.getItem('sc_zoom') || 1);
        return Math.min(Math.max(storedZoom, MIN_ZOOM), getCurrentMaxZoom());
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
        setZoomLevel((currentZoom) => Math.min(Math.max(currentZoom, MIN_ZOOM), maxZoom));
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
            increaseZoom: () => setZoomLevel(z => Math.min(z + 0.1, maxZoom)),
            decreaseZoom: () => setZoomLevel(z => Math.max(z - 0.1, MIN_ZOOM))
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
