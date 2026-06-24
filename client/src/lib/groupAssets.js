export function isGroupAsset(asset) {
    return String(asset?.assetMode || asset?.asset_mode || '').trim().toLowerCase() === 'group';
}

export function getGroupMemberCounts(asset = {}) {
    const counts = asset?.groupMemberSummary?.counts || {};
    return {
        places: Number(counts.places || 0),
        programmes: Number(counts.programmes || 0),
        services: Number(counts.services || 0),
        promotions: Number(counts.promotions || 0),
        total: Number(counts.total || 0),
    };
}

export function formatGroupMemberCountParts(asset = {}) {
    const counts = getGroupMemberCounts(asset);
    return [
        ['Place', 'Places', counts.places],
        ['Programme', 'Programmes', counts.programmes],
        ['Service', 'Services', counts.services],
        ['Promotion', 'Promotions', counts.promotions],
    ]
        .filter(([, , count]) => count > 0)
        .map(([singular, plural, count]) => `${count} ${count === 1 ? singular : plural}`);
}

export function formatGroupMemberCountLine(asset = {}) {
    const parts = formatGroupMemberCountParts(asset);
    return parts.length > 0 ? parts.join(' | ') : 'Needs members';
}

export function getGroupVisibilitySummary(asset = {}) {
    const audienceMode = String(asset?.audienceMode || asset?.audience_mode || 'public').trim().toLowerCase();
    if (audienceMode !== 'target_regions') {
        return {
            label: 'Public',
            detail: 'Open to everyone',
        };
    }

    const regionIds = Array.isArray(asset?.coverageRegionIds)
        ? asset.coverageRegionIds
        : (Array.isArray(asset?.coverage_region_ids) ? asset.coverage_region_ids : []);
    const selectedCount = regionIds.filter((regionId) => String(regionId ?? '').trim() !== '').length;

    return {
        label: 'Target region/s',
        detail: selectedCount === 1 ? '1 selected Region' : `${selectedCount} selected Regions`,
    };
}

export function formatGroupReviewDate(value, locale = 'en-SG') {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';

    return new Intl.DateTimeFormat(locale || 'en-SG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

export function formatGroupUpdateSummary(asset = {}, locale = 'en-SG') {
    const dateLabel = formatGroupReviewDate(asset?.updatedAt || asset?.updated_at || asset?.createdAt || asset?.created_at, locale);
    const actorName = String(asset?.updatedByName || asset?.updated_by_name || asset?.creatorName || asset?.creator_name || '').trim();
    const detail = [
        dateLabel,
        actorName ? `by ${actorName}` : '',
    ].filter(Boolean).join(' ');

    if (!detail) return null;
    return {
        label: 'Last updated',
        detail,
    };
}

export function getGroupGalleryUrls(asset = {}, limit = 3) {
    const urls = Array.isArray(asset?.galleryUrls) ? asset.galleryUrls : [];
    return urls
        .map((url) => String(url || '').trim())
        .filter(Boolean)
        .slice(0, Math.max(0, limit));
}

export function formatGroupSaveErrorMessage(error) {
    const message = typeof error === 'string' ? error : (error?.message || '');
    if (/generated child offerings must be created from a parent template/i.test(message)) {
        return 'Group saving needs the latest API. This preview is connected to an API that does not support Groups yet.';
    }
    return message || 'Failed to save Group.';
}
