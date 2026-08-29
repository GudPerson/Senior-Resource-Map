import { normalizeMyMapCategoryKey } from './myMapCategoryOrder.js';

export const CATEGORY_PIN_DEFAULT_FILL_COLOR = '#0F766E';
export const CATEGORY_PIN_DEFAULT_RING_COLOR = '#FFFFFF';
export const CATEGORY_PIN_DARK_LABEL_COLOR = '#0F172A';
export const CATEGORY_PIN_LIGHT_LABEL_COLOR = '#FFFFFF';

export function normalizeCategoryPinColor(value, fallback = null) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
}

export function normalizeCategoryPinStyles(value, { limit = 500 } = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    const normalized = {};
    for (const [rawKey, rawStyle] of Object.entries(value)) {
        const key = normalizeMyMapCategoryKey(rawKey).slice(0, 240);
        const fillColor = normalizeCategoryPinColor(rawStyle?.fillColor);
        const ringColor = normalizeCategoryPinColor(rawStyle?.ringColor);
        if (!key || !fillColor || !ringColor) continue;
        normalized[key] = { fillColor, ringColor };
        if (Object.keys(normalized).length >= limit) break;
    }
    return normalized;
}

function getRelativeLuminance(hexColor) {
    const color = normalizeCategoryPinColor(hexColor, CATEGORY_PIN_DEFAULT_FILL_COLOR);
    const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255);
    const [red, green, blue] = channels.map((channel) => (
        channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4
    ));
    return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

export function getCategoryPinLabelColor(fillColor) {
    const luminance = getRelativeLuminance(fillColor);
    const lightContrast = 1.05 / (luminance + 0.05);
    const darkLuminance = getRelativeLuminance(CATEGORY_PIN_DARK_LABEL_COLOR);
    const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);
    return darkContrast >= lightContrast
        ? CATEGORY_PIN_DARK_LABEL_COLOR
        : CATEGORY_PIN_LIGHT_LABEL_COLOR;
}

export function getCategoryPinStyle(categoryStyles, categoryKey, categoryColor = null) {
    const key = normalizeMyMapCategoryKey(categoryKey);
    const style = key ? categoryStyles?.[key] : null;
    return {
        fillColor: normalizeCategoryPinColor(
            style?.fillColor,
            normalizeCategoryPinColor(categoryColor, CATEGORY_PIN_DEFAULT_FILL_COLOR),
        ),
        ringColor: normalizeCategoryPinColor(style?.ringColor, CATEGORY_PIN_DEFAULT_RING_COLOR),
    };
}
