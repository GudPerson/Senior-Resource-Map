import {
    PRINT_MAP_RESOURCE_GROUP_CAREAROUND,
    PRINT_MAP_RESOURCE_GROUP_PERSONAL,
    getPrintResourceCategoryLayerKey,
} from './printMapLayers.js';
import { normalizePrintMapHiddenLayerKeys } from './printMapState.js';

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeLabel(value, fallback = '') {
    const label = String(value || '').trim().replace(/\s+/g, ' ');
    return label || fallback;
}

export function getMapStudioResourceRowKey(row = {}) {
    const explicitKey = String(row.rowKey || row.assetKey || '').trim();
    if (explicitKey) return explicitKey;

    const resourceType = String(row.resourceType || '').trim();
    const resourceId = Number(row.resourceId ?? row.personalPlaceId);
    return resourceType && Number.isSafeInteger(resourceId) && resourceId > 0
        ? `${resourceType}-${resourceId}`
        : '';
}

function getGroupRows(group = {}) {
    if (group.isPostalGroup && Array.isArray(group.nestedPlaces)) {
        return group.nestedPlaces.flatMap((place) => place?.rows || []);
    }
    return Array.isArray(group.rows) ? group.rows : [];
}

function getGroupKind(group = {}) {
    const rows = getGroupRows(group);
    return rows.some((row) => row?.resourceType === 'personal_place')
        ? PRINT_MAP_RESOURCE_GROUP_PERSONAL
        : PRINT_MAP_RESOURCE_GROUP_CAREAROUND;
}

function getGroupCategoryLabel(group = {}, groupKey) {
    return normalizeLabel(
        group.categoryLabel,
        groupKey === PRINT_MAP_RESOURCE_GROUP_PERSONAL ? 'Personal place' : 'Other',
    );
}

/**
 * Build the stable layer catalogue from the unfiltered V2 presentation. Each
 * visible card is assigned to one group/category layer and carries the source
 * row keys needed to rebuild both V2 and classic presentations from the same
 * filtered directory.
 */
export function buildMapStudioResourceLayerCatalog(presentation = {}) {
    const displayGroups = Array.isArray(presentation.displayGroups)
        ? presentation.displayGroups
        : (presentation.mappedGroups || []);
    const groupsByKey = new Map();
    const layerKeyByRowKey = {};

    displayGroups.forEach((displayGroup) => {
        if (!displayGroup) return;
        const groupKey = getGroupKind(displayGroup);
        const categoryLabel = getGroupCategoryLabel(displayGroup, groupKey);
        const categoryKey = getPrintResourceCategoryLayerKey(groupKey, categoryLabel);
        const rowKeys = [...new Set(
            getGroupRows(displayGroup)
                .map(getMapStudioResourceRowKey)
                .filter(Boolean),
        )];
        if (!rowKeys.length) return;

        const currentGroup = groupsByKey.get(groupKey) || {
            key: groupKey,
            label: groupKey === PRINT_MAP_RESOURCE_GROUP_PERSONAL
                ? 'Personal places'
                : 'CareAround resources',
            count: 0,
            rowKeys: [],
            categoriesByKey: new Map(),
        };
        const currentCategory = currentGroup.categoriesByKey.get(categoryKey) || {
            key: categoryKey,
            groupKey,
            label: categoryLabel,
            count: 0,
            rowKeys: [],
        };

        currentGroup.count += 1;
        currentCategory.count += 1;
        currentGroup.rowKeys.push(...rowKeys);
        currentCategory.rowKeys.push(...rowKeys);
        currentGroup.categoriesByKey.set(categoryKey, currentCategory);
        groupsByKey.set(groupKey, currentGroup);
        rowKeys.forEach((rowKey) => {
            layerKeyByRowKey[rowKey] = categoryKey;
        });
    });

    const groups = [
        PRINT_MAP_RESOURCE_GROUP_CAREAROUND,
        PRINT_MAP_RESOURCE_GROUP_PERSONAL,
    ].map((groupKey) => groupsByKey.get(groupKey))
        .filter(Boolean)
        .map(({ categoriesByKey, ...group }) => ({
            ...group,
            rowKeys: [...new Set(group.rowKeys)],
            categories: [...categoriesByKey.values()]
                .map((category) => ({
                    ...category,
                    rowKeys: [...new Set(category.rowKeys)],
                }))
                .sort((left, right) => left.label.localeCompare(right.label)),
        }));

    return { groups, layerKeyByRowKey };
}

export function getVisibleMapStudioResourceRowKeys(catalog = {}, hiddenLayerKeys = []) {
    const hiddenKeys = new Set(normalizePrintMapHiddenLayerKeys(hiddenLayerKeys));
    const visibleRowKeys = new Set();

    (catalog.groups || []).forEach((group) => {
        if (hiddenKeys.has(group.key)) return;
        (group.categories || []).forEach((category) => {
            if (hiddenKeys.has(category.key)) return;
            (category.rowKeys || []).forEach((rowKey) => visibleRowKeys.add(String(rowKey)));
        });
    });

    return visibleRowKeys;
}

export function filterMapStudioDirectoryByLayers(
    directory,
    catalog,
    hiddenLayerKeys = [],
) {
    const normalizedHiddenKeys = normalizePrintMapHiddenLayerKeys(hiddenLayerKeys);
    if (!directory || !normalizedHiddenKeys.length) return directory;

    const visibleRowKeys = getVisibleMapStudioResourceRowKeys(catalog, normalizedHiddenKeys);
    let resourceCount = 0;
    const places = (directory.places || []).flatMap((place) => {
        const rows = (place.rows || []).filter((row) => (
            visibleRowKeys.has(getMapStudioResourceRowKey(row))
        ));
        if (!rows.length) return [];
        resourceCount += rows.length;
        return [{ ...place, rows }];
    });

    return {
        ...directory,
        places,
        summary: {
            ...(directory.summary || {}),
            resourceCount,
        },
    };
}

export function cloneMapStudioResourceLayerCatalog(catalog = {}) {
    return clone(catalog);
}
