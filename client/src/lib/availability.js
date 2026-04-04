export function normalizeAvailabilityCount(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

export function normalizeAvailabilityUnit(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

export function formatAvailabilityLabel(count, unit) {
    const normalizedCount = normalizeAvailabilityCount(count);
    const normalizedUnit = normalizeAvailabilityUnit(unit);
    return normalizedUnit ? `${normalizedCount} ${normalizedUnit}` : `${normalizedCount} available`;
}
