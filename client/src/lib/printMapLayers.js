import {
    PRINT_MAP_ANNOTATION_LAYER_HIDE,
    normalizePrintMapHiddenLayerKeys,
} from './printMapState.js';

export const PRINT_MAP_RESOURCE_GROUP_CAREAROUND = 'resource:carearound';
export const PRINT_MAP_RESOURCE_GROUP_PERSONAL = 'resource:personal';

const RESOURCE_GROUP_LABELS = {
    [PRINT_MAP_RESOURCE_GROUP_CAREAROUND]: 'CareAround resources',
    [PRINT_MAP_RESOURCE_GROUP_PERSONAL]: 'Personal places',
};

function normalizeLayerLabel(value, fallback) {
    const label = String(value || '').trim().replace(/\s+/g, ' ');
    return label || fallback;
}

function normalizeLayerToken(value) {
    return normalizeLayerLabel(value, 'other')
        .normalize('NFKC')
        .toLocaleLowerCase('en-SG')
        .slice(0, 160);
}

function getPrintResourceGroupKey(group = {}) {
    const rows = Array.isArray(group.rows) ? group.rows : [];
    return rows.some((row) => row?.resourceType === 'personal_place')
        ? PRINT_MAP_RESOURCE_GROUP_PERSONAL
        : PRINT_MAP_RESOURCE_GROUP_CAREAROUND;
}

export function getPrintResourceCategoryLayerKey(groupKey, categoryLabel) {
    const resolvedGroupKey = groupKey === PRINT_MAP_RESOURCE_GROUP_PERSONAL
        ? PRINT_MAP_RESOURCE_GROUP_PERSONAL
        : PRINT_MAP_RESOURCE_GROUP_CAREAROUND;
    return `${resolvedGroupKey}:category:${normalizeLayerToken(categoryLabel)}`;
}

export function buildPrintMapResourceLayers(presentation = {}) {
    const groupsByKey = new Map();
    const layerKeyByPlaceKey = {};
    const displayGroups = Array.isArray(presentation.displayGroups)
        ? presentation.displayGroups
        : (presentation.mappedGroups || []);

    displayGroups.forEach((group) => {
        if (!group?.hasCoordinates || !group.placeKey) return;
        const groupKey = getPrintResourceGroupKey(group);
        const categoryLabel = normalizeLayerLabel(
            group.categoryLabel,
            groupKey === PRINT_MAP_RESOURCE_GROUP_PERSONAL ? 'Personal place' : 'Other',
        );
        const categoryKey = getPrintResourceCategoryLayerKey(groupKey, categoryLabel);
        const currentGroup = groupsByKey.get(groupKey) || {
            key: groupKey,
            label: RESOURCE_GROUP_LABELS[groupKey],
            count: 0,
            categoriesByKey: new Map(),
            placeKeys: [],
        };
        const currentCategory = currentGroup.categoriesByKey.get(categoryKey) || {
            key: categoryKey,
            groupKey,
            label: categoryLabel,
            count: 0,
            placeKeys: [],
        };
        const placeKey = String(group.placeKey);

        currentCategory.count += 1;
        currentCategory.placeKeys.push(placeKey);
        currentGroup.count += 1;
        currentGroup.placeKeys.push(placeKey);
        currentGroup.categoriesByKey.set(categoryKey, currentCategory);
        groupsByKey.set(groupKey, currentGroup);
        layerKeyByPlaceKey[placeKey] = categoryKey;
    });

    const groups = [
        PRINT_MAP_RESOURCE_GROUP_CAREAROUND,
        PRINT_MAP_RESOURCE_GROUP_PERSONAL,
    ].map((groupKey) => groupsByKey.get(groupKey))
        .filter(Boolean)
        .map(({ categoriesByKey, ...group }) => ({
            ...group,
            categories: [...categoriesByKey.values()]
                .sort((left, right) => left.label.localeCompare(right.label)),
        }));

    return {
        groups,
        layerKeyByPlaceKey,
    };
}

export function getVisiblePrintResourcePlaceKeys(model = {}, hiddenLayerKeys = []) {
    const hiddenKeys = new Set(normalizePrintMapHiddenLayerKeys(hiddenLayerKeys));
    const visiblePlaceKeys = new Set();

    (model.groups || []).forEach((group) => {
        if (hiddenKeys.has(group.key)) return;
        (group.categories || []).forEach((category) => {
            if (hiddenKeys.has(category.key)) return;
            category.placeKeys.forEach((placeKey) => visiblePlaceKeys.add(String(placeKey)));
        });
    });

    return visiblePlaceKeys;
}

export function filterPrintMapResourcePins(pins = [], visiblePlaceKeys = new Set()) {
    const visibleKeys = visiblePlaceKeys instanceof Set
        ? visiblePlaceKeys
        : new Set(visiblePlaceKeys || []);

    return (pins || []).flatMap((pin) => {
        const badgeItems = Array.isArray(pin.printBadgeItems)
            ? pin.printBadgeItems.filter((item) => visibleKeys.has(String(item.placeKey)))
            : [];
        const visibleMemberPlaceKeys = (pin.memberPlaceKeys || [])
            .map((placeKey) => String(placeKey))
            .filter((placeKey) => visibleKeys.has(placeKey));
        const directPinVisible = visibleKeys.has(String(pin.placeKey));

        if (!badgeItems.length && !visibleMemberPlaceKeys.length && !directPinVisible) {
            return [];
        }
        if (!Array.isArray(pin.printBadgeItems)) {
            return [{
                ...pin,
                memberPlaceKeys: visibleMemberPlaceKeys.length
                    ? visibleMemberPlaceKeys
                    : pin.memberPlaceKeys,
            }];
        }

        const firstVisibleItem = badgeItems[0];
        return [{
            ...pin,
            number: firstVisibleItem.number,
            printNumberLabel: firstVisibleItem.label,
            categoryColor: firstVisibleItem.color || pin.categoryColor,
            curatedCount: badgeItems.length,
            memberPlaceKeys: badgeItems.map((item) => String(item.placeKey)),
            printBadgeItems: badgeItems,
        }];
    });
}

export function filterPrintMapAnnotations(annotations = [], {
    annotationLayer,
    hiddenAnnotationIds = [],
} = {}) {
    if (annotationLayer === PRINT_MAP_ANNOTATION_LAYER_HIDE) return [];
    const hiddenIds = new Set(normalizePrintMapHiddenLayerKeys(hiddenAnnotationIds));
    return (annotations || []).filter((annotation) => !hiddenIds.has(String(annotation?.id || '')));
}
