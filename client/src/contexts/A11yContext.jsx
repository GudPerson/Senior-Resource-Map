import { createContext, useContext, useState, useEffect } from 'react';

const A11yContext = createContext(null);

export function A11yProvider({ children }) {
    const [highContrast, setHighContrast] = useState(() => localStorage.getItem('sc_hc') === 'true');
    const [zoomLevel, setZoomLevel] = useState(() => Number(localStorage.getItem('sc_zoom') || 1));

    useEffect(() => {
        document.documentElement.classList.toggle('high-contrast', highContrast);
        localStorage.setItem('sc_hc', highContrast);
    }, [highContrast]);

    useEffect(() => {
        document.documentElement.style.setProperty('--font-scale', zoomLevel);
        localStorage.setItem('sc_zoom', zoomLevel);
    }, [zoomLevel]);

    return (
        <A11yContext.Provider value={{
            highContrast,
            toggleHighContrast: () => setHighContrast(v => !v),
            zoomLevel,
            increaseZoom: () => setZoomLevel(z => Math.min(z + 0.1, 1.6)),
            decreaseZoom: () => setZoomLevel(z => Math.max(z - 0.1, 0.6))
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
