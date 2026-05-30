import { hasHardAssetStaffAccess } from './hardAssetStaff.js';
import { hasPartnerStaffAccess } from './partnerStaff.js';
import { actorMatchesAnyRegion, filterSoftAssetsByRegionRelevance } from './regionScope.js';
import { normalizeRole } from './roles.js';

export function normalizeResourceListScope(value) {
    return String(value || '').trim().toLowerCase() === 'managed' ? 'managed' : 'visible';
}

export function shouldRejectManagedResourceListRequest(scopeValue, actor) {
    return normalizeResourceListScope(scopeValue) === 'managed'
        && normalizeRole(actor?.role) === 'guest';
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

function canSeeManagedHardAsset(asset, actor, isVisible) {
    const actorRole = normalizeRole(actor?.role);
    if (actorRole === 'super_admin') return true;
    if (hasHardAssetStaffAccess(actor, asset?.id, ['owner', 'staff'])) return true;
    if (actorRole === 'regional_admin') return isVisible(asset);
    if (actorRole === 'partner' && Number(asset?.partnerId) === Number(actor?.id)) return true;
    if (hasPartnerStaffAccess(actor, asset?.partnerId, ['owner', 'editor'])) return true;
    return false;
}

function canSeeRegionScopedManagedHardAsset(asset, actor) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    if (hasHardAssetStaffAccess(actor, asset?.id, ['owner', 'staff'])) return true;
    return actorMatchesAnyRegion(actor, [
        ...(Array.isArray(asset?.matchingRegionIds) ? asset.matchingRegionIds : []),
        asset?.subregionId,
    ]);
}

export function filterHardAssetsForResourceList(assets = [], actor, options = {}) {
    const scope = normalizeResourceListScope(options.scope);
    const isVisible = typeof options.isVisible === 'function' ? options.isVisible : () => true;
    const regionScoped = options.regionScoped === true;

    if (scope === 'managed') {
        return assets.filter((asset) => (
            canSeeManagedHardAsset(asset, actor, isVisible)
            && (!regionScoped || canSeeRegionScopedManagedHardAsset(asset, actor))
        ));
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
