import {
    DISCOVERY_OTHER_CATEGORY_KEY,
    normalizeDiscoveryCategoryKey,
} from '../../lib/discoveryCategoryFilter.js';

function getSavedPinCategoryEntries(pin, { otherLabel = 'Other' } = {}) {
    const entriesByKey = new Map();
    const savedAssets = Array.isArray(pin?.savedAssets) ? pin.savedAssets : [];

    savedAssets.forEach((savedAsset) => {
        const rawLabel = String(savedAsset?.subCategory ?? '').trim();
        const key = normalizeDiscoveryCategoryKey(rawLabel);
        const label = key === DISCOVERY_OTHER_CATEGORY_KEY ? otherLabel : rawLabel;
        const existing = entriesByKey.get(key);

        if (!existing || label.localeCompare(existing.label) < 0) {
            entriesByKey.set(key, { key, label });
        }
    });

    return Array.from(entriesByKey.values());
}

export function getSavedPinCategoryKeys(pin) {
    return getSavedPinCategoryEntries(pin).map((entry) => entry.key).sort();
}

export function buildSavedPinCategoryOptions(savedPlacePins = [], { otherLabel = 'Other' } = {}) {
    const optionsByKey = new Map();

    savedPlacePins.forEach((pin) => {
        getSavedPinCategoryEntries(pin, { otherLabel }).forEach(({ key, label }) => {
            const existing = optionsByKey.get(key);
            if (existing) {
                existing.count += 1;
                if (label.localeCompare(existing.label) < 0) existing.label = label;
                return;
            }

            optionsByKey.set(key, { key, label, count: 1 });
        });
    });

    return Array.from(optionsByKey.values()).sort((left, right) => (
        left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
    ));
}

export function filterSavedPinsByCategoryKeys(savedPlacePins = [], selectedCategoryKeys = []) {
    const selectedKeys = new Set(
        Array.from(selectedCategoryKeys || []).map((key) => normalizeDiscoveryCategoryKey(key)),
    );
    if (selectedKeys.size === 0) return savedPlacePins;

    return savedPlacePins.filter((pin) => (
        getSavedPinCategoryKeys(pin).some((categoryKey) => selectedKeys.has(categoryKey))
    ));
}
