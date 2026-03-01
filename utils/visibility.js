export function isAssetVisible(asset, user) {
    if (asset.isDeleted) return false;

    // Admin always sees everything
    if (user?.role === 'admin') return true;

    // Partner (owner) always sees their own assets
    if (user && user.id === asset.partnerId) return true;

    // Member-only check
    if (asset.isMemberOnly && !user) return false;

    // Manually hidden
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
