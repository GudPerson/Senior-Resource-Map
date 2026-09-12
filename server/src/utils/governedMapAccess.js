import { normalizeRole } from './roles.js';

function toId(value) {
    const id = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function activeEntries(value) {
    return Array.isArray(value) ? value.filter((entry) => !entry?.revokedAt) : [];
}

function organizationIdsForResource(resource = {}) {
    const values = [
        ...(Array.isArray(resource.organizationIds) ? resource.organizationIds : []),
        resource.organizationIdAtAdd,
    ];
    return new Set(values.map(toId).filter(Boolean));
}

function hasOrganizationAdminAccess(user, organizationIds) {
    if (organizationIds.size === 0) return false;
    return activeEntries(user?.organizationAccess).some((entry) => (
        organizationIds.has(toId(entry?.organizationId))
        && String(entry?.accessRole || '').trim().toLowerCase() === 'admin'
    ));
}

function hasLegacyOrganizationStewardship(user, organizationIds) {
    if (organizationIds.size === 0) return false;
    return activeEntries(user?.partnerStaffAccess).some((entry) => (
        organizationIds.has(toId(entry?.organizationId))
    ));
}

function hasDirectResourceStaffAccess(user, resource) {
    const resourceId = toId(resource?.resourceId);
    if (!resourceId) return false;
    if (resource?.resourceType === 'hard') {
        return activeEntries(user?.hardAssetStaffAccess)
            .some((entry) => toId(entry?.hardAssetId) === resourceId);
    }
    if (resource?.resourceType === 'soft') {
        return activeEntries(user?.softAssetStaffAccess)
            .some((entry) => toId(entry?.softAssetId) === resourceId);
    }
    return false;
}

export function canStewardGovernedResource(user, resource) {
    if (normalizeRole(user?.role) === 'super_admin') return true;
    if (hasDirectResourceStaffAccess(user, resource)) return true;
    const organizationIds = organizationIdsForResource(resource);
    return hasOrganizationAdminAccess(user, organizationIds)
        || hasLegacyOrganizationStewardship(user, organizationIds);
}

export function canParticipateInGovernedRegion(user, organizationIds = []) {
    if (normalizeRole(user?.role) === 'super_admin') return true;
    const regionOrganizationIds = new Set(organizationIds.map(toId).filter(Boolean));
    return hasOrganizationAdminAccess(user, regionOrganizationIds)
        || hasLegacyOrganizationStewardship(user, regionOrganizationIds);
}

export function deriveGovernedMapCapabilities({
    user,
    regionOrganizationIds = [],
    resources = [],
    candidateResources = [],
    lifecycleStatus = 'draft',
} = {}) {
    const isArchived = lifecycleStatus === 'archived';
    const isRetirementPending = lifecycleStatus === 'retirement_pending';
    const regionParticipant = canParticipateInGovernedRegion(user, regionOrganizationIds);
    const includedSteward = resources.some((resource) => canStewardGovernedResource(user, resource));
    const candidateSteward = candidateResources.some((resource) => canStewardGovernedResource(user, resource));
    const participant = regionParticipant || includedSteward;
    const canMutate = participant && !isArchived && !isRetirementPending;

    return {
        canView: participant,
        canCreate: !isArchived && (regionParticipant || candidateSteward),
        canEditMetadata: canMutate,
        canAddResource: canMutate,
        canPublish: canMutate && resources.length > 0,
        canRequestRetirement: lifecycleStatus === 'published' && includedSteward,
        canRestore: isRetirementPending && includedSteward,
        canArchive: normalizeRole(user?.role) === 'super_admin' && isRetirementPending,
        removableResourceKeys: resources
            .filter((resource) => !isArchived && canStewardGovernedResource(user, resource))
            .map((resource) => `${resource.resourceType}:${resource.resourceId}`),
    };
}
