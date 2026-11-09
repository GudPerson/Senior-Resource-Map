import { normalizeAnnotationGroupName } from './annotationGroups.js';
import { PRINT_ANNOTATION_DOCUMENT_MAX_COUNT } from './printAnnotationLimits.js';

export const PRINT_ANNOTATION_CLIENT_CAPABILITIES = Object.freeze({
    maxCount: PRINT_ANNOTATION_DOCUMENT_MAX_COUNT,
    groups: true,
    exactBoundaryGeometry: true,
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

function hasProtectedBoundary(annotation) {
    return Boolean(annotation?.name || annotation?.boundaryGeometryVersion === 1
        || (annotation?.type === 'polygon' && !annotation.boundarySource && annotation.controlPoints
            && !samePoints(annotation.points, annotation.controlPoints)));
}

function samePoints(a, b) {
    return a === b || (Array.isArray(a) && Array.isArray(b) && a.length === b.length
        && a.every((point, index) => point[0] === b[index]?.[0] && point[1] === b[index]?.[1]));
}

export function requiresExactBoundaryWrites(annotations) {
    return Array.isArray(annotations) && annotations.some(hasProtectedBoundary);
}

export function canWriteAnnotationFeatures(capabilities, annotations) {
    return (!requiresCurrentAnnotationWrites(annotations) || supportsCurrentAnnotationWrites(capabilities))
        && (!requiresExactBoundaryWrites(annotations) || capabilities?.exactBoundaryGeometry === true);
}

// Downlevel Workers can strip unknown fields while acknowledging a save. Only
// the newly introduced features need this additional acknowledgement boundary.
export function acknowledgesAnnotationFeatures(expected, actual, previouslyProtected = false) {
    if (!previouslyProtected && !requiresCurrentAnnotationWrites(expected) && !requiresExactBoundaryWrites(expected)) return true;
    return Array.isArray(actual) && actual.length === expected.length
        && expected.every((annotation, index) => annotation.id === actual[index]?.id
            && normalizeAnnotationGroupName(annotation.groupName)
                === normalizeAnnotationGroupName(actual[index]?.groupName)
            && (!(previouslyProtected || hasProtectedBoundary(annotation)) || (annotation.name === actual[index]?.name
                && annotation.type === actual[index]?.type && annotation.boundaryGeometryVersion === actual[index]?.boundaryGeometryVersion
                && samePoints(annotation.points, actual[index]?.points)
                && samePoints(annotation.controlPoints, actual[index]?.controlPoints))));
}
