function cleanText(value) {
    return String(value || '').trim();
}

export function getResourceDetailPhone({ asset, primaryLocation, isHard } = {}) {
    const assetPhone = isHard
        ? cleanText(asset?.phone)
        : cleanText(asset?.contactPhone) || cleanText(asset?.phone);
    return assetPhone || cleanText(primaryLocation?.phone);
}

export function shouldShowLinkedPlaceDetails({ isHard, softLocations } = {}) {
    return !isHard && Array.isArray(softLocations) && softLocations.length > 0;
}

export function shouldShowMobileGrabAction({ isPhone, grabRideHref } = {}) {
    return Boolean(isPhone && grabRideHref);
}

export function getResourceHeroPresentation({ hasBanner, isCompact } = {}) {
    if (hasBanner) {
        return {
            frameClass: 'p-0',
            imageClass: isCompact
                ? 'relative block w-full h-auto max-h-[min(58vh,28rem)] object-contain'
                : 'relative block w-full h-auto max-h-[min(58vh,36rem)] object-contain',
        };
    }

    return {
        frameClass: isCompact ? 'h-28 p-4' : 'h-32 sm:h-48 p-4',
        imageClass: 'max-h-full max-w-full object-contain',
    };
}
