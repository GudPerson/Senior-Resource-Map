import { useCallback, useEffect, useState } from 'react';

const MIN_PANE_WIDTH = 430;
const MAX_PANE_WIDTH_RATIO = 0.7;

export function useSplitPaneResize(initialWidth = 450) {
    const [listWidth, setListWidth] = useState(initialWidth);
    const [isDragging, setIsDragging] = useState(false);

    const startDragging = useCallback((event) => {
        setIsDragging(true);
        event.preventDefault();
    }, []);

    useEffect(() => {
        const onMouseMove = (event) => {
            if (!isDragging) return;
            const newWidth = Math.max(MIN_PANE_WIDTH, Math.min(event.clientX, window.innerWidth * MAX_PANE_WIDTH_RATIO));
            setListWidth(newWidth);
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
    }, [isDragging]);

    useEffect(() => {
        const syncWidthToViewport = () => {
            setListWidth((currentWidth) => (
                Math.max(MIN_PANE_WIDTH, Math.min(currentWidth, window.innerWidth * MAX_PANE_WIDTH_RATIO))
            ));
        };

        syncWidthToViewport();
        window.addEventListener('resize', syncWidthToViewport);
        return () => {
            window.removeEventListener('resize', syncWidthToViewport);
        };
    }, []);

    return { isDragging, listWidth, startDragging };
}
