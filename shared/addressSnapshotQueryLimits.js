const REASONS = new Set(['tiles', 'reservedBytes', 'candidateRows', 'geometryWork', 'storageReads']);

// Only safe admission counts cross the authenticated API boundary. Never carry
// geometry, object keys, provider messages or arbitrary error properties.
export function normalizeAddressSnapshotLimit(value) {
    if (!value || !REASONS.has(value.reason)
        || !Number.isSafeInteger(value.observed) || !Number.isSafeInteger(value.allowed)
        || value.allowed < 0 || value.observed <= value.allowed) return undefined;
    return { reason: value.reason, observed: value.observed, allowed: value.allowed };
}
