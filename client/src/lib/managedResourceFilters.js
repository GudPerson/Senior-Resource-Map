function toPositiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeManagedRegionFilter(value, options = []) {
    if (String(value) === 'all') return 'all';
    const regionId = toPositiveInteger(value);
    if (!regionId) return 'all';
    return options.some((option) => Number(option.value) === regionId) ? String(regionId) : 'all';
}

export function buildManagedRegionFilterOptions(subregions = []) {
    const seen = new Set();
    const options = (Array.isArray(subregions) ? subregions : [])
        .map((subregion) => {
            const id = toPositiveInteger(subregion?.id);
            if (!id || seen.has(id)) return null;
            seen.add(id);

            const name = String(subregion?.name || '').trim();
            const code = String(subregion?.subregionCode || '').trim();
            const label = name && code && name.toLowerCase() !== code.toLowerCase()
                ? `${name} (${code})`
                : (name || code || `Region ${id}`);
            return { value: String(id), label };
        })
        .filter(Boolean)
        .sort((left, right) => left.label.localeCompare(right.label, 'en-SG'));

    return [{ value: 'all', label: 'All regions' }, ...options];
}

export function getManagedResourceRegionIds(asset = {}) {
    const regionIds = new Set();
    const add = (value) => {
        const id = toPositiveInteger(value);
        if (id) regionIds.add(id);
    };
    const addMany = (values) => {
        (Array.isArray(values) ? values : []).forEach(add);
    };
    const addLocation = (location) => {
        add(location?.subregionId);
        add(location?.primaryRegionId);
        addMany(location?.matchingRegionIds);
    };

    add(asset?.subregionId);
    add(asset?.primaryRegionId);
    addMany(asset?.matchingRegionIds);
    addMany(asset?.coverageRegionIds);
    addLocation(asset?.location);
    addLocation(asset?.hostLocation);
    (Array.isArray(asset?.locations) ? asset.locations : []).forEach(addLocation);
    (Array.isArray(asset?.groupMemberLocations) ? asset.groupMemberLocations : []).forEach(addLocation);

    return [...regionIds];
}

export function matchesManagedResourceRegion(asset, regionFilter = 'all') {
    if (String(regionFilter) === 'all') return true;
    const regionId = toPositiveInteger(regionFilter);
    return Boolean(regionId) && getManagedResourceRegionIds(asset).includes(regionId);
}

export function buildManagedSavedAssetTargets(assets = [], resourceType = '') {
    const type = String(resourceType || '').trim().toLowerCase();
    if (!['hard', 'soft'].includes(type)) return [];

    const seen = new Set();
    return (Array.isArray(assets) ? assets : []).reduce((targets, asset) => {
        const resourceId = toPositiveInteger(asset?.id);
        if (!resourceId || seen.has(resourceId)) return targets;
        seen.add(resourceId);
        targets.push({ resourceType: type, resourceId });
        return targets;
    }, []);
}
