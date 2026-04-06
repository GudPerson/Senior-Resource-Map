import { getDistance } from '../../lib/geo.js';
import { resolvePostalGroupCode } from '../../lib/postalGrouping.js';
import { buildSavedAssetKey, buildSavedAssetDetailPath } from '../../lib/savedAssets.js';

export function buildDerivedMapLocations(hardAssets = [], softAssets = []) {
    const hardLocations = hardAssets
        .filter((asset) => asset?.lat && asset?.lng)
        .map((asset) => ({
            id: asset.id,
            locationId: asset.id,
            title: asset.name,
            category: asset.subCategory,
            lat: asset.lat,
            lng: asset.lng,
            asset_type: 'hard',
        }));

    const softLocations = softAssets.flatMap((asset) => {
        const linkedLocations = Array.isArray(asset.locations) && asset.locations.length > 0
            ? asset.locations
            : (asset.location ? [asset.location] : []);

        return linkedLocations
            .filter((location) => location?.lat && location?.lng)
            .map((location) => ({
                id: asset.id,
                locationId: location.id,
                title: asset.name,
                category: asset.subCategory,
                lat: location.lat,
                lng: location.lng,
                asset_type: 'soft',
            }));
    });

    return [...hardLocations, ...softLocations];
}

export function hasValidCoordinates(item) {
    return Number.isFinite(parseFloat(item?.lat)) && Number.isFinite(parseFloat(item?.lng));
}

export function getAssetLocations(asset) {
    if (!asset) return [];
    if (asset._type === 'hard' || asset.asset_type === 'hard') return [asset];
    if (Array.isArray(asset.locations) && asset.locations.length > 0) return asset.locations;
    if (asset.location) return [asset.location];
    return [];
}

export function getBestLocation(asset, referencePoint = null) {
    const locations = getAssetLocations(asset);
    if (locations.length === 0) return null;
    if (!referencePoint) return locations[0];

    const validLocations = locations.filter(hasValidCoordinates);
    if (validLocations.length === 0) return locations[0];

    return validLocations.reduce((best, current) => {
        const bestDistance = getDistance(referencePoint.lat, referencePoint.lng, parseFloat(best.lat), parseFloat(best.lng));
        const currentDistance = getDistance(referencePoint.lat, referencePoint.lng, parseFloat(current.lat), parseFloat(current.lng));
        return currentDistance < bestDistance ? current : best;
    });
}

export function findLocationForMarker(asset, marker) {
    if (!asset) return null;
    if (asset._type === 'hard' || asset.asset_type === 'hard') return asset;

    const locations = getAssetLocations(asset);
    if (locations.length === 0) return null;

    if (marker?.locationId) {
        const byId = locations.find((location) => location.id === marker.locationId);
        if (byId) return byId;
    }

    const lat = Number.parseFloat(marker?.lat);
    const lng = Number.parseFloat(marker?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const byCoordinates = locations.find((location) => {
            const locationLat = Number.parseFloat(location.lat);
            const locationLng = Number.parseFloat(location.lng);
            return Number.isFinite(locationLat)
                && Number.isFinite(locationLng)
                && Math.abs(locationLat - lat) < 0.000001
                && Math.abs(locationLng - lng) < 0.000001;
        });

        if (byCoordinates) return byCoordinates;
    }

    return locations[0];
}

export function buildMarkerKey(item) {
    const type = item?.asset_type || item?._type || 'asset';
    const id = item?.id ?? 'unknown';
    const locationId = item?.locationId ?? item?.linkedLocationId;
    if (locationId) return `${type}-${id}-${locationId}`;

    const lat = Number.parseFloat(item?.lat);
    const lng = Number.parseFloat(item?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return `${type}-${id}-${lat.toFixed(6)}-${lng.toFixed(6)}`;
    }

    return `${type}-${id}`;
}

function normalizeCoordinate(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCategoryKey(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim().toLowerCase();
}

function getCategoryMeta(categoryMetaByKey, subCategory) {
    const key = normalizeCategoryKey(subCategory);
    if (!key || !categoryMetaByKey) return null;

    if (categoryMetaByKey instanceof Map) {
        return categoryMetaByKey.get(key) || null;
    }

    return categoryMetaByKey[key] || null;
}

function normalizeSavedAssetEntry(savedAsset, liveAsset = null) {
    return {
        assetKey: buildSavedAssetKey(savedAsset.resourceType, savedAsset.resourceId),
        resourceType: savedAsset.resourceType,
        resourceId: savedAsset.resourceId,
        name: liveAsset?.name || savedAsset.name || 'Saved resource',
        subCategory: liveAsset?.subCategory || savedAsset.subCategory || (savedAsset.resourceType === 'hard' ? 'Place' : 'Offering'),
        detailPath: savedAsset.detailPath || buildSavedAssetDetailPath(savedAsset.resourceType, savedAsset.resourceId),
        status: savedAsset.status || 'available',
        hasCoordinates: savedAsset.hasCoordinates !== false,
        liveAsset,
    };
}

function orderLocationsByDistance(locations, userLocation) {
    if (!userLocation) return locations;

    return [...locations].sort((left, right) => {
        const leftDistance = hasValidCoordinates(left)
            ? getDistance(userLocation.lat, userLocation.lng, normalizeCoordinate(left.lat), normalizeCoordinate(left.lng))
            : Number.POSITIVE_INFINITY;
        const rightDistance = hasValidCoordinates(right)
            ? getDistance(userLocation.lat, userLocation.lng, normalizeCoordinate(right.lat), normalizeCoordinate(right.lng))
            : Number.POSITIVE_INFINITY;

        return leftDistance - rightDistance;
    });
}

export function resolveSavedPlaceKey(location) {
    if (!location) return null;

    if (Number.isInteger(location.hardAssetId)) return `hard-${location.hardAssetId}`;
    if (Number.isInteger(location.hostHardAssetId)) return `host-${location.hostHardAssetId}`;
    if (Number.isInteger(location.locationId)) return `location-${location.locationId}`;

    const lat = normalizeCoordinate(location.lat);
    const lng = normalizeCoordinate(location.lng);
    if (lat !== null && lng !== null) {
        return `coord-${lat.toFixed(6)}-${lng.toFixed(6)}`;
    }

    return null;
}

function buildHardAssetContribution(savedAsset, hardAsset) {
    if (!hardAsset || !hasValidCoordinates(hardAsset)) {
        return null;
    }

    return {
        placeKey: resolveSavedPlaceKey({ hardAssetId: hardAsset.id, lat: hardAsset.lat, lng: hardAsset.lng }),
        placeId: hardAsset.id,
        locationId: hardAsset.id,
        lat: normalizeCoordinate(hardAsset.lat),
        lng: normalizeCoordinate(hardAsset.lng),
        title: hardAsset.name || savedAsset.name || 'Saved place',
        address: hardAsset.address || savedAsset.address || null,
        postalCode: resolvePostalGroupCode({ postalCode: hardAsset.postalCode, address: hardAsset.address }),
        placeAsset: hardAsset,
        totalOfferingsCount: Array.isArray(hardAsset.softAssets) ? hardAsset.softAssets.length : null,
        savedAsset: normalizeSavedAssetEntry(savedAsset, hardAsset),
        sourceAssetKey: buildSavedAssetKey(savedAsset.resourceType, savedAsset.resourceId),
        sourceAssetType: 'hard',
        sourceAssetId: hardAsset.id,
    };
}

function buildSoftAssetContribution(savedAsset, softAsset, location, hardLookup) {
    if (!location || !hasValidCoordinates(location)) {
        return null;
    }

    const hardAsset = Number.isInteger(location.id)
        ? hardLookup.get(location.id) || location
        : location;

    return {
        placeKey: resolveSavedPlaceKey({
            hardAssetId: Number.isInteger(hardAsset?.id) ? hardAsset.id : null,
            locationId: Number.isInteger(location?.id) ? location.id : null,
            lat: location.lat,
            lng: location.lng,
        }),
        placeId: Number.isInteger(hardAsset?.id) ? hardAsset.id : null,
        locationId: Number.isInteger(location?.id) ? location.id : null,
        lat: normalizeCoordinate(location.lat),
        lng: normalizeCoordinate(location.lng),
        title: hardAsset?.name || location.name || softAsset.name || savedAsset.name || 'Saved place',
        address: hardAsset?.address || location.address || savedAsset.address || null,
        postalCode: resolvePostalGroupCode({
            postalCode: hardAsset?.postalCode || location?.postalCode,
            address: hardAsset?.address || location?.address || savedAsset.address,
        }),
        placeAsset: hardAsset || null,
        totalOfferingsCount: Array.isArray(hardAsset?.softAssets) ? hardAsset.softAssets.length : null,
        savedAsset: normalizeSavedAssetEntry(savedAsset, softAsset),
        sourceAssetKey: buildSavedAssetKey(savedAsset.resourceType, savedAsset.resourceId),
        sourceAssetType: 'soft',
        sourceAssetId: softAsset.id,
    };
}

export function buildSavedMapContributions(savedAssets = [], hardAssets = [], softAssets = [], options = {}) {
    const hardAssetById = new Map(hardAssets.map((asset) => [asset.id, asset]));
    const hardAssetByKey = new Map(hardAssets.map((asset) => [buildSavedAssetKey('hard', asset.id), asset]));
    const softAssetByKey = new Map(softAssets.map((asset) => [buildSavedAssetKey('soft', asset.id), asset]));
    const assetToPinKeys = new Map();
    const contributions = [];
    const contributingAssetKeys = new Set();
    const unmappableSavedAssetKeys = new Set();
    const { userLocation = null } = options;

    savedAssets.forEach((savedAsset) => {
        const assetKey = buildSavedAssetKey(savedAsset.resourceType, savedAsset.resourceId);
        const pinKeys = [];

        if (savedAsset.resourceType === 'hard') {
            const hardAsset = hardAssetByKey.get(assetKey);
            const contribution = buildHardAssetContribution(savedAsset, hardAsset);

            if (!contribution?.placeKey) {
                unmappableSavedAssetKeys.add(assetKey);
            } else {
                contributions.push(contribution);
                pinKeys.push(contribution.placeKey);
                contributingAssetKeys.add(assetKey);
            }
        } else if (savedAsset.resourceType === 'soft') {
            const softAsset = softAssetByKey.get(assetKey);
            const orderedLocations = orderLocationsByDistance(getAssetLocations(softAsset), userLocation);

            if (orderedLocations.length === 0) {
                unmappableSavedAssetKeys.add(assetKey);
            } else {
                orderedLocations.forEach((location) => {
                    const contribution = buildSoftAssetContribution(savedAsset, softAsset, location, hardAssetById);
                    if (!contribution?.placeKey) return;
                    contributions.push(contribution);
                    pinKeys.push(contribution.placeKey);
                });

                if (pinKeys.length > 0) {
                    contributingAssetKeys.add(assetKey);
                } else {
                    unmappableSavedAssetKeys.add(assetKey);
                }
            }
        } else {
            unmappableSavedAssetKeys.add(assetKey);
        }

        if (pinKeys.length > 0) {
            assetToPinKeys.set(assetKey, [...new Set(pinKeys)]);
        }
    });

    return {
        contributions,
        assetToPinKeys,
        contributingAssetKeys,
        unmappableSavedAssetKeys,
    };
}

function choosePrimarySavedAsset(savedAssets, placeAsset) {
    if (placeAsset) {
        const placeAssetKey = buildSavedAssetKey('hard', placeAsset.id);
        const savedPlace = savedAssets.find((entry) => entry.assetKey === placeAssetKey);
        if (savedPlace) return savedPlace;
    }

    return savedAssets[0] || null;
}

function resolveSavedPinCategoryIcon(savedAssets, placeAsset, categoryMetaByKey) {
    const savedPlaceAsset = placeAsset
        ? savedAssets.find((asset) => asset.resourceType === 'hard' && asset.resourceId === placeAsset.id)
        : null;

    if (savedPlaceAsset) {
        const hardPlaceMeta = getCategoryMeta(categoryMetaByKey, placeAsset?.subCategory || savedPlaceAsset.subCategory);
        if (hardPlaceMeta?.iconUrl) {
            return hardPlaceMeta.iconUrl;
        }
    }

    const sharedCategoryKeys = new Set();
    let sharedCategoryIconUrl = null;

    for (const asset of savedAssets) {
        const key = normalizeCategoryKey(asset.subCategory);
        if (!key) continue;
        sharedCategoryKeys.add(key);
        if (sharedCategoryKeys.size > 1) {
            return null;
        }
        sharedCategoryIconUrl = getCategoryMeta(categoryMetaByKey, asset.subCategory)?.iconUrl || null;
    }

    return sharedCategoryKeys.size === 1 ? sharedCategoryIconUrl : null;
}

export function aggregateSavedPlacePins(contributions = [], options = {}) {
    const { categoryMetaByKey = null } = options;
    const pinsByKey = new Map();

    contributions.forEach((contribution) => {
        if (!contribution?.placeKey) return;

        const existing = pinsByKey.get(contribution.placeKey);
        if (!existing) {
            pinsByKey.set(contribution.placeKey, {
                pinKey: contribution.placeKey,
                placeId: contribution.placeId,
                title: contribution.title,
                address: contribution.address,
                postalCode: contribution.postalCode || '',
                lat: contribution.lat,
                lng: contribution.lng,
                locationId: contribution.locationId,
                placeAsset: contribution.placeAsset || null,
                placeDetailPath: contribution.placeAsset?.id ? buildSavedAssetDetailPath('hard', contribution.placeAsset.id) : null,
                totalOfferingsCount: contribution.totalOfferingsCount,
                savedAssetKeys: [contribution.savedAsset.assetKey],
                savedAssets: [contribution.savedAsset],
                hasUnavailableSavedAssets: contribution.savedAsset.status === 'unavailable',
                hasListOnlySavedAssets: !contribution.savedAsset.hasCoordinates,
                primarySavedAsset: null,
            });
            return;
        }

        if (!existing.placeAsset && contribution.placeAsset) {
            existing.placeAsset = contribution.placeAsset;
            existing.placeId = contribution.placeId;
            existing.placeDetailPath = contribution.placeAsset?.id ? buildSavedAssetDetailPath('hard', contribution.placeAsset.id) : null;
            existing.title = contribution.placeAsset.name || existing.title;
            existing.address = contribution.placeAsset.address || existing.address;
            existing.postalCode = resolvePostalGroupCode({
                postalCode: contribution.placeAsset.postalCode,
                address: contribution.placeAsset.address || existing.address,
            }) || existing.postalCode;
            existing.totalOfferingsCount = contribution.totalOfferingsCount;
        }

        if (!existing.savedAssetKeys.includes(contribution.savedAsset.assetKey)) {
            existing.savedAssetKeys.push(contribution.savedAsset.assetKey);
            existing.savedAssets.push(contribution.savedAsset);
        }

        existing.hasUnavailableSavedAssets ||= contribution.savedAsset.status === 'unavailable';
        existing.hasListOnlySavedAssets ||= !contribution.savedAsset.hasCoordinates;
    });

    const pins = [...pinsByKey.values()].map((pin) => {
        const primarySavedAsset = choosePrimarySavedAsset(pin.savedAssets, pin.placeAsset);
        const fallbackOfferingCount = pin.savedAssets.filter((asset) => asset.resourceType === 'soft').length;

        return {
            ...pin,
            totalOfferingsCount: Number.isInteger(pin.totalOfferingsCount)
                ? pin.totalOfferingsCount
                : fallbackOfferingCount,
            primarySavedAsset,
            primaryDetailAsset: pin.placeAsset || primarySavedAsset?.liveAsset || null,
            categoryIconUrl: resolveSavedPinCategoryIcon(pin.savedAssets, pin.placeAsset, categoryMetaByKey),
            postalCode: resolvePostalGroupCode({
                postalCode: pin.postalCode || pin.placeAsset?.postalCode,
                address: pin.address || pin.placeAsset?.address,
            }),
        };
    });

    return pins.sort((left, right) => left.title.localeCompare(right.title));
}

export function buildSavedPlacePins(savedAssets = [], hardAssets = [], softAssets = [], options = {}) {
    const {
        contributions,
        assetToPinKeys,
        contributingAssetKeys,
        unmappableSavedAssetKeys,
    } = buildSavedMapContributions(savedAssets, hardAssets, softAssets, options);

    return {
        pins: aggregateSavedPlacePins(contributions, options),
        assetToPinKeys,
        contributingAssetKeys,
        unmappableSavedAssetKeys,
    };
}
