export const MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT = 'left';
export const MAP_STUDIO_LAYOUT_PANEL_SIDE_RIGHT = 'right';
export const MAP_STUDIO_LAYOUT_PANEL_SIDE_STORAGE_KEY = 'carearound.mapStudio.layoutPanelSide.v1';

export function normalizeMapStudioLayoutPanelSide(value) {
    return value === MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT
        ? MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT
        : MAP_STUDIO_LAYOUT_PANEL_SIDE_RIGHT;
}

function getBrowserLocalStorage() {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export function readMapStudioLayoutPanelSide(storage = getBrowserLocalStorage()) {
    try {
        return normalizeMapStudioLayoutPanelSide(
            storage?.getItem(MAP_STUDIO_LAYOUT_PANEL_SIDE_STORAGE_KEY),
        );
    } catch {
        return MAP_STUDIO_LAYOUT_PANEL_SIDE_RIGHT;
    }
}

export function writeMapStudioLayoutPanelSide(value, storage = getBrowserLocalStorage()) {
    const normalized = normalizeMapStudioLayoutPanelSide(value);
    try {
        storage?.setItem(MAP_STUDIO_LAYOUT_PANEL_SIDE_STORAGE_KEY, normalized);
    } catch {
        // Docking remains usable for this session when browser storage is unavailable.
    }
    return normalized;
}
