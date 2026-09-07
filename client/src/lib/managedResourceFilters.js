function toPositiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeManagedRegionFilter(value, options = []) {
    const normalized = String(value || 'all');
    return options.some((option) => String(option.value) === normalized) ? normalized : 'all';
}

export function buildManagedRegionFilterOptions(subregions = [], boundaryLayers = null) {
    const configuredRegions = Array.isArray(boundaryLayers?.regions) ? boundaryLayers.regions : [];
    if (configuredRegions.length > 0) {
        const regionOptions = configuredRegions
            .map((region) => {
                const id = toPositiveInteger(region?.id);
                const label = String(region?.name || '').trim();
                return id && label ? { value: `region:${id}`, label } : null;
            })
            .filter(Boolean)
            .sort((left, right) => left.label.localeCompare(right.label, 'en-SG'));
        const unmappedOption = boundaryLayers?.unmapped
            ? [{ value: 'unmapped', label: 'Unmapped postcodes' }]
            : [];
        return [{ value: 'all', label: 'All regions' }, ...regionOptions, ...unmappedOption];
    }

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

export function buildManagedSubregionFilterOptions(subregions = [], regionFilter = 'all', boundaryLayers = null) {
    let allowedSubregionIds = null;
    if (String(regionFilter).startsWith('region:')) {
        const regionId = toPositiveInteger(String(regionFilter).slice('region:'.length));
        const region = (Array.isArray(boundaryLayers?.regions) ? boundaryLayers.regions : [])
            .find((candidate) => Number(candidate?.id) === regionId);
        allowedSubregionIds = new Set((region?.subregionIds || []).map(toPositiveInteger).filter(Boolean));
    } else if (String(regionFilter) === 'unmapped') {
        allowedSubregionIds = new Set();
    }

    const options = (Array.isArray(subregions) ? subregions : [])
        .filter((subregion) => !subregion?.systemFallback && !(
            String(subregion?.subregionCode || '').toUpperCase() === 'SIN'
            && String(subregion?.name || '').trim().toLowerCase() === 'singapore'
        ))
        .filter((subregion) => allowedSubregionIds === null || allowedSubregionIds.has(toPositiveInteger(subregion?.id)))
        .map((subregion) => {
            const id = toPositiveInteger(subregion?.id);
            if (!id) return null;
            const name = String(subregion?.name || '').trim();
            const code = String(subregion?.subregionCode || '').trim();
            const label = name && code && name.toLowerCase() !== code.toLowerCase()
                ? `${name} (${code})`
                : (name || code || `Subregion ${id}`);
            return { value: String(id), label };
        })
        .filter(Boolean)
        .sort((left, right) => left.label.localeCompare(right.label, 'en-SG'));

    return [{ value: 'all', label: 'All subregions' }, ...options];
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

export function getManagedResourcePostalCodes(asset = {}) {
    const postalCodes = new Set();
    const add = (value) => {
        const normalized = String(value || '').replace(/\D/g, '');
        if (/^\d{6}$/.test(normalized)) postalCodes.add(normalized);
    };
    const addLocation = (location) => add(location?.postalCode);

    add(asset?.postalCode);
    addLocation(asset?.location);
    addLocation(asset?.hostLocation);
    (Array.isArray(asset?.locations) ? asset.locations : []).forEach(addLocation);
    (Array.isArray(asset?.groupMemberLocations) ? asset.groupMemberLocations : []).forEach(addLocation);
    return [...postalCodes];
}

export function matchesManagedResourceRegion(asset, regionFilter = 'all', boundaryLayers = null) {
    if (String(regionFilter) === 'all') return true;
    if (String(regionFilter) === 'unmapped') {
        const unmappedCodes = new Set(boundaryLayers?.unmapped?.postalCodesList || []);
        return getManagedResourcePostalCodes(asset).some((postalCode) => unmappedCodes.has(postalCode));
    }
    if (String(regionFilter).startsWith('region:')) {
        const regionId = toPositiveInteger(String(regionFilter).slice('region:'.length));
        const region = (Array.isArray(boundaryLayers?.regions) ? boundaryLayers.regions : [])
            .find((candidate) => Number(candidate?.id) === regionId);
        const subregionIds = new Set((region?.subregionIds || []).map(toPositiveInteger).filter(Boolean));
        return getManagedResourceRegionIds(asset).some((subregionId) => subregionIds.has(subregionId));
    }
    const regionId = toPositiveInteger(regionFilter);
    return Boolean(regionId) && getManagedResourceRegionIds(asset).includes(regionId);
}

export function matchesManagedResourceSubregion(asset, subregionFilter = 'all') {
    if (String(subregionFilter) === 'all') return true;
    const subregionId = toPositiveInteger(subregionFilter);
    return Boolean(subregionId) && getManagedResourceRegionIds(asset).includes(subregionId);
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
