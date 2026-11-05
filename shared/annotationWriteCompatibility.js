import { normalizeAnnotationGroupName } from './annotationGroups.js';
import { PRINT_ANNOTATION_DOCUMENT_MAX_COUNT } from './printAnnotationLimits.js';

export const PRINT_ANNOTATION_CLIENT_CAPABILITIES = Object.freeze({
    maxCount: PRINT_ANNOTATION_DOCUMENT_MAX_COUNT,
    groups: true,
});

export function supportsCurrentAnnotationWrites(capabilities) {
    return Number.isSafeInteger(capabilities?.maxCount)
        && capabilities.maxCount >= PRINT_ANNOTATION_DOCUMENT_MAX_COUNT
        && capabilities.groups === true;
}

export function requiresCurrentAnnotationWrites(annotations) {
    return Array.isArray(annotations) && (annotations.length > 100
        || annotations.some(annotation => normalizeAnnotationGroupName(annotation?.groupName)));
}

// Downlevel Workers can strip unknown fields while acknowledging a save. Only
// the newly introduced features need this additional acknowledgement boundary.
export function acknowledgesAnnotationFeatures(expected, actual) {
    if (!requiresCurrentAnnotationWrites(expected)) return true;
    return Array.isArray(actual) && actual.length === expected.length
        && expected.every((annotation, index) => annotation.id === actual[index]?.id
            && normalizeAnnotationGroupName(annotation.groupName)
                === normalizeAnnotationGroupName(actual[index]?.groupName));
}
