function readShareUpdatedAt(map) {
    return map?.share?.shareUpdatedAt || map?.shareUpdatedAt || null;
}

function readMapUpdatedAt(map) {
    return map?.updatedAt || null;
}

function parseTimestamp(value) {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
}

export function hasSharedMapUpdates(map) {
    const isShared = Boolean(map?.share?.isShared ?? map?.isShared);
    if (!isShared) return false;

    const sharedAt = parseTimestamp(readShareUpdatedAt(map));
    const updatedAt = parseTimestamp(readMapUpdatedAt(map));
    if (sharedAt === null || updatedAt === null) return false;

    return updatedAt > sharedAt;
}
