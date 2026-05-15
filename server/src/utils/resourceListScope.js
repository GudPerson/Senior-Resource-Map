import {
    filterHardAssetsByRegionRelevance,
    filterSoftAssetsByRegionRelevance,
} from './regionScope.js';

export function normalizeResourceListScope(value) {
    return String(value || '').trim().toLowerCase() === 'managed' ? 'managed' : 'visible';
}

export function normalizeResourceListPagination(input = {}) {
    const page = Math.max(1, Number.parseInt(input.page || '1', 10) || 1);
    const pageSize = Math.min(500, Math.max(1, Number.parseInt(input.pageSize || '50', 10) || 50));
    return { page, pageSize };
}

export function paginateResourceList(items = [], input = {}) {
    const { page, pageSize } = normalizeResourceListPagination(input);
    const data = Array.isArray(items) ? items : [];
    const totalCount = data.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const start = (page - 1) * pageSize;

    return {
        data: data.slice(start, start + pageSize),
        pagination: {
            totalCount,
            page,
            pageSize,
            totalPages,
        },
    };
}

export function filterHardAssetsForResourceList(assets = [], actor, options = {}) {
    const scope = normalizeResourceListScope(options.scope);
    const isVisible = typeof options.isVisible === 'function' ? options.isVisible : () => true;

    if (scope === 'managed') {
        return filterHardAssetsByRegionRelevance(assets, actor);
    }

    return assets.filter((asset) => isVisible(asset));
}

export function filterSoftAssetsForResourceList(assets = [], actor, options = {}) {
    const scope = normalizeResourceListScope(options.scope);
    const isVisible = typeof options.isVisible === 'function' ? options.isVisible : () => true;
    const canExpose = typeof options.canExpose === 'function' ? options.canExpose : () => true;

    if (scope === 'managed') {
        return filterSoftAssetsByRegionRelevance(assets, actor);
    }

    return assets.filter((asset) => isVisible(asset) && canExpose(asset));
}
