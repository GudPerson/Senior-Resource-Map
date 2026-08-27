const PUBLIC_HARD_ASSET_FIELDS = [
    'id',
    'name',
    'subCategory',
    'lat',
    'lng',
    'address',
    'country',
    'postalCode',
    'phone',
    'whatsappContact',
    'contactEmail',
    'hours',
    'website',
    'socialLinks',
    'description',
    'logoUrl',
    'bannerUrl',
    'galleryUrls',
    'isHidden',
    'hideFrom',
    'hideUntil',
    'updatedAt',
    'tags',
    'translations',
];

const PUBLIC_SOFT_ASSET_FIELDS = [
    'id',
    'name',
    'bucket',
    'subCategory',
    'description',
    'schedule',
    'logoUrl',
    'bannerUrl',
    'galleryUrls',
    'website',
    'socialLinks',
    'contactPhone',
    'whatsappContact',
    'contactEmail',
    'ctaLabel',
    'ctaUrl',
    'venueNote',
    'availabilityEnabled',
    'availabilityCount',
    'availabilityUnit',
    'assetMode',
    'audienceMode',
    'isHidden',
    'hideFrom',
    'hideUntil',
    'updatedAt',
    'tags',
    'translations',
    'access',
    'missingProfileFields',
    'groupMemberSummary',
    'groupMemberSearchText',
];

const PUBLIC_GROUP_MEMBER_FIELDS = [
    'resourceType',
    'id',
    'name',
    'bucket',
    'subCategory',
    'description',
    'schedule',
    'logoUrl',
    'bannerUrl',
    'galleryUrls',
    'address',
    'postalCode',
    'lat',
    'lng',
    'phone',
    'contactPhone',
    'whatsappContact',
    'contactEmail',
    'website',
    'socialLinks',
];

function pickDefined(source, fields) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
    return Object.fromEntries(fields
        .filter((field) => Object.prototype.hasOwnProperty.call(source, field) && source[field] !== undefined)
        .map((field) => [field, source[field]]));
}

function buildPublicLocationDto(location) {
    return pickDefined(location, PUBLIC_HARD_ASSET_FIELDS);
}

function buildPublicGroupMemberDto(member) {
    const dto = pickDefined(member, PUBLIC_GROUP_MEMBER_FIELDS);
    if (Array.isArray(member?.locations)) {
        dto.locations = member.locations.map(buildPublicLocationDto);
    }
    if (member?.location && typeof member.location === 'object') {
        dto.location = buildPublicLocationDto(member.location);
    }
    return dto;
}

function buildPublicGroupMembersDto(groupMembers) {
    if (!groupMembers || typeof groupMembers !== 'object' || Array.isArray(groupMembers)) return undefined;
    return Object.fromEntries(['places', 'programmes', 'services', 'promotions']
        .filter((bucket) => Array.isArray(groupMembers[bucket]))
        .map((bucket) => [bucket, groupMembers[bucket].map(buildPublicGroupMemberDto)]));
}

export function buildPublicSoftAssetDto(asset) {
    const dto = pickDefined(asset, PUBLIC_SOFT_ASSET_FIELDS);
    if (Array.isArray(asset?.locations)) {
        dto.locations = asset.locations.map(buildPublicLocationDto);
    }
    if (asset?.location && typeof asset.location === 'object') {
        dto.location = buildPublicLocationDto(asset.location);
    }
    if (asset?.hostLocation && typeof asset.hostLocation === 'object') {
        dto.hostLocation = buildPublicLocationDto(asset.hostLocation);
    }
    const groupMembers = buildPublicGroupMembersDto(asset?.groupMembers);
    if (groupMembers) dto.groupMembers = groupMembers;
    if (Array.isArray(asset?.groupMemberLocations)) {
        dto.groupMemberLocations = asset.groupMemberLocations.map(buildPublicLocationDto);
    }
    return dto;
}

export function buildPublicHardAssetDto(asset) {
    const dto = pickDefined(asset, PUBLIC_HARD_ASSET_FIELDS);
    if (Array.isArray(asset?.softAssets)) {
        dto.softAssets = asset.softAssets.map(buildPublicSoftAssetDto);
    }
    return dto;
}
