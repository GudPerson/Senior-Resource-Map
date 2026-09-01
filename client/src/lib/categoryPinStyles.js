import { normalizeMyMapCategoryKey } from './myMapCategoryOrder.js';

export const CATEGORY_PIN_DEFAULT_FILL_COLOR = '#0F766E';
export const CATEGORY_PIN_DEFAULT_RING_COLOR = '#FFFFFF';
export const CATEGORY_PIN_DARK_LABEL_COLOR = '#0F172A';
export const CATEGORY_PIN_LIGHT_LABEL_COLOR = '#FFFFFF';
export const CATEGORY_PIN_RING_WEIGHT_THIN = 'thin';
export const CATEGORY_PIN_RING_WEIGHT_MEDIUM = 'medium';
export const CATEGORY_PIN_RING_WEIGHT_THICK = 'thick';
export const CATEGORY_PIN_RING_WEIGHT_OPTIONS = [
    CATEGORY_PIN_RING_WEIGHT_THIN,
    CATEGORY_PIN_RING_WEIGHT_MEDIUM,
    CATEGORY_PIN_RING_WEIGHT_THICK,
];

const CATEGORY_PIN_RING_STROKE_WIDTHS = {
    [CATEGORY_PIN_RING_WEIGHT_THIN]: 1,
    [CATEGORY_PIN_RING_WEIGHT_MEDIUM]: 2,
    [CATEGORY_PIN_RING_WEIGHT_THICK]: 3,
};
const CATEGORY_PIN_LIGHT_LABEL_LUMINANCE_THRESHOLD = 0.4;

export function normalizeCategoryPinColor(value, fallback = null) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
}

export function normalizeCategoryPinRingWeight(value, fallback = CATEGORY_PIN_RING_WEIGHT_THIN) {
    return CATEGORY_PIN_RING_WEIGHT_OPTIONS.includes(value) ? value : fallback;
}

export function getCategoryPinRingStrokeWidth(value) {
    return CATEGORY_PIN_RING_STROKE_WIDTHS[normalizeCategoryPinRingWeight(value)];
}

export function normalizeCategoryPinStyles(value, { limit = 500 } = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    const normalized = {};
    for (const [rawKey, rawStyle] of Object.entries(value)) {
        const key = normalizeMyMapCategoryKey(rawKey).slice(0, 240);
        const fillColor = normalizeCategoryPinColor(rawStyle?.fillColor);
        const ringColor = normalizeCategoryPinColor(rawStyle?.ringColor);
        const labelColor = normalizeCategoryPinColor(rawStyle?.labelColor);
        if (!key || !fillColor || !ringColor) continue;
        normalized[key] = {
            fillColor,
            ringColor,
            ringWeight: normalizeCategoryPinRingWeight(rawStyle?.ringWeight),
            ...(labelColor ? { labelColor } : {}),
        };
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
    return luminance <= CATEGORY_PIN_LIGHT_LABEL_LUMINANCE_THRESHOLD
        ? CATEGORY_PIN_LIGHT_LABEL_COLOR
        : CATEGORY_PIN_DARK_LABEL_COLOR;
}

export function getCategoryPinStyle(categoryStyles, categoryKey, categoryColor = null) {
    const key = normalizeMyMapCategoryKey(categoryKey);
    const style = key ? categoryStyles?.[key] : null;
    const fillColor = normalizeCategoryPinColor(
        style?.fillColor,
        normalizeCategoryPinColor(categoryColor, CATEGORY_PIN_DEFAULT_FILL_COLOR),
    );
    return {
        fillColor,
        ringColor: normalizeCategoryPinColor(style?.ringColor, CATEGORY_PIN_DEFAULT_RING_COLOR),
        ringWeight: normalizeCategoryPinRingWeight(style?.ringWeight),
        labelColor: normalizeCategoryPinColor(
            style?.labelColor,
            getCategoryPinLabelColor(fillColor),
        ),
    };
}

export function getCategoryPinLabelColorOverride(categoryStyles, categoryKey) {
    const key = normalizeMyMapCategoryKey(categoryKey);
    return key ? normalizeCategoryPinColor(categoryStyles?.[key]?.labelColor) : null;
}
