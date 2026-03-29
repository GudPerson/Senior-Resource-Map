import { useCallback, useEffect, useState } from 'react';

const MIN_PANE_WIDTH = 430;
const MAX_PANE_WIDTH_RATIO = 0.7;

export function useSplitPaneResize(initialWidth = 450) {
    const getMaxPaneWidth = useCallback(() => (
        typeof window === 'undefined'
            ? Math.max(MIN_PANE_WIDTH, initialWidth)
            : Math.max(MIN_PANE_WIDTH, window.innerWidth * MAX_PANE_WIDTH_RATIO)
    ), [initialWidth]);

    const clampPaneWidth = useCallback((width) => (
        Math.max(MIN_PANE_WIDTH, Math.min(width, getMaxPaneWidth()))
    ), [getMaxPaneWidth]);

    const [listWidth, setListWidth] = useState(() => clampPaneWidth(initialWidth));
    const [isDragging, setIsDragging] = useState(false);
    const [maxPaneWidth, setMaxPaneWidth] = useState(() => getMaxPaneWidth());

    const startDragging = useCallback((event) => {
        setIsDragging(true);
        event.preventDefault();
    }, []);

    useEffect(() => {
        const onMouseMove = (event) => {
            if (!isDragging) return;
            setListWidth(clampPaneWidth(event.clientX));
        };

        const onMouseUp = () => {
            setIsDragging(false);
            window.dispatchEvent(new Event('resize'));
        };

        if (isDragging) {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [clampPaneWidth, isDragging]);

    const setPaneWidth = useCallback((nextWidth) => {
        setListWidth((currentWidth) => {
            const resolvedWidth = typeof nextWidth === 'function' ? nextWidth(currentWidth) : nextWidth;
            return clampPaneWidth(resolvedWidth);
        });
    }, [clampPaneWidth]);

    useEffect(() => {
        const syncWidthToViewport = () => {
            const nextMaxPaneWidth = getMaxPaneWidth();
            setMaxPaneWidth(nextMaxPaneWidth);
            setListWidth((currentWidth) => clampPaneWidth(currentWidth));
        };

        syncWidthToViewport();
        window.addEventListener('resize', syncWidthToViewport);
        return () => {
            window.removeEventListener('resize', syncWidthToViewport);
        };
    }, [clampPaneWidth, getMaxPaneWidth]);

    return { isDragging, listWidth, maxPaneWidth, setPaneWidth, startDragging };
}
