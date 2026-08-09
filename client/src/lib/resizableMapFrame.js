export const DESKTOP_MAP_HEIGHT_RATIO = 0.48;
export const DESKTOP_MAP_HEIGHT_MIN_PX = 440;
export const DESKTOP_MAP_HEIGHT_DEFAULT_MAX_PX = 700;
export const DESKTOP_MAP_HEIGHT_EXPANDED_RATIO = 0.78;
export const DESKTOP_MAP_HEIGHT_EXPANDED_MAX_PX = 840;
export const DESKTOP_MAP_HEIGHT_KEYBOARD_STEP_PX = 40;

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}

export function getDesktopMapHeightBounds(viewportHeight) {
    const safeViewportHeight = Number.isFinite(Number(viewportHeight)) && Number(viewportHeight) > 0
        ? Number(viewportHeight)
        : 900;
    const defaultHeight = Math.round(clamp(
        safeViewportHeight * DESKTOP_MAP_HEIGHT_RATIO,
        DESKTOP_MAP_HEIGHT_MIN_PX,
        DESKTOP_MAP_HEIGHT_DEFAULT_MAX_PX,
    ));
    const maximumHeight = Math.max(defaultHeight, Math.round(Math.min(
        safeViewportHeight * DESKTOP_MAP_HEIGHT_EXPANDED_RATIO,
        DESKTOP_MAP_HEIGHT_EXPANDED_MAX_PX,
    )));

    return {
        minimumHeight: defaultHeight,
        defaultHeight,
        maximumHeight,
    };
}

export function clampDesktopMapHeight(height, bounds) {
    const minimumHeight = Number(bounds?.minimumHeight);
    const maximumHeight = Number(bounds?.maximumHeight);
    const resolvedHeight = Number(height);
    if (![minimumHeight, maximumHeight, resolvedHeight].every(Number.isFinite)) {
        return Number(bounds?.defaultHeight) || DESKTOP_MAP_HEIGHT_MIN_PX;
    }
    return Math.round(clamp(resolvedHeight, minimumHeight, maximumHeight));
}
