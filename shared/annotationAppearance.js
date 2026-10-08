export const ANNOTATION_RESOURCE_DEFAULT_GLOW_COLOR = '#f97316';
export const ANNOTATION_RESOURCE_GLOW_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function isAnnotationResourceGlowColor(value) {
    return typeof value === 'string' && ANNOTATION_RESOURCE_GLOW_COLOR_PATTERN.test(value);
}

export function normalizeAnnotationResourceGlowColor(value) {
    return isAnnotationResourceGlowColor(value) ? value.toLowerCase() : ANNOTATION_RESOURCE_DEFAULT_GLOW_COLOR;
}

export function getAnnotationResourceGlowColor(annotation) {
    return normalizeAnnotationResourceGlowColor(annotation?.resourceGlowColor);
}
