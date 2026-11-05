// Owner organization metadata. Empty values remain absent on legacy drawings.
export const ANNOTATION_GROUP_MAX_LENGTH = 80;

export function normalizeAnnotationGroupName(value) {
    return typeof value === 'string'
        ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().replace(/\s+/g, ' ').slice(0, ANNOTATION_GROUP_MAX_LENGTH)
        : '';
}
