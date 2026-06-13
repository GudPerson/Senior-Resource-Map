export const MAP_NOTE_TEXTAREA_MIN_HEIGHT = 96;
export const MAP_NOTE_TEXTAREA_FOCUSED_MAX_HEIGHT = 260;

function normalizeHeight(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function resizeTextareaToContent(textarea, options = {}) {
    if (!textarea?.style) {
        return { height: '', overflowY: 'hidden' };
    }

    const minHeight = normalizeHeight(options.minHeight, MAP_NOTE_TEXTAREA_MIN_HEIGHT);
    const maxHeight = Number(options.maxHeight);

    textarea.style.height = 'auto';

    const contentHeight = normalizeHeight(textarea.scrollHeight, minHeight);
    const desiredHeight = Math.max(minHeight, contentHeight);
    const hasMaxHeight = Number.isFinite(maxHeight) && maxHeight > 0;
    const nextHeight = hasMaxHeight ? Math.min(desiredHeight, maxHeight) : desiredHeight;
    const overflowY = hasMaxHeight && desiredHeight > maxHeight ? 'auto' : 'hidden';

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = overflowY;

    return {
        height: textarea.style.height,
        overflowY,
    };
}
