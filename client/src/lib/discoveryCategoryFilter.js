export const DISCOVERY_OTHER_CATEGORY_KEY = '__other__';

export function normalizeDiscoveryCategoryKey(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized || DISCOVERY_OTHER_CATEGORY_KEY;
}

function normalizeSelectedCategoryKeys(selectedCategoryKeys = []) {
    return new Set(
        Array.from(selectedCategoryKeys || [])
            .map((key) => normalizeDiscoveryCategoryKey(key))
            .filter(Boolean),
    );
}

export function matchesDiscoveryCategorySelection(subCategory, selectedCategoryKeys = []) {
    const selectedKeys = normalizeSelectedCategoryKeys(selectedCategoryKeys);
    return selectedKeys.size === 0 || selectedKeys.has(normalizeDiscoveryCategoryKey(subCategory));
}

export function filterDiscoveryResourcesByCategoryKeys(resources = [], selectedCategoryKeys = []) {
    const selectedKeys = normalizeSelectedCategoryKeys(selectedCategoryKeys);
    if (selectedKeys.size === 0) return resources;

    return resources.filter((resource) => (
        selectedKeys.has(normalizeDiscoveryCategoryKey(resource?.subCategory))
    ));
}

export function buildDiscoveryCategoryOptions(
    allResources = [],
    scopedResources = allResources,
    { otherLabel = 'Other' } = {},
) {
    const optionsByKey = new Map();

    for (const resource of allResources) {
        const rawLabel = String(resource?.subCategory ?? '').trim();
        const key = normalizeDiscoveryCategoryKey(rawLabel);
        const label = key === DISCOVERY_OTHER_CATEGORY_KEY ? otherLabel : rawLabel;
        const existing = optionsByKey.get(key);

        if (!existing || label.localeCompare(existing.label) < 0) {
            optionsByKey.set(key, { key, label, count: existing?.count || 0 });
        }
    }

    for (const resource of scopedResources) {
        const key = normalizeDiscoveryCategoryKey(resource?.subCategory);
        const option = optionsByKey.get(key);
        if (option) option.count += 1;
    }

    return Array.from(optionsByKey.values()).sort((left, right) => (
        left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
    ));
}
