import { normalizeMyMapCategoryKey } from './myMapCategoryOrder.js';

export const CATEGORY_PIN_SHAPE_CIRCLE = 'circle';
export const CATEGORY_PIN_SHAPE_TRIANGLE = 'triangle';
export const CATEGORY_PIN_SHAPE_STAR = 'star';
export const CATEGORY_PIN_SHAPE_SQUARE = 'square';
export const CATEGORY_PIN_SHAPE_PENTAGON = 'pentagon';

export const CATEGORY_PIN_SHAPE_OPTIONS = Object.freeze([
    CATEGORY_PIN_SHAPE_CIRCLE,
    CATEGORY_PIN_SHAPE_TRIANGLE,
    CATEGORY_PIN_SHAPE_STAR,
    CATEGORY_PIN_SHAPE_SQUARE,
    CATEGORY_PIN_SHAPE_PENTAGON,
]);

export const CATEGORY_PIN_SHAPE_PATHS = Object.freeze({
    [CATEGORY_PIN_SHAPE_CIRCLE]: 'M50 4a46 46 0 1 0 0 92a46 46 0 1 0 0-92',
    [CATEGORY_PIN_SHAPE_TRIANGLE]: 'M50 4 96 92H4Z',
    [CATEGORY_PIN_SHAPE_STAR]: 'm50 3 14.1 28.6 31.6 4.6-22.9 22.3 5.4 31.5L50 74.6 21.8 89.5l5.4-31.5L4.3 36.2l31.6-4.6Z',
    [CATEGORY_PIN_SHAPE_SQUARE]: 'M8 8h84v84H8Z',
    [CATEGORY_PIN_SHAPE_PENTAGON]: 'M50 4 95 37 78 92H22L5 37Z',
});

export const CATEGORY_PIN_SHAPE_TEXT_Y = Object.freeze({
    [CATEGORY_PIN_SHAPE_CIRCLE]: 58,
    [CATEGORY_PIN_SHAPE_TRIANGLE]: 65,
    [CATEGORY_PIN_SHAPE_STAR]: 59,
    [CATEGORY_PIN_SHAPE_SQUARE]: 58,
    [CATEGORY_PIN_SHAPE_PENTAGON]: 61,
});

export function normalizeCategoryPinShape(value) {
    return CATEGORY_PIN_SHAPE_OPTIONS.includes(value)
        ? value
        : CATEGORY_PIN_SHAPE_CIRCLE;
}

export function normalizeCategoryPinShapes(value, { limit = 500 } = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    const normalized = {};
    for (const [rawKey, rawShape] of Object.entries(value)) {
        const key = normalizeMyMapCategoryKey(rawKey).slice(0, 240);
        const shape = normalizeCategoryPinShape(rawShape);
        if (!key || shape === CATEGORY_PIN_SHAPE_CIRCLE) continue;
        normalized[key] = shape;
        if (Object.keys(normalized).length >= limit) break;
    }
    return normalized;
}

export function getCategoryPinShape(categoryShapes, categoryKey) {
    const key = normalizeMyMapCategoryKey(categoryKey);
    return normalizeCategoryPinShape(key ? categoryShapes?.[key] : null);
}

export function getCategoryPinShapePath(shape) {
    return CATEGORY_PIN_SHAPE_PATHS[normalizeCategoryPinShape(shape)];
}

export function getCategoryPinShapeTextY(shape) {
    return CATEGORY_PIN_SHAPE_TEXT_Y[normalizeCategoryPinShape(shape)];
}
