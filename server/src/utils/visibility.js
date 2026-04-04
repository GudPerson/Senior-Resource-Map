import { normalizeRole } from './roles.js';
import { getAssetAudienceZoneIds } from './audienceZones.js';

export function isAssetVisible(asset, user, options = {}) {
    if (asset.isDeleted) return false;
    const role = normalizeRole(user?.role);
    const ownerPartner = options.ownerPartner || null;
    const treatMemberOnlyAsVisible = Boolean(options.treatMemberOnlyAsVisible);
    const allowedPartnerAudienceIds = options.allowedPartnerAudienceIds instanceof Set
        ? options.allowedPartnerAudienceIds
        : new Set();
    const allowedAudienceZoneIds = options.allowedAudienceZoneIds instanceof Set
        ? options.allowedAudienceZoneIds
        : new Set();

    // super_admin always sees everything
    if (role === 'super_admin') return true;

    const isPartnerBoundaryAsset = asset.audienceMode === 'partner_boundary';
    const isAudienceZoneAsset = asset.audienceMode === 'audience_zones';

    if (role === 'regional_admin' && user?.subregionIds?.includes(asset.subregionId)) {
        if (!isPartnerBoundaryAsset) return true;
        return !asset.partnerId || ownerPartner?.managerUserId === user.id;
    }

    if (user && user.id === asset.partnerId) return true;

    if (asset.isMemberOnly && (!user || role === 'guest') && !treatMemberOnlyAsVisible) {
        return false;
    }

    if (isPartnerBoundaryAsset) {
        if (!user || role === 'guest') return false;
        if (role !== 'standard') return false;
        if (!(user.managerUserId === asset.partnerId && allowedPartnerAudienceIds.has(asset.partnerId))) {
            return false;
        }
    }

    if (isAudienceZoneAsset) {
        if (!user || role === 'guest') return false;
        const audienceZoneIds = getAssetAudienceZoneIds(asset);
        if (audienceZoneIds.length === 0) return false;
        if (!audienceZoneIds.some((zoneId) => allowedAudienceZoneIds.has(zoneId))) {
            return false;
        }
    }

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
