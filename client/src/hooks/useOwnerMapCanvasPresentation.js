import { useLayoutEffect, useRef, useState } from 'react';

const FOREGROUND_SELECTOR = 'dialog[open], [role="dialog"], [role="alertdialog"]';

function visibleForegrounds() {
    return [...document.querySelectorAll(FOREGROUND_SELECTOR)].filter((element) => (
        !element.matches('[data-mobile-map-studio-panel], [data-map-studio-design-settings-panel]')
        && !element.closest('[hidden], [aria-hidden="true"], details:not([open])')
        && element.getClientRects().length > 0
        && window.getComputedStyle(element).display !== 'none'
    ));
}

// Presentation only. React keeps ownership of every map, editor and portal node.
export default function useOwnerMapCanvasPresentation({ rootRef, chromeRef, entryStateRef, active, panel, onEscape }) {
    const [mapAvailable, setMapAvailable] = useState(false);
    const [foregroundOpen, setForegroundOpen] = useState(false);
    const refreshRef = useRef(null);
    const panelRef = useRef(panel);
    const escapeRef = useRef(onEscape);
    const restoreFrameRef = useRef(null);
    panelRef.current = panel;
    escapeRef.current = onEscape;

    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root) return undefined;
        const read = () => {
            const maps = [...root.querySelectorAll('.leaflet-container')];
            setMapAvailable(maps.length === 1 && !root.querySelector('[data-mobile-full-map="true"]'));
        };
        read();
        const observer = new MutationObserver(read);
        observer.observe(root, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [rootRef]);

    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!active || !root) return undefined;
        if (restoreFrameRef.current !== null) window.cancelAnimationFrame(restoreFrameRef.current);
        restoreFrameRef.current = null;
        const previousOverflow = document.body.style.overflow;
        const previousFocus = entryStateRef.current?.focus || document.activeElement;
        const previousScroll = entryStateRef.current?.scroll || { top: window.scrollY, left: window.scrollX };
        const path = entryStateRef.current?.path || window.location.pathname;
        const markers = new Map();
        let inertChanges = [];
        let queuedFrame = null;
        let disposed = false;
        document.body.style.overflow = 'hidden';

        const mark = (element, attribute) => {
            if (!element) return;
            if (!markers.has(element)) markers.set(element, new Map());
            const attributes = markers.get(element);
            if (!attributes.has(attribute)) attributes.set(attribute, element.getAttribute(attribute));
            element.setAttribute(attribute, 'true');
        };
        const restoreInert = () => {
            inertChanges.forEach(([element, previous]) => {
                if (element.getAttribute('aria-hidden') !== 'true' && !element.hidden) element.inert = previous;
            });
            inertChanges = [];
        };
        const makeInert = (element) => {
            if (!(element instanceof HTMLElement) || element.inert) return;
            inertChanges.push([element, element.inert]);
            element.inert = true;
        };
        const refresh = () => {
            if (disposed) return;
            restoreInert();
            const map = root.querySelector('.leaflet-container');
            const surface = map?.parentElement;
            if (surface) {
                mark(surface, 'data-owner-canvas-map-surface');
                let ancestor = surface.parentElement;
                while (ancestor && ancestor !== root && !ancestor.matches('[data-owner-canvas-page]')) {
                    if (!ancestor.matches('[data-owner-canvas-resources-root], [data-owner-canvas-resources-body]')) {
                        mark(ancestor, 'data-owner-canvas-map-ancestor');
                    }
                    ancestor = ancestor.parentElement;
                }
            }
            const foregrounds = visibleForegrounds();
            for (const [element, attributes] of markers) {
                if (!attributes.has('data-owner-canvas-foreground')) continue;
                if (!foregrounds.includes(element)) element.removeAttribute('data-owner-canvas-foreground');
            }
            foregrounds.forEach(element => mark(element, 'data-owner-canvas-foreground'));
            setForegroundOpen(foregrounds.length > 0);
            const currentPanel = panelRef.current;
            const panelNode = currentPanel === 'studio'
                ? root.querySelector('[data-map-studio-owner-panel]')
                : currentPanel === 'resources'
                    ? root.querySelector('[data-owner-canvas-resources-root]')
                    : null;
            const allowed = foregrounds.length
                ? foregrounds
                : [surface, chromeRef.current, panelNode].filter(Boolean);
            const visit = (element) => {
                if (!(element instanceof HTMLElement) || allowed.includes(element)) return;
                if (!allowed.some(target => element.contains(target))) {
                    makeInert(element);
                    return;
                }
                [...element.children].forEach(visit);
            };
            [...root.children].forEach(visit);
            let node = root;
            while (node.parentElement && node.parentElement.tagName !== 'BODY') {
                const parent = node.parentElement;
                [...parent.children].forEach(sibling => {
                    if (sibling !== node && !foregrounds.some(dialog => sibling.contains(dialog))) makeInert(sibling);
                });
                node = parent;
            }
            if (currentPanel !== 'annotations') {
                root.querySelectorAll('[data-print-annotation-toolbar]').forEach(makeInert);
            }
        };
        const scheduleRefresh = () => {
            if (queuedFrame !== null) return;
            queuedFrame = window.requestAnimationFrame(() => {
                queuedFrame = null;
                refresh();
            });
        };
        refreshRef.current = refresh;
        refresh();
        const observer = new MutationObserver(scheduleRefresh);
        observer.observe(document.body, { childList: true, subtree: true });
        const resizeFrame = window.requestAnimationFrame(() => {
            // Existing Leaflet frame/resize handlers retain camera ownership.
            window.dispatchEvent(new Event('resize'));
        });
        const handleEscape = (event) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            const foregroundAtKeydown = visibleForegrounds().length > 0;
            queueMicrotask(() => {
                if (disposed || event.defaultPrevented || foregroundAtKeydown) return;
                escapeRef.current?.();
            });
        };
        window.addEventListener('keydown', handleEscape);
        return () => {
            disposed = true;
            observer.disconnect();
            window.removeEventListener('keydown', handleEscape);
            window.cancelAnimationFrame(resizeFrame);
            if (queuedFrame !== null) window.cancelAnimationFrame(queuedFrame);
            refreshRef.current = null;
            restoreInert();
            for (const [element, attributes] of markers) {
                for (const [attribute, previous] of attributes) {
                    if (previous === null) element.removeAttribute(attribute);
                    else element.setAttribute(attribute, previous);
                }
            }
            document.body.style.overflow = previousOverflow;
            setForegroundOpen(false);
            restoreFrameRef.current = window.requestAnimationFrame(() => {
                restoreFrameRef.current = null;
                window.dispatchEvent(new Event('resize'));
                if (window.location.pathname !== path) return;
                window.scrollTo(previousScroll);
                const target = previousFocus instanceof HTMLElement && previousFocus !== document.body && previousFocus.isConnected
                    ? previousFocus : root.querySelector('[data-owner-canvas-enter]');
                if (target instanceof HTMLElement && !target.closest('[inert], [hidden]') && target.getClientRects().length) {
                    target.focus({ preventScroll: true });
                }
            });
        };
    }, [active, chromeRef, entryStateRef, rootRef]);

    useLayoutEffect(() => { refreshRef.current?.(); }, [panel]);

    return { mapAvailable, foregroundOpen };
}
