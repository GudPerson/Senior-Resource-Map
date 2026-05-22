import { normalizeRole } from './roles.js';

export function formatHardAssetListSummary(asset, options = {}) {
    const membershipSummary = options.membershipSummary || {};
    const partnerRole = asset?.partner?.role ? normalizeRole(asset.partner.role) : null;

    return {
        id: asset.id,
        name: asset.name,
        address: asset.address,
        postalCode: asset.postalCode,
        subCategory: asset.subCategory,
        logoUrl: asset.logoUrl || null,
        isHidden: asset.isHidden || false,
        hideFrom: asset.hideFrom || null,
        hideUntil: asset.hideUntil || null,
        lastReviewedAt: asset.lastReviewedAt || null,
        lastVerifiedByUserId: asset.lastVerifiedByUserId || null,
        sourceType: asset.sourceType || null,
        verificationStatus: asset.verificationStatus || 'unverified',
        verificationConfidence: asset.verificationConfidence || null,
        partnerId: asset.partnerId || null,
        partnerName: asset.partner?.name || null,
        partnerRole,
        ownershipMode: asset.partnerId ? 'partner' : 'system',
        tags: Array.isArray(options.tags) ? options.tags : [],
        boundaryStatus: options.boundaryStatus || 'no-boundary',
        matchingRegionIds: Array.isArray(asset.matchingRegionIds) ? asset.matchingRegionIds : [],
        primaryRegionId: asset.subregionId || null,
        organizationLinks: Array.isArray(options.organizationLinks) ? options.organizationLinks : [],
        permissions: options.permissions || {
            canEdit: false,
            canManageAccess: false,
            canDelete: false,
            canHide: false,
        },
        ...membershipSummary,
    };
}
