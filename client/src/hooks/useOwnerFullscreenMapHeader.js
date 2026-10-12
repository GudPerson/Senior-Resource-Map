import { useLayoutEffect, useState } from 'react';

// Reserve the existing owner header rather than cloning its menus or title.
export function useOwnerFullscreenMapHeader(enabled) {
    const [top, setTop] = useState(null);
    useLayoutEffect(() => {
        if (!enabled) {
            setTop(null);
            return undefined;
        }
        const header = document.querySelector('[data-owner-map-mobile-header="true"]');
        if (!header) return undefined;
        const body = document.body;
        const attribute = 'data-owner-fullscreen-map-header';
        const previous = body.getAttribute(attribute);
        body.setAttribute(attribute, 'true');
        const measure = () => {
            const navbarHeight = window.matchMedia('(min-width: 640px)').matches ? 64 : 56;
            setTop(navbarHeight + header.getBoundingClientRect().height);
        };
        measure();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
        observer?.observe(header);
        window.addEventListener('resize', measure);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', measure);
            if (previous === null) body.removeAttribute(attribute);
            else body.setAttribute(attribute, previous);
        };
    }, [enabled]);
    return top;
}
