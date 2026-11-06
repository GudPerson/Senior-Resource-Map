export const ANNOTATION_LABEL_REFERENCE_ZOOM = 16;
export const ANNOTATION_LABEL_SCALE_PROPERTY = '--carearound-annotation-label-scale';

// Presentation only: saved font sizes and geographic coordinates stay unchanged.
export function getAnnotationLabelZoomScale(zoom) {
    if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return 1;
    if (zoom <= ANNOTATION_LABEL_REFERENCE_ZOOM - 4) return 0.25;
    if (zoom >= ANNOTATION_LABEL_REFERENCE_ZOOM + 2) return 2;
    return 2 ** ((zoom - ANNOTATION_LABEL_REFERENCE_ZOOM) / 2);
}
