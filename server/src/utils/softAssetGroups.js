import {
    getSoftAssetLocations,
    SOFT_ASSET_MODES,
} from './softAssetHierarchy.js';

export const GROUP_MEMBER_TYPES = Object.freeze({
    HARD: 'hard',
    SOFT: 'soft',
});

const EMPTY_GROUPS = Object.freeze({
    places: [],
    programmes: [],
    services: [],
    promotions: [],
});

function normalizeText(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function normalizeType(value) {
    const text = normalizeText(value).toLowerCase();
    if (text === GROUP_MEMBER_TYPES.HARD || text === 'place' || text === 'places') return GROUP_MEMBER_TYPES.HARD;
    if (text === GROUP_MEMBER_TYPES.SOFT || text === 'programme' || text === 'programmes' || text === 'service' || text === 'services' || text === 'promotion' || text === 'promotions') {
        return GROUP_MEMBER_TYPES.SOFT;
    }
    return '';
}

function normalizeBucket(value) {
    const text = normalizeText(value).toLowerCase();
    if (text.includes('service')) return 'services';
    if (text.includes('promotion')) return 'promotions';
    return 'programmes';
}

function cloneGroupBuckets() {
    return {
        places: [],
        programmes: [],
        services: [],
        promotions: [],
    };
}

export function isGroupSoftAsset(asset) {
    return (asset?.assetMode || SOFT_ASSET_MODES.STANDALONE) === SOFT_ASSET_MODES.GROUP;
}

export function getGroupMemberAsset(entry = {}) {
    return entry.hardAsset || entry.softAsset || entry.member || entry.asset || null;
}

export function getGroupMemberType(entry = {}) {
    return normalizeType(entry.memberResourceType || entry.resourceType || entry.type);
}

function isHiddenNow(asset = {}) {
    if (asset.isHidden || asset.isDeleted || asset.deletedAt) return true;
    const now = Date.now();
    const hideFrom = asset.hideFrom ? new Date(asset.hideFrom).getTime() : null;
    const hideUntil = asset.hideUntil ? new Date(asset.hideUntil).getTime() : null;
    if (hideFrom && Number.isFinite(hideFrom) && hideFrom <= now && (!hideUntil || hideUntil >= now)) return true;
    return false;
}

export function isPublicGroupMemberEntry(entry = {}) {
    const type = getGroupMemberType(entry);
    const asset = getGroupMemberAsset(entry);
    if (!type || !asset || isHiddenNow(asset)) return false;
    if (asset.isMemberOnly || asset.isRestricted || asset.restricted || asset.visibility === 'restricted' || asset.visibility === 'private') return false;

    if (type === GROUP_MEMBER_TYPES.SOFT) {
        if (isGroupSoftAsset(asset)) return false;
        if ((asset.audienceMode || 'public') !== 'public') return false;
    }

    return true;
}

export function getPublicGroupMemberEntries(group = {}) {
    if (!isGroupSoftAsset(group) || isHiddenNow(group) || group.isMemberOnly || (group.audienceMode || 'public') !== 'public') {
        return [];
    }

    return (group.groupMembers || [])
        .filter(isPublicGroupMemberEntry)
        .sort((left, right) => {
            const leftSort = Number.isFinite(Number(left.sortOrder)) ? Number(left.sortOrder) : 0;
            const rightSort = Number.isFinite(Number(right.sortOrder)) ? Number(right.sortOrder) : 0;
            if (leftSort !== rightSort) return leftSort - rightSort;
            return Number(left.memberResourceId || 0) - Number(right.memberResourceId || 0);
        });
}

function toMemberSummary(entry = {}) {
    const asset = getGroupMemberAsset(entry);
    const type = getGroupMemberType(entry);
    if (!asset || !type) return null;

    return {
        id: asset.id,
        resourceType: type,
        name: asset.name,
        subCategory: asset.subCategory || null,
        bucket: type === GROUP_MEMBER_TYPES.SOFT ? (asset.bucket || null) : null,
        description: asset.description || null,
        logoUrl: asset.logoUrl || null,
        address: asset.address || null,
        postalCode: asset.postalCode || null,
        locations: type === GROUP_MEMBER_TYPES.SOFT ? getSoftAssetLocations(asset) : [],
        detailPath: `/resource/${type}/${asset.id}`,
    };
}

export function groupPublicGroupMembers(group = {}) {
    const grouped = cloneGroupBuckets();

    for (const entry of getPublicGroupMemberEntries(group)) {
        const type = getGroupMemberType(entry);
        const member = toMemberSummary(entry);
        if (!member) continue;
        if (type === GROUP_MEMBER_TYPES.HARD) {
            grouped.places.push(member);
            continue;
        }
        grouped[normalizeBucket(member.bucket || member.subCategory)].push(member);
    }

    return grouped;
}

export function buildGroupMemberSummary(group = {}) {
    const grouped = groupPublicGroupMembers(group);
    const counts = {
        places: grouped.places.length,
        programmes: grouped.programmes.length,
        services: grouped.services.length,
        promotions: grouped.promotions.length,
        total: grouped.places.length + grouped.programmes.length + grouped.services.length + grouped.promotions.length,
    };

    return { counts };
}

export function isDiscoverReadyGroup(group = {}) {
    return isGroupSoftAsset(group) && buildGroupMemberSummary(group).counts.total > 0;
}

export function getPublicGroupMemberLocations(group = {}) {
    const locations = [];
    for (const entry of getPublicGroupMemberEntries(group)) {
        const type = getGroupMemberType(entry);
        const asset = getGroupMemberAsset(entry);
        if (!asset) continue;
        if (type === GROUP_MEMBER_TYPES.HARD) {
            locations.push(asset);
            continue;
        }
        locations.push(...getSoftAssetLocations(asset));
    }
    return locations.filter(Boolean);
}

export function buildGroupMemberSearchText(group = {}) {
    return getPublicGroupMemberEntries(group)
        .flatMap((entry) => {
            const asset = getGroupMemberAsset(entry);
            const locations = getGroupMemberType(entry) === GROUP_MEMBER_TYPES.SOFT
                ? getSoftAssetLocations(asset)
                : [];
            return [
                asset?.name,
                asset?.description,
                asset?.subCategory,
                asset?.bucket,
                asset?.address,
                asset?.postalCode,
                ...(locations || []).flatMap((location) => [location?.name, location?.address, location?.postalCode, location?.subCategory]),
            ];
        })
        .map(normalizeText)
        .filter(Boolean)
        .join(' ');
}

export function buildGroupDiscoverMetadata(group = {}) {
    const summary = buildGroupMemberSummary(group);
    return {
        assetMode: SOFT_ASSET_MODES.GROUP,
        isDiscoverReady: isDiscoverReadyGroup(group),
        groupMemberSummary: summary,
        groupMemberSearchText: buildGroupMemberSearchText(group),
        locationCount: getPublicGroupMemberLocations(group).length,
    };
}

export function buildPublicGroupPayload(group = {}) {
    const grouped = groupPublicGroupMembers(group);
    const summary = buildGroupMemberSummary(group);
    return {
        id: group.id,
        assetMode: SOFT_ASSET_MODES.GROUP,
        name: group.name,
        description: group.description || null,
        logoUrl: group.logoUrl || null,
        bannerUrl: group.bannerUrl || null,
        tags: Array.isArray(group.tags) ? group.tags.map((entry) => entry?.tag?.name || entry?.name).filter(Boolean) : [],
        groupMemberSummary: summary,
        groupMembers: grouped,
        groupMemberSearchText: buildGroupMemberSearchText(group),
        groupMemberLocations: getPublicGroupMemberLocations(group),
    };
}

export function emptyGroupMembers() {
    return {
        places: [...EMPTY_GROUPS.places],
        programmes: [...EMPTY_GROUPS.programmes],
        services: [...EMPTY_GROUPS.services],
        promotions: [...EMPTY_GROUPS.promotions],
    };
}
