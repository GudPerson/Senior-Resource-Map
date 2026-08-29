import {
    PRINT_MAP_LABEL_DETAIL_FULL,
    PRINT_MAP_LABEL_DETAIL_LOGOS,
    PRINT_MAP_LABEL_DETAIL_NAMES,
    PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES,
    PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS,
    normalizePrintMapLabelDetail,
    splitPrintResourceGroups,
} from './printMapState.js';

export function getMyMapResourceTableDetailVisibility(labelDetail) {
    const normalizedLabelDetail = normalizePrintMapLabelDetail(labelDetail);

    return {
        labelDetail: normalizedLabelDetail,
        compact: normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_NAMES,
        showLogo: normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_LOGOS
            || normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL,
        showAddress: normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES
            || normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL,
        showDescriptions: normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS
            || normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL,
        showPersonalPlaceLabel: normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL,
    };
}

export function normalizeMyMapResourceTableColumnCount(value) {
    const count = Number(value);
    return Number.isInteger(count) && count >= 1 && count <= 6 ? count : 1;
}

export function splitMyMapResourceTableCategories(categories = [], requestedColumnCount = 1) {
    const normalizedCategories = Array.isArray(categories) ? categories : [];
    const columnCount = normalizeMyMapResourceTableColumnCount(requestedColumnCount);
    if (columnCount === 1) return [normalizedCategories];

    const weightedCategories = normalizedCategories.map((category) => ({
        category,
        categorySortKey: category?.name,
        rows: Array.isArray(category?.assets) ? category.assets : [],
    }));

    return splitPrintResourceGroups(weightedCategories, columnCount)
        .map((column) => column.map((entry) => entry.category));
}
