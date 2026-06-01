function normalizeLocationCount(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function buildDiscoveryMobileLocationSummary({
    isHard,
    asset,
    displayLocation,
    t,
}) {
    if (isHard) {
        return asset?.address || null;
    }

    if (displayLocation?.address) {
        return displayLocation.address;
    }

    const locationCount = normalizeLocationCount(asset?._locationCount);
    if (locationCount <= 0) {
        return null;
    }

    return `${t('availableIn')} ${locationCount} ${locationCount === 1 ? t('placesSingular') : t('placesPlural')}`;
}

export function shouldShowDiscoveryMobileLocationSummary({
    summary,
    hasDirectionsTarget,
}) {
    return Boolean(summary || hasDirectionsTarget);
}
