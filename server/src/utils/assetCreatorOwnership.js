import { normalizeRole } from './roles.js';

export function shouldGrantCreatorDefaultHardAssetOwner(actor) {
    return normalizeRole(actor?.role) === 'regional_admin';
}

export function shouldGrantCreatorDefaultSoftAssetOwner(actor, { linkedHardAssetIds = [], hostHardAssetId = null } = {}) {
    return normalizeRole(actor?.role) === 'regional_admin'
        && !Number(hostHardAssetId)
        && (!Array.isArray(linkedHardAssetIds) || linkedHardAssetIds.length === 0);
}
