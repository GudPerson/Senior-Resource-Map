import { useCallback, useEffect, useState } from 'react';

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
            const newWidth = Math.max(300, Math.min(event.clientX, window.innerWidth * 0.7));
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

    return { isDragging, listWidth, startDragging };
}
