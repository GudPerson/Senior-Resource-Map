import { normalizeRole } from './roles.js';

export function isAssetVisible(asset, user, options = {}) {
    if (asset.isDeleted) return false;
    const role = normalizeRole(user?.role);
    const ownerPartner = options.ownerPartner || null;
    const allowedPartnerAudienceIds = options.allowedPartnerAudienceIds instanceof Set
        ? options.allowedPartnerAudienceIds
        : new Set();

    // super_admin always sees everything
    if (role === 'super_admin') return true;

    const isPartnerBoundaryAsset = asset.audienceMode === 'partner_boundary';

    if (role === 'regional_admin' && user?.subregionIds?.includes(asset.subregionId)) {
        if (!isPartnerBoundaryAsset) return true;
        return !asset.partnerId || ownerPartner?.managerUserId === user.id;
    }

    if (user && user.id === asset.partnerId) return true;

    if (isPartnerBoundaryAsset) {
        if (!user || role === 'guest') return false;
        if (role === 'standard') {
            return user.managerUserId === asset.partnerId && allowedPartnerAudienceIds.has(asset.partnerId);
        }
        return false;
    }

    // Member-only check
    if (asset.isMemberOnly && (!user || role === 'guest')) return false;

    // Manually hidden (unless you are owner/admin)
    if (asset.isHidden) return false;

    // Scheduled hiding
    const now = new Date();
    const from = asset.hideFrom ? new Date(asset.hideFrom) : null;
    const until = asset.hideUntil ? new Date(asset.hideUntil) : null;

    if (from && until) {
        if (now >= from && now <= until) return false;
    } else if (from && now >= from) {
        return false;
    } else if (until && now <= until) {
        return false;
    }

    return true;
}
