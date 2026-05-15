import { normalizeRole } from './roles.js';
import { getActivePartnerStaffAccess, hasPartnerStaffAccess } from './partnerStaff.js';
import { hasHardAssetStaffAccess } from './hardAssetStaff.js';
import { hasSoftAssetStaffAccess } from './softAssetAccess.js';

export function getDirectManagerRole(childRole) {
    switch (normalizeRole(childRole)) {
        case 'regional_admin':
            return 'super_admin';
        case 'standard':
            return 'regional_admin';
        default:
            return null;
    }
}

export function canRoleOwnUser(managerRole, childRole) {
    const normalizedManager = normalizeRole(managerRole);
    const normalizedChild = normalizeRole(childRole);

    if (normalizedManager === 'super_admin') {
        return normalizedChild !== 'guest';
    }

    return getDirectManagerRole(normalizedChild) === normalizedManager;
}

export function getOwnershipStatus(user) {
    const role = normalizeRole(user?.role);
    if (role === 'super_admin') return 'assigned';
    if (!user?.managerUserId) return 'unassigned';
    if (!canRoleOwnUser(user.managerRole, role)) return 'invalid';
    return 'assigned';
}

export function canDirectlyManageUser(actor, targetUser) {
    const actorRole = normalizeRole(actor?.role);
    const targetRole = normalizeRole(targetUser?.role);

    if (!actor || !targetUser) return false;
    if (actor.id === targetUser.id) return false;

    if (actorRole === 'super_admin') return targetRole !== 'guest';

    return targetUser.managerUserId === actor.id && canRoleOwnUser(actorRole, targetRole);
}

function isLikelyHardAsset(entity) {
    if (!entity) return false;
    if (entity.resourceType === 'hard') return true;
    if (entity.resourceType === 'soft') return false;
    if (entity.hostHardAssetId || entity.parentSoftAssetId || entity.assetMode || Object.prototype.hasOwnProperty.call(entity, 'audienceMode')) return false;
    return Object.prototype.hasOwnProperty.call(entity, 'country')
        || Object.prototype.hasOwnProperty.call(entity, 'address')
        || Object.prototype.hasOwnProperty.call(entity, 'postalCode')
        || (Object.prototype.hasOwnProperty.call(entity, 'id') && Object.prototype.hasOwnProperty.call(entity, 'subregionId'));
}

export function getHardAssetScopeIds(entity) {
    const ids = new Set();
    const add = (value) => {
        const parsed = Number.parseInt(String(value ?? ''), 10);
        if (Number.isInteger(parsed)) ids.add(parsed);
    };

    if (!entity) return [];
    if (isLikelyHardAsset(entity)) add(entity.id);

    add(entity.hostHardAssetId);
    add(entity.hostHardAsset?.id);

    for (const entry of entity.locations || []) {
        add(entry?.hardAssetId);
        add(entry?.hardAsset?.id);
    }

    return [...ids];
}

export function actorHasHardAssetStaffAccess(actor, entity, allowedRoles = ['owner', 'staff']) {
    return getHardAssetScopeIds(entity)
        .some((hardAssetId) => hasHardAssetStaffAccess(actor, hardAssetId, allowedRoles));
}

export function actorCanManageAsset(actor, asset, ownerUser) {
    const actorRole = normalizeRole(actor?.role);

    if (!actor || !asset) return false;
    if (actorRole === 'super_admin') return true;

    if (actorHasHardAssetStaffAccess(actor, asset, ['owner', 'staff'])) {
        return true;
    }

    if (!isLikelyHardAsset(asset) && hasSoftAssetStaffAccess(actor, asset.id, ['owner', 'staff'])) {
        return true;
    }

    return false;
}

export function actorCanHideHardAsset(actor, asset, ownerUser) {
    if (!actor || !asset) return false;
    const actorRole = normalizeRole(actor?.role);
    if (actorRole === 'super_admin') return true;
    return hasHardAssetStaffAccess(actor, asset.id, ['owner']);
}

export function actorCanDeleteHardAsset(actor, asset, ownerUser) {
    if (!actor || !asset) return false;
    const actorRole = normalizeRole(actor?.role);
    if (actorRole === 'super_admin') return true;
    return hasHardAssetStaffAccess(actor, asset.id, ['owner']);
}

export function actorCanManagePartnerOwnedEntity(actor, entity, ownerUser) {
    const actorRole = normalizeRole(actor?.role);
    const partnerId = entity?.partnerId ?? entity?.partnerUserId ?? null;

    if (!actor || !entity) return false;
    if (actorRole === 'super_admin') return true;

    if (actorRole === 'partner') {
        return Number(partnerId) === Number(actor.id);
    }

    if (hasPartnerStaffAccess(actor, partnerId)) {
        return true;
    }

    if (actorRole === 'regional_admin') {
        if (partnerId) {
            return Number(ownerUser?.id) === Number(partnerId)
                && Number(ownerUser?.managerUserId) === Number(actor.id);
        }

        return Number(entity.createdByUserId) === Number(actor.id);
    }

    return false;
}

export function canAssignPartnerOwner(actor, partnerUser, subregionId = null) {
    const actorRole = normalizeRole(actor?.role);
    if (!partnerUser || normalizeRole(partnerUser.role) !== 'partner') return false;

    if (actorRole === 'super_admin') {
        if (!subregionId) return true;
        return Array.isArray(partnerUser.subregionIds) && partnerUser.subregionIds.includes(subregionId);
    }

    if (actorRole === 'regional_admin') {
        const inHierarchy = partnerUser.managerUserId === actor.id;
        const inActorScope = !subregionId || (Array.isArray(actor.subregionIds) && actor.subregionIds.includes(subregionId));
        const inPartnerScope = !subregionId || (Array.isArray(partnerUser.subregionIds) && partnerUser.subregionIds.includes(subregionId));
        return inHierarchy && inActorScope && inPartnerScope;
    }

    if (actorRole === 'partner') {
        return partnerUser.id === actor.id && (!subregionId || actor.subregionIds?.includes(subregionId));
    }

    const matchingStaffAccess = getActivePartnerStaffAccess(actor)
        .find((entry) => Number(entry.legacyPartnerUserId) === Number(partnerUser.id));
    if (matchingStaffAccess) {
        return !subregionId || matchingStaffAccess.subregionIds?.includes(subregionId);
    }

    return false;
}
