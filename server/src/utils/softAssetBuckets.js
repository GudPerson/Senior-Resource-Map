export const SOFT_ASSET_BUCKETS = Object.freeze(['Programmes', 'Services', 'Promotions']);

export function normalizeSoftAssetBucket(value, fallback = null) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

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

    const err = new Error('Bucket must be Programmes, Services, or Promotions.');
    err.status = 400;
    throw err;
}

export function inferSoftAssetBucket(asset = {}) {
    const searchableText = [
        asset?.subCategory,
        asset?.name,
        asset?.description,
        ...(Array.isArray(asset?.tags) ? asset.tags : []),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (/\b(promotion|promo|discount|voucher|subsid(?:y|ies)|benefit|rebate|grant|deal|offer|perk)\b/.test(searchableText)) {
        return { bucket: 'Promotions', confidence: 'high', reason: 'promotion-keyword' };
    }

    if (/\b(service|screening|care|support|transport|rehab|therapy|clinic|nursing|residential|consult(?:ation)?|assistance|assessment|health post|medical|home care|day care)\b/.test(searchableText)) {
        return { bucket: 'Services', confidence: 'high', reason: 'service-keyword' };
    }

    if (/\b(programme|program|activity|activities|class|workshop|session|course|training|club|group|talk|exercise|dance|yoga|literacy|befriend|event|outing|gardening)\b/.test(searchableText)) {
        return { bucket: 'Programmes', confidence: 'high', reason: 'programme-keyword' };
    }

    return { bucket: 'Programmes', confidence: 'low', reason: 'default-fallback' };
}
