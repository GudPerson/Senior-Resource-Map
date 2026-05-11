import { normalizeRole } from './roles.js';
import { getActivePartnerStaffAccess, hasPartnerStaffAccess } from './partnerStaff.js';

export function getDirectManagerRole(childRole) {
    switch (normalizeRole(childRole)) {
        case 'regional_admin':
            return 'super_admin';
        case 'partner':
            return 'regional_admin';
        case 'standard':
            return 'partner';
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

export function actorCanManageAsset(actor, asset, ownerUser) {
    const actorRole = normalizeRole(actor?.role);

    if (!actor || !asset) return false;
    if (actorRole === 'super_admin') return true;

    if (actorRole === 'partner') {
        return asset.partnerId === actor.id;
    }

    if (hasPartnerStaffAccess(actor, asset.partnerId)) {
        return true;
    }

    if (actorRole === 'regional_admin') {
        const inScope = Array.isArray(actor.subregionIds) && actor.subregionIds.includes(asset.subregionId);
        if (!inScope) return false;
        if (!asset.partnerId) return true;
        return ownerUser?.id === asset.partnerId && ownerUser?.managerUserId === actor.id;
    }

    return false;
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
