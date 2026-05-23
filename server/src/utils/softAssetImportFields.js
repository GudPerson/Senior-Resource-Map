const SOFT_ASSET_NAME_MAX_LENGTH = 255;
const SOFT_ASSET_SUB_CATEGORY_MAX_LENGTH = 50;
const SOFT_ASSET_SHORT_TEXT_MAX_LENGTH = 255;
const SOFT_ASSET_PHONE_MAX_LENGTH = 50;
const SOFT_ASSET_TAG_MAX_LENGTH = 100;

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function limitText(value, maxLength) {
    const text = normalizeText(value);
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

export function normalizeImportedSoftAssetName(value) {
    return limitText(value, SOFT_ASSET_NAME_MAX_LENGTH);
}

export function normalizeImportedSoftAssetSubCategory(value, fallbackBucket = 'Programmes') {
    const text = normalizeText(value);
    const fallback = limitText(fallbackBucket, SOFT_ASSET_SUB_CATEGORY_MAX_LENGTH) || 'Programmes';
    if (!text) return fallback;
    return text.length > SOFT_ASSET_SUB_CATEGORY_MAX_LENGTH ? fallback : text;
}

export function normalizeImportedSoftAssetPhone(value) {
    return limitText(value, SOFT_ASSET_PHONE_MAX_LENGTH) || null;
}

export function normalizeImportedSoftAssetShortText(value) {
    return limitText(value, SOFT_ASSET_SHORT_TEXT_MAX_LENGTH) || null;
}

export function normalizeImportedSoftAssetTags(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : [])
        .map((tag) => limitText(String(tag || '').toLowerCase(), SOFT_ASSET_TAG_MAX_LENGTH))
        .filter((tag) => {
            if (!tag || seen.has(tag)) return false;
            seen.add(tag);
            return true;
        })
        .slice(0, 12);
}
