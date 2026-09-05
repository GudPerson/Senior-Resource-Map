import { buildDirectoryPresentation } from './directoryPresentation.js';
import { buildMyMapCategoryRank, normalizeMyMapCategoryKey } from './myMapCategoryOrder.js';

export const DEFAULT_EMBEDDED_MAP_PRESENTATION = Object.freeze({
    version: 1,
    mapStyle: 'default',
    detailMode: 'auto',
    pinStyle: 'category-bubble',
    pinSize: 'standard',
    pinsVisible: true,
    annotationsVisible: true,
});

export function normalizeEmbeddedMapPresentation(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Number(value.version) !== 1) {
        return { ...DEFAULT_EMBEDDED_MAP_PRESENTATION };
    }
    return {
        version: 1,
        mapStyle: value.mapStyle === 'gray' ? 'gray' : 'default',
        detailMode: value.detailMode === 'live' ? 'live' : 'auto',
        pinStyle: ['numbered', 'category-icon'].includes(value.pinStyle)
            ? value.pinStyle
            : 'category-bubble',
        pinSize: ['large', 'extra-large'].includes(value.pinSize)
            ? value.pinSize
            : 'standard',
        pinsVisible: value.pinsVisible !== false,
        annotationsVisible: value.annotationsVisible !== false,
    };
}

export function buildEmbeddedMapRuntime(value) {
    const settings = normalizeEmbeddedMapPresentation(value);
    const markerScale = settings.pinSize === 'extra-large'
        ? 1.5
        : settings.pinSize === 'large'
            ? 1.25
            : 1;
    const isNumbered = settings.pinStyle === 'numbered';
    const isCategoryIcon = settings.pinStyle === 'category-icon';
    return {
        ...settings,
        markerMode: isNumbered
            ? 'print-badge'
            : isCategoryIcon
                ? 'category-icon'
                : 'category-bubble',
        markerScale,
        printBadgeScale: markerScale,
        pinBadgeMode: 'none',
        pinCategoryIconMode: isCategoryIcon ? 'auto' : 'none',
        clusterMarkerMode: 'none',
    };
}

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

function getRowAssetKey(row = {}) {
    const explicitKey = String(row.assetKey || '').trim();
    if (explicitKey) return explicitKey;

    const resourceType = String(row.resourceType || '').trim();
    const resourceId = Number(row.resourceId);
    return /^(?:hard|soft)$/.test(resourceType) && Number.isInteger(resourceId) && resourceId > 0
        ? `${resourceType}-${resourceId}`
        : '';
}

function addNormalizedKeys(target, values = []) {
    (Array.isArray(values) ? values : []).forEach((value) => {
        const key = String(value || '').trim();
        if (key) target.add(key);
    });
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

    const groupMemberAssetKeys = new Set();
    const groupMemberPlaceKeys = new Set();
    for (const place of directory.places || []) {
        for (const row of place.rows || []) {
            if (!selected.has(getRowCategoryKey(row))) continue;
            addNormalizedKeys(groupMemberAssetKeys, row.groupMemberAssetKeys);
            addNormalizedKeys(groupMemberPlaceKeys, row.mapFocusPlaceKeys);
        }
    }

    groupMemberPlaceKeys.forEach((key) => {
        if (/^(?:hard|soft)-[1-9]\d*$/.test(key)) groupMemberAssetKeys.add(key);
    });

    return {
        ...directory,
        places: (directory.places || [])
            .map((place) => {
                const rows = (place.rows || []).filter((row) => (
                    selected.has(getRowCategoryKey(row))
                    || groupMemberAssetKeys.has(getRowAssetKey(row))
                    || (
                        groupMemberPlaceKeys.has(String(place.placeKey || '').trim())
                        && row.resourceType === 'hard'
                        && getRowAssetKey(row) === String(place.placeKey || '').trim()
                    )
                ));
                return { ...place, rows };
            })
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

export function findEmbedPreviewGroups(presentation, placeKey) {
    const normalizedKey = String(placeKey || '').trim();
    if (!normalizedKey) return [];

    const mappedGroups = presentation?.mappedGroups || [];
    const exactGroup = mappedGroups.find((group) => (
        String(group?.placeKey || '') === normalizedKey
        || (group?.memberPlaceKeys || []).some((key) => String(key) === normalizedKey)
    ));
    if (exactGroup) return [exactGroup];

    const selectedPin = (presentation?.pins || []).find((pin) => (
        String(pin?.placeKey || '') === normalizedKey
    ));
    if (!selectedPin?.isPostalGroup) return [];

    const memberPlaceKeys = new Set(
        (selectedPin.memberPlaceKeys || []).map((key) => String(key)),
    );
    return mappedGroups.filter((group) => (
        memberPlaceKeys.has(String(group?.placeKey || ''))
        || (group?.memberPlaceKeys || []).some((key) => memberPlaceKeys.has(String(key)))
    ));
}

export function findEmbedPreviewGroup(presentation, placeKey) {
    return findEmbedPreviewGroups(presentation, placeKey)[0] || null;
}

export function buildEmbedResourcePreviewDetails(group, row) {
    const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const name = compactText(row?.name) || compactText(group?.name) || 'Resource';
    const address = compactText(row?.address)
        || compactText(group?.shortLocationLine)
        || compactText(group?.address);
    const scheduleText = String(row?.descriptor || '').trim();
    const parsedOpenProgrammeServiceCount = Number.parseInt(row?.openProgrammeServiceCount, 10);

    return {
        name,
        address,
        scheduleText,
        scheduleLabelKey: row?.resourceType === 'hard' ? 'operatingHours' : 'schedule',
        openProgrammeServiceCount: Number.isInteger(parsedOpenProgrammeServiceCount)
            && parsedOpenProgrammeServiceCount > 0
            ? parsedOpenProgrammeServiceCount
            : 0,
    };
}
