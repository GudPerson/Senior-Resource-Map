export const SOFT_ASSET_BUCKETS = ['Programmes', 'Services', 'Promotions'];

function normalizeBucket(value) {
    if (!value) return null;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'programme' || normalized === 'programmes' || normalized === 'program' || normalized === 'programs') {
        return 'Programmes';
    }
    if (normalized === 'service' || normalized === 'services') {
        return 'Services';
    }
    if (normalized === 'promotion' || normalized === 'promotions') {
        return 'Promotions';
    }
    return null;
}

export function getSoftAssetBucket(asset) {
    const explicitBucket = normalizeBucket(asset?.bucket || asset?.categoryType || asset?.softAssetType || asset?.subCategory);
    if (explicitBucket) return explicitBucket;

    const haystack = [
        asset?.subCategory,
        asset?.name,
        asset?.description,
        ...(Array.isArray(asset?.tags) ? asset.tags : []),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (/(promotion|promo|discount|voucher|subsid|benefit|rebate|grant|deal|offer)/.test(haystack)) {
        return 'Promotions';
    }

    if (/(service|screening|care|support|transport|rehab|therapy|clinic|nursing|residential|consult|assistance|health post|assessment|home care|day care)/.test(haystack)) {
        return 'Services';
    }

    return 'Programmes';
}

export function summarizeSoftAssetBuckets(softAssets = []) {
    const counts = SOFT_ASSET_BUCKETS.reduce((accumulator, bucket) => {
        accumulator[bucket] = 0;
        return accumulator;
    }, {});

    softAssets.forEach((asset) => {
        counts[getSoftAssetBucket(asset)] += 1;
    });

    return counts;
}

export function groupSoftAssetsByBucket(softAssets = []) {
    const groups = SOFT_ASSET_BUCKETS.reduce((accumulator, bucket) => {
        accumulator[bucket] = [];
        return accumulator;
    }, {});

    softAssets.forEach((asset) => {
        groups[getSoftAssetBucket(asset)].push(asset);
    });

    return groups;
}
