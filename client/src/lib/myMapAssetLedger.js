import { getRowAssetKey } from './mapNotes.js';
import { normalizeMapShortDescriptorItems } from './mapShortDescriptorStyle.js';
import { buildMyMapCategoryRank, normalizeMyMapCategoryKey } from './myMapCategoryOrder.js';

const TEXT_COMPARE_OPTIONS = { sensitivity: 'base', numeric: true };

function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function compareText(left, right, locale) {
    return cleanText(left).localeCompare(cleanText(right), locale, TEXT_COMPARE_OPTIONS);
}

function getCategory(row) {
    return cleanText(row?.subCategory)
        || cleanText(row?.bucket)
        || (row?.resourceType === 'personal_place' ? 'Personal places' : 'Uncategorized');
}

function getAddress(row, place) {
    return cleanText(row?.address)
        || cleanText(place?.address)
        || cleanText(row?.locationLabel)
        || cleanText(place?.name)
        || 'Address unavailable';
}

function getPostalCode(row, place, group) {
    return cleanText(row?.postalCode)
        || cleanText(place?.postalCode)
        || cleanText(group?.postalCode);
}

function getMapNumber(
    row,
    group,
    place,
    presentation,
    mapNumberPresentation,
    hiddenPlaceKeySet,
) {
    const placeKeys = [row?.placeKey, place?.placeKey, group?.placeKey]
        .map((value) => cleanText(value))
        .filter(Boolean);
    if (placeKeys.some((placeKey) => hiddenPlaceKeySet.has(placeKey))) return 'Hidden';

    const candidates = [
        ...placeKeys.map((placeKey) => mapNumberPresentation?.placeNumberByKey?.[placeKey]),
        row?.sourceMapNumber,
        row?.mapNumber,
        row?.number,
        place?.sourceMapNumber,
        place?.mapNumber,
        place?.number,
        group?.sourceMapNumber,
        group?.mapNumber,
        group?.number,
        presentation?.placeNumberByKey?.[row?.placeKey],
        presentation?.placeNumberByKey?.[place?.placeKey],
        presentation?.placeNumberByKey?.[group?.placeKey],
        presentation?.mapNumberByAssetKey?.[getRowAssetKey(row)],
    ];
    return candidates.map(cleanText).find(Boolean) || 'List only';
}

function collectRows(presentation) {
    const entries = [];
    for (const group of presentation?.mappedGroups || []) {
        for (const row of group?.rows || []) entries.push({ row, group, place: group, mapped: true });
        for (const place of group?.nestedPlaces || []) {
            for (const row of place?.rows || []) entries.push({ row, group, place, mapped: true });
        }
    }
    for (const row of presentation?.unmappedRows || []) {
        entries.push({ row, group: null, place: null, mapped: false });
    }
    return entries;
}

function buildAsset(entry, presentation, mapNumberPresentation, hiddenPlaceKeySet) {
    const { row, group, place, mapped } = entry;
    return {
        assetKey: getRowAssetKey(row),
        resourceType: cleanText(row?.resourceType),
        resourceId: row?.resourceId ?? null,
        name: cleanText(row?.name) || 'Unnamed resource',
        bucket: cleanText(row?.bucket),
        subCategory: cleanText(row?.subCategory),
        logoUrl: cleanText(row?.logoUrl),
        category: getCategory(row),
        address: getAddress(row, place),
        postalCode: getPostalCode(row, place, group),
        sourceMapNumber: mapped
            ? getMapNumber(
                row,
                group,
                place,
                presentation,
                mapNumberPresentation,
                hiddenPlaceKeySet,
            )
            : 'List only',
        placeKey: cleanText(row?.placeKey || place?.placeKey || group?.placeKey),
        categoryColor: cleanText(row?.categoryColor || group?.categoryColor),
        descriptions: normalizeMapShortDescriptorItems(row).map((item) => ({
            text: cleanText(item.text),
            textColor: item.textColor,
            highlightColor: item.highlightColor,
            sortOrder: item.sortOrder,
        })),
        isPersonalPlace: row?.resourceType === 'personal_place' || Boolean(row?.isPersonalPlace),
    };
}

export function buildMyMapAssetLedger({
    directory,
    presentation,
    mapNumberPresentation = presentation,
    hiddenPlaceKeys = [],
    locale = 'en-SG',
} = {}) {
    const hiddenPlaceKeySet = new Set(
        (Array.isArray(hiddenPlaceKeys) ? hiddenPlaceKeys : [])
            .map((value) => cleanText(value))
            .filter(Boolean),
    );
    const assetsByKey = new Map();
    for (const entry of collectRows(presentation)) {
        const key = getRowAssetKey(entry.row);
        if (!key || assetsByKey.has(key)) continue;
        assetsByKey.set(key, buildAsset(
            entry,
            presentation,
            mapNumberPresentation,
            hiddenPlaceKeySet,
        ));
    }

    const assets = [...assetsByKey.values()];
    const categoriesByName = new Map();
    for (const asset of assets) {
        if (!categoriesByName.has(asset.category)) categoriesByName.set(asset.category, []);
        categoriesByName.get(asset.category).push(asset);
    }
    const categoryRank = buildMyMapCategoryRank(directory?.categoryOrder);
    const categories = [...categoriesByName.entries()]
        .map(([name, categoryAssets]) => ({
            name,
            assets: categoryAssets.sort((left, right) => (
                compareText(left.sourceMapNumber, right.sourceMapNumber, locale)
                || compareText(left.name, right.name, locale)
            )),
        }))
        .sort((left, right) => {
            const leftRank = categoryRank.get(normalizeMyMapCategoryKey(left.name));
            const rightRank = categoryRank.get(normalizeMyMapCategoryKey(right.name));
            const leftHasRank = Number.isInteger(leftRank);
            const rightHasRank = Number.isInteger(rightRank);
            if (leftHasRank !== rightHasRank) return leftHasRank ? -1 : 1;
            if (leftHasRank && leftRank !== rightRank) return leftRank - rightRank;
            return compareText(left.name, right.name, locale);
        });

    return {
        mapName: cleanText(directory?.name || directory?.mapName || presentation?.mapName) || 'CareAround map',
        assets,
        categories,
        summary: {
            assetCount: assets.length,
            categoryCount: categories.length,
            personalPlaceCount: assets.filter((asset) => asset.isPersonalPlace).length,
            descriptionCount: assets.reduce((count, asset) => count + asset.descriptions.length, 0),
        },
    };
}

export function toSafeExcelText(value) {
    const text = String(value ?? '');
    return /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
}

function getAssetTypeLabel(asset) {
    if (asset.isPersonalPlace) return 'Personal place';
    if (asset.resourceType === 'hard') return 'Place';
    if (asset.resourceType === 'soft') return 'Offering';
    return cleanText(asset.resourceType) || 'Resource';
}

export function buildMyMapAssetWorkbookRows(ledger) {
    const assets = ledger.assets.map((asset) => ({
        'Map no.': toSafeExcelText(asset.sourceMapNumber),
        'Resource name': toSafeExcelText(asset.name),
        Category: toSafeExcelText(asset.category),
        Address: toSafeExcelText(asset.address),
        'Postal code': toSafeExcelText(asset.postalCode),
        Type: toSafeExcelText(getAssetTypeLabel(asset)),
        'Description count': asset.descriptions.length,
        Descriptions: asset.descriptions
            .map((description) => toSafeExcelText(description.text))
            .join('\n'),
        'Description text colours': asset.descriptions
            .map((description) => toSafeExcelText(description.textColor || ''))
            .join('\n'),
        'Description highlight colours': asset.descriptions
            .map((description) => toSafeExcelText(description.highlightColor || ''))
            .join('\n'),
    }));
    return { assets };
}
