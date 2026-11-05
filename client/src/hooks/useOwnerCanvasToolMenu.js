import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const EXCLUDED_TARGETS = [
    'button', 'a', 'input', 'select', 'textarea', 'summary', '[contenteditable="true"]',
    '[data-care-map-gesture-ui]', '[data-map-settings-control]', '[data-print-annotation-toolbar]',
    '.leaflet-control', '.carearound-print-annotation-vertex', '.carearound-print-annotation-draft-preview',
    '[role="menu"]', '[role="dialog"]', '[role="alertdialog"]',
].join(',');

function eligibleMapTarget(root, target) {
    return target instanceof Element && root?.contains(target)
        && target.closest('[data-owner-canvas-map-surface]')
        && !target.closest(EXCLUDED_TARGETS);
}

// Observe the native secondary-button stream. Leaflet retains complete ownership
// of down/move/up, including rotation; only an admitted contextmenu is suppressed.
export default function useOwnerCanvasToolMenu({ active, rootRef, scopeKey, bearing }) {
    const [menu, setMenu] = useState(null);
    const menuRef = useRef(null);
    const menuStateRef = useRef(null);
    const candidateRef = useRef(null);
    const activeRef = useRef(active);
    const restoreFrameRef = useRef(null);
    const bearingRef = useRef(bearing);
    activeRef.current = active;

    const closeMenu = useCallback((restoreFocus = true) => {
        const previous = menuStateRef.current;
        menuStateRef.current = null;
        setMenu(null);
        if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
        restoreFrameRef.current = null;
        if (!restoreFocus || !previous) return;
        restoreFrameRef.current = requestAnimationFrame(() => {
            restoreFrameRef.current = null;
            if (!activeRef.current) return;
            const oldTarget = previous.focusTarget;
            const target = oldTarget instanceof HTMLElement && oldTarget.isConnected
                ? oldTarget : rootRef.current?.querySelector('.leaflet-container');
            if (target instanceof HTMLElement && !target.closest('[inert], [hidden]')) target.focus({ preventScroll: true });
        });
    }, [rootRef]);

    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!active || !root) return undefined;
        let disposed = false;
        let admissionFrame = null;
        const show = (point, focusTarget) => {
            if (disposed || !activeRef.current) return;
            const next = { x: point.x, y: point.y, focusTarget };
            menuStateRef.current = next;
            setMenu(next);
        };
        const admitAfterRelease = (candidate) => {
            if (!candidate || candidate.queued || !candidate.released || !candidate.contextRequested) return;
            candidate.queued = true;
            // A microtask from capture-mouseup can run before the rotation
            // plugin's bubble cleanup. Admit only after that dispatch finishes.
            admissionFrame = requestAnimationFrame(() => {
                admissionFrame = null;
                if (disposed || !activeRef.current || candidateRef.current !== candidate || candidate.dragged
                    || !candidate.surface.isConnected || !eligibleMapTarget(root, candidate.target)) return;
                show(candidate.anchor, candidate.surface.querySelector('.leaflet-container'));
            });
        };
        const observeDown = (event) => {
            if (menuRef.current?.contains(event.target)) return;
            closeMenu(false);
            candidateRef.current = null;
            if (event.button !== 2 || !eligibleMapTarget(root, event.target)) return;
            candidateRef.current = {
                x: event.clientX, y: event.clientY,
                anchor: { x: event.clientX, y: event.clientY },
                target: event.target,
                surface: event.target.closest('[data-owner-canvas-map-surface]'),
                dragged: false, released: false, contextRequested: false, queued: false,
            };
        };
        const observeMove = (event) => {
            const candidate = candidateRef.current;
            if (!candidate || candidate.released) return;
            if (!(event.buttons & 2)) { candidateRef.current = null; return; }
            // The pinned rotation handler starts at two CSS pixels. Never undo
            // this latch when a drag returns to its starting coordinate.
            if (Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) >= 2) candidate.dragged = true;
        };
        const observeUp = (event) => {
            const candidate = candidateRef.current;
            if (!candidate || event.button !== 2) return;
            if (Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) >= 2) candidate.dragged = true;
            candidate.released = true;
            candidate.releasedAt = performance.now();
            admitAfterRelease(candidate);
        };
        const handleContext = (event) => {
            if (!eligibleMapTarget(root, event.target)) return;
            const candidate = candidateRef.current;
            if (!candidate || (candidate.released && performance.now() - candidate.releasedAt > 600)) return;
            if (event.target.closest('[data-owner-canvas-map-surface]') !== candidate.surface) return;
            // Leaflet's rotation plugin legitimately prevents this event too.
            // defaultPrevented is not an indication of a UI/menu target.
            event.preventDefault();
            candidate.contextRequested = true;
            admitAfterRelease(candidate);
        };
        const handleKeyboard = (event) => {
            if (!(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
                || !eligibleMapTarget(root, event.target)) return;
            event.preventDefault();
            candidateRef.current = null;
            const target = event.target;
            const rect = target.getBoundingClientRect();
            show({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, target);
        };
        const outside = (event) => {
            if (menuStateRef.current && !menuRef.current?.contains(event.target)) closeMenu(false);
        };
        const cancel = () => { candidateRef.current = null; closeMenu(false); };
        const resized = () => { candidateRef.current = null; closeMenu(true); };
        root.addEventListener('mousedown', observeDown, true);
        root.addEventListener('contextmenu', handleContext, true);
        root.addEventListener('keydown', handleKeyboard, true);
        document.addEventListener('mousedown', outside, true);
        document.addEventListener('focusin', outside);
        document.addEventListener('mousemove', observeMove, true);
        document.addEventListener('mouseup', observeUp, true);
        window.addEventListener('blur', cancel);
        window.addEventListener('resize', resized);
        window.addEventListener('pointercancel', cancel);
        return () => {
            disposed = true;
            root.removeEventListener('mousedown', observeDown, true);
            root.removeEventListener('contextmenu', handleContext, true);
            root.removeEventListener('keydown', handleKeyboard, true);
            document.removeEventListener('mousedown', outside, true);
            document.removeEventListener('focusin', outside);
            document.removeEventListener('mousemove', observeMove, true);
            document.removeEventListener('mouseup', observeUp, true);
            window.removeEventListener('blur', cancel);
            window.removeEventListener('resize', resized);
            window.removeEventListener('pointercancel', cancel);
            if (admissionFrame !== null) cancelAnimationFrame(admissionFrame);
            candidateRef.current = null;
            closeMenu(false);
        };
    }, [active, closeMenu, rootRef, scopeKey]);

    useLayoutEffect(() => {
        if (bearingRef.current !== bearing) {
            if (candidateRef.current) candidateRef.current.dragged = true;
            closeMenu(false);
        }
        bearingRef.current = bearing;
    }, [bearing, closeMenu]);

    return { menu, menuRef, closeMenu };
}
