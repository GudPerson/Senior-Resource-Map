import { buildDirectoryPresentation } from './directoryPresentation.js';
import { buildMyMapCategoryRank, normalizeMyMapCategoryKey } from './myMapCategoryOrder.js';

function getRowCategoryLabel(row = {}) {
    return row.mapSubCategory
        || row.mapCategoryLabel
        || row.subCategory
        || row.bucket
        || (row.resourceType === 'soft' ? 'Programme/service' : 'Place');
}

function getRowCategoryKey(row = {}) {
    return normalizeMyMapCategoryKey(getRowCategoryLabel(row));
}

export function buildEmbedCategoryOptions(directory) {
    const categoryRank = buildMyMapCategoryRank(directory?.categoryOrder || []);
    const byKey = new Map();

    for (const place of directory?.places || []) {
        for (const row of place?.rows || []) {
            const key = getRowCategoryKey(row);
            if (!key || byKey.has(key)) continue;
            byKey.set(key, {
                key,
                label: getRowCategoryLabel(row),
                color: row.mapCategoryColor || row.categoryColor || '#0f766e',
                iconUrl: row.mapCategoryIconUrl || row.categoryIconUrl || null,
            });
        }
    }

    return [...byKey.values()].sort((left, right) => {
        const leftRank = categoryRank.get(left.key) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = categoryRank.get(right.key) ?? Number.MAX_SAFE_INTEGER;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
    });
}

export function filterEmbedDirectoryByCategories(directory, selectedCategoryKeys = []) {
    const selected = new Set(
        (selectedCategoryKeys || []).map(normalizeMyMapCategoryKey).filter(Boolean),
    );
    if (!directory || selected.size === 0) return directory;

    return {
        ...directory,
        places: (directory.places || [])
            .map((place) => ({
                ...place,
                rows: (place.rows || []).filter((row) => selected.has(getRowCategoryKey(row))),
            }))
            .filter((place) => place.rows.length > 0),
    };
}

export function buildEmbeddedMapPresentation(directory, options = {}) {
    const filteredDirectory = filterEmbedDirectoryByCategories(
        directory,
        options.selectedCategoryKeys,
    );
    return buildDirectoryPresentation(filteredDirectory, {
        query: options.query || '',
        presentationMode: 'v2-cards',
    });
}

export function getEmbedListOnlyResourceCount(directory) {
    let count = 0;
    for (const place of directory?.places || []) {
        const hasCoordinates = Boolean(
            place?.hasCoordinates
            && Number.isFinite(Number.parseFloat(place?.lat))
            && Number.isFinite(Number.parseFloat(place?.lng)),
        );
        if (!hasCoordinates) count += (place?.rows || []).length;
    }
    return count;
}

export function findEmbedPreviewGroup(presentation, placeKey) {
    const normalizedKey = String(placeKey || '').trim();
    if (!normalizedKey) return null;
    const resolvedKey = presentation?.groupKeyByPlaceKey?.[normalizedKey] || normalizedKey;
    return (presentation?.mappedGroups || []).find((group) => (
        String(group?.placeKey || '') === String(resolvedKey)
        || (group?.memberPlaceKeys || []).some((key) => String(key) === normalizedKey)
    )) || null;
}
