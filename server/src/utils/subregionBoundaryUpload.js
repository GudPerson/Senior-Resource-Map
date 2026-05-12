export function normalizeSubregionBoundaryUploadMode(mode) {
    return mode === 'replace' ? 'replace' : 'append';
}
