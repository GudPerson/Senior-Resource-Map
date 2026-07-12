import { cloneElement, useEffect, useRef, useState } from 'react';
import { GripHorizontal } from 'lucide-react';

import { useLocale } from '../contexts/LocaleContext.jsx';
import {
    DESKTOP_MAP_HEIGHT_KEYBOARD_STEP_PX,
    clampDesktopMapHeight,
    getDesktopMapHeightBounds,
} from '../lib/resizableMapFrame.js';

function getInitialBounds() {
    return getDesktopMapHeightBounds(typeof window === 'undefined' ? 900 : window.innerHeight);
}

export default function ResizableDesktopMapSurface({
    mapElement,
    onClusterChange,
}) {
    const { t } = useLocale();
    const initialBounds = getInitialBounds();
    const boundsRef = useRef(initialBounds);
    const heightRef = useRef(initialBounds.defaultHeight);
    const dragRef = useRef(null);
    const resizeFrameRef = useRef(null);
    const bodyStyleRef = useRef(null);
    const [height, setHeight] = useState(initialBounds.defaultHeight);

    function restoreBodyInteraction() {
        if (!bodyStyleRef.current || typeof document === 'undefined') return;
        document.body.style.userSelect = bodyStyleRef.current.userSelect;
        document.body.style.cursor = bodyStyleRef.current.cursor;
        bodyStyleRef.current = null;
    }

    function applyHeight(nextHeight) {
        const clampedHeight = clampDesktopMapHeight(nextHeight, boundsRef.current);
        heightRef.current = clampedHeight;
        if (resizeFrameRef.current !== null) return;
        resizeFrameRef.current = window.requestAnimationFrame(() => {
            resizeFrameRef.current = null;
            setHeight(heightRef.current);
        });
    }

    function finishDrag(event) {
        const dragState = dragRef.current;
        if (!dragState || (event?.pointerId !== undefined && event.pointerId !== dragState.pointerId)) return;
        dragRef.current = null;
        if (event?.currentTarget?.hasPointerCapture?.(dragState.pointerId)) {
            event.currentTarget.releasePointerCapture(dragState.pointerId);
        }
        if (resizeFrameRef.current !== null) {
            window.cancelAnimationFrame(resizeFrameRef.current);
            resizeFrameRef.current = null;
        }
        setHeight(heightRef.current);
        restoreBodyInteraction();
    }

    function handlePointerDown(event) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight: heightRef.current,
        };
        if (typeof document !== 'undefined') {
            bodyStyleRef.current = {
                userSelect: document.body.style.userSelect,
                cursor: document.body.style.cursor,
            };
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'ns-resize';
        }
    }

    function handlePointerMove(event) {
        const dragState = dragRef.current;
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        event.preventDefault();
        applyHeight(dragState.startHeight + event.clientY - dragState.startY);
    }

    function handleKeyDown(event) {
        const bounds = boundsRef.current;
        let nextHeight = null;
        if (event.key === 'ArrowDown') {
            nextHeight = heightRef.current + DESKTOP_MAP_HEIGHT_KEYBOARD_STEP_PX;
        } else if (event.key === 'ArrowUp') {
            nextHeight = heightRef.current - DESKTOP_MAP_HEIGHT_KEYBOARD_STEP_PX;
        } else if (event.key === 'Home') {
            nextHeight = bounds.defaultHeight;
        } else if (event.key === 'End') {
            nextHeight = bounds.maximumHeight;
        }
        if (nextHeight === null) return;
        event.preventDefault();
        applyHeight(nextHeight);
    }

    function resetHeight() {
        applyHeight(boundsRef.current.defaultHeight);
    }

    useEffect(() => {
        function handleViewportResize() {
            const nextBounds = getDesktopMapHeightBounds(window.innerHeight);
            boundsRef.current = nextBounds;
            applyHeight(heightRef.current);
        }

        window.addEventListener('resize', handleViewportResize, { passive: true });
        return () => {
            window.removeEventListener('resize', handleViewportResize);
            if (resizeFrameRef.current !== null) {
                window.cancelAnimationFrame(resizeFrameRef.current);
            }
            restoreBodyInteraction();
        };
    }, []);

    const bounds = boundsRef.current;

    return (
        <div
            className="relative mb-3"
            style={{ height: `${height}px` }}
            data-resizable-desktop-map="true"
            data-map-height={height}
        >
            {cloneElement(mapElement, {
                mapHeightClassName: 'h-full min-h-0 max-h-none',
                observeFrameResize: true,
                onClusterChange,
            })}
            <div
                role="separator"
                aria-label={t('resizeMapHeight')}
                aria-orientation="horizontal"
                aria-valuemin={bounds.minimumHeight}
                aria-valuemax={bounds.maximumHeight}
                aria-valuenow={height}
                tabIndex={0}
                title={t('resizeMapHeightHelp')}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onDoubleClick={resetHeight}
                onKeyDown={handleKeyDown}
                className="absolute bottom-0 left-1/2 z-[1100] flex h-8 w-28 -translate-x-1/2 translate-y-1/2 cursor-ns-resize touch-none items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-md transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100"
                data-map-resize-handle="true"
            >
                <GripHorizontal size={18} strokeWidth={2.4} aria-hidden="true" />
            </div>
        </div>
    );
}
