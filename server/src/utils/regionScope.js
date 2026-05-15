import { hasHardAssetStaffAccess } from './hardAssetStaff.js';
import { normalizeRole } from './roles.js';
import { hasSoftAssetStaffAccess } from './softAssetAccess.js';

function toInteger(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function uniqueSortedIntegers(values = []) {
    return [...new Set(
        values
            .map(toInteger)
            .filter(Number.isInteger)
    )].sort((left, right) => left - right);
}

export function getActorRegionIds(actor) {
    const values = Array.isArray(actor?.subregionIds)
        ? actor.subregionIds
        : [actor?.subregionId];
    return uniqueSortedIntegers(values);
}

export function summarizeMatchingRegions(regions = []) {
    return uniqueSortedIntegers(regions.map((region) => region?.id ?? region));
}

export function getAssetMatchingRegionIds(asset) {
    return uniqueSortedIntegers([
        ...(Array.isArray(asset?.matchingRegionIds) ? asset.matchingRegionIds : []),
        ...(Array.isArray(asset?.coverageRegionIds) ? asset.coverageRegionIds : []),
    ]);
}

export function actorMatchesAnyRegion(actor, regionIds = []) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    const actorRegionIds = new Set(getActorRegionIds(actor));
    return uniqueSortedIntegers(regionIds).some((regionId) => actorRegionIds.has(regionId));
}

export function hardAssetMatchesActorRegions(actor, asset) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    if (hasHardAssetStaffAccess(actor, asset?.id, ['owner', 'staff'])) return true;
    return actorMatchesAnyRegion(actor, getAssetMatchingRegionIds(asset));
}

export function standaloneSoftAssetMatchesActorRegions(actor, offering) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    if (hasSoftAssetStaffAccess(actor, offering?.id, ['owner', 'staff'])) return true;
    return actorMatchesAnyRegion(actor, offering?.coverageRegionIds || []);
}

export function attachHardAssetRegionMatches(assets = [], regionRows = []) {
    const regionsByPostalCode = new Map();
    for (const row of regionRows) {
        const postalCode = String(row?.postalCode || '').trim();
        const subregionId = toInteger(row?.subregionId);
        if (!postalCode || !subregionId) continue;
        if (!regionsByPostalCode.has(postalCode)) regionsByPostalCode.set(postalCode, []);
        regionsByPostalCode.get(postalCode).push(subregionId);
    }

    return assets.map((asset) => ({
        ...asset,
        matchingRegionIds: uniqueSortedIntegers(regionsByPostalCode.get(String(asset?.postalCode || '').trim()) || []),
    }));
}

export function filterHardAssetsByRegionRelevance(assets = [], actor) {
    if (normalizeRole(actor?.role) === 'super_admin') return assets;
    return assets.filter((asset) => hardAssetMatchesActorRegions(actor, asset));
}

export function attachStandaloneSoftAssetCoverage(offerings = [], coverageRows = []) {
    const coverageBySoftAssetId = new Map();
    for (const row of coverageRows) {
        const softAssetId = toInteger(row?.softAssetId);
        const subregionId = toInteger(row?.subregionId);
        if (!softAssetId || !subregionId) continue;
        if (!coverageBySoftAssetId.has(softAssetId)) coverageBySoftAssetId.set(softAssetId, []);
        coverageBySoftAssetId.get(softAssetId).push(subregionId);
    }

    return offerings.map((offering) => ({
        ...offering,
        coverageRegionIds: uniqueSortedIntegers(coverageBySoftAssetId.get(toInteger(offering?.id)) || []),
    }));
}

export function isStandaloneSoftAsset(offering) {
    const hasLinkedLocations = Array.isArray(offering?.locations) && offering.locations.length > 0;
    return !offering?.hostHardAssetId
        && !hasLinkedLocations
        && (offering?.assetMode || 'standalone') === 'standalone';
}

export function filterSoftAssetsByRegionRelevance(offerings = [], actor) {
    if (normalizeRole(actor?.role) === 'super_admin') return offerings;
    return offerings.filter((offering) => {
        if (isStandaloneSoftAsset(offering)) {
            return standaloneSoftAssetMatchesActorRegions(actor, offering);
        }
        const linkedRegionIds = uniqueSortedIntegers([
            ...(Array.isArray(offering?.matchingRegionIds) ? offering.matchingRegionIds : []),
            ...(Array.isArray(offering?.locations)
                ? offering.locations.flatMap((location) => [
                    ...(Array.isArray(location?.matchingRegionIds) ? location.matchingRegionIds : []),
                    ...(Array.isArray(location?.hardAsset?.matchingRegionIds) ? location.hardAsset.matchingRegionIds : []),
                ])
                : []),
        ]);
        return actorMatchesAnyRegion(actor, linkedRegionIds)
            || hasHardAssetStaffAccess(actor, offering?.hostHardAssetId, ['owner', 'staff'])
            || (Array.isArray(offering?.locations)
                && offering.locations.some((location) => hasHardAssetStaffAccess(actor, location?.hardAssetId ?? location?.hardAsset?.id, ['owner', 'staff'])));
    });
}
