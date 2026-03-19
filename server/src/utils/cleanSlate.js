import {
    audienceZonePostalCodes,
    audienceZones,
    hardAssetTags,
    hardAssets,
    partnerPostalCodes,
    softAssetAudienceZones,
    softAssetLocations,
    softAssetParentAudienceZones,
    softAssetParents,
    softAssetTags,
    softAssets,
    subCategories,
    subregionPostalCodes,
    subregions,
    tags,
    userFavorites,
    userSubregions,
    users,
} from '../db/schema.js';

export const CLEAN_SLATE_TABLES = [
    { key: 'users', label: 'Users', table: users },
    { key: 'userSubregions', label: 'User subregions', table: userSubregions },
    { key: 'subregions', label: 'Subregions', table: subregions },
    { key: 'subregionPostalCodes', label: 'Subregion postal codes', table: subregionPostalCodes },
    { key: 'partnerPostalCodes', label: 'Partner postal codes', table: partnerPostalCodes },
    { key: 'audienceZones', label: 'Audience zones', table: audienceZones },
    { key: 'audienceZonePostalCodes', label: 'Audience-zone postal codes', table: audienceZonePostalCodes },
    { key: 'subCategories', label: 'Subcategories', table: subCategories },
    { key: 'tags', label: 'Tags', table: tags },
    { key: 'userFavorites', label: 'User favorites', table: userFavorites },
    { key: 'hardAssetTags', label: 'Hard-asset tags', table: hardAssetTags },
    { key: 'softAssetTags', label: 'Soft-asset tags', table: softAssetTags },
    { key: 'softAssetLocations', label: 'Soft-asset locations', table: softAssetLocations },
    { key: 'softAssetAudienceZones', label: 'Soft-asset audience zones', table: softAssetAudienceZones },
    { key: 'softAssetParentAudienceZones', label: 'Template audience zones', table: softAssetParentAudienceZones },
    { key: 'softAssets', label: 'Soft assets', table: softAssets },
    { key: 'softAssetParents', label: 'Soft-asset templates', table: softAssetParents },
    { key: 'hardAssets', label: 'Hard assets', table: hardAssets },
];

const TABLE_BY_KEY = new Map(CLEAN_SLATE_TABLES.map((entry) => [entry.key, entry]));

const DEFAULT_RESET_KEYS = [
    'userFavorites',
    'softAssetAudienceZones',
    'softAssetParentAudienceZones',
    'softAssetLocations',
    'softAssetTags',
    'hardAssetTags',
    'softAssets',
    'softAssetParents',
    'hardAssets',
    'tags',
];

const OPTIONAL_RESET_KEYS = {
    includeAudienceZones: ['audienceZonePostalCodes', 'audienceZones'],
    includePartnerBoundaries: ['partnerPostalCodes'],
    includeSubregionPostcodes: ['subregionPostalCodes'],
    includeSubcategories: ['subCategories'],
};

function appendUnique(target, values) {
    for (const value of values) {
        if (!target.includes(value)) target.push(value);
    }
    return target;
}

export function parseCleanSlateFlags(argv = process.argv.slice(2)) {
    return {
        apply: argv.includes('--apply'),
        includeAudienceZones: argv.includes('--include-audience-zones'),
        includePartnerBoundaries: argv.includes('--include-partner-boundaries'),
        includeSubregionPostcodes: argv.includes('--include-subregion-postcodes'),
        includeSubcategories: argv.includes('--include-subcategories'),
        json: argv.includes('--json'),
    };
}

export function buildCleanSlatePlan(options = {}) {
    const resetKeys = [...DEFAULT_RESET_KEYS];

    for (const [flag, keys] of Object.entries(OPTIONAL_RESET_KEYS)) {
        if (options[flag]) appendUnique(resetKeys, keys);
    }

    const reset = resetKeys.map((key) => TABLE_BY_KEY.get(key)).filter(Boolean);
    const resetSet = new Set(reset.map((entry) => entry.key));
    const preserve = CLEAN_SLATE_TABLES.filter((entry) => !resetSet.has(entry.key));

    return {
        options: {
            includeAudienceZones: Boolean(options.includeAudienceZones),
            includePartnerBoundaries: Boolean(options.includePartnerBoundaries),
            includeSubregionPostcodes: Boolean(options.includeSubregionPostcodes),
            includeSubcategories: Boolean(options.includeSubcategories),
        },
        reset,
        preserve,
    };
}

export function summarizeCleanSlatePlan(plan) {
    return {
        reset: plan.reset.map((entry) => entry.key),
        preserve: plan.preserve.map((entry) => entry.key),
    };
}
