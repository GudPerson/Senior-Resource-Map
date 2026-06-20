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
