import { canManageOrganizationGovernance, normalizeOrganizationAccessRole } from './governance.js';
import { normalizeRole } from './roles.js';

const GROUP_TYPES = new Map([
    ['org', 'org'],
    ['organisation', 'org'],
    ['organization', 'org'],
    ['org_group', 'org'],
    ['region', 'region'],
    ['regional', 'region'],
    ['region_group', 'region'],
    ['iccp', 'region'],
    ['iccp_sr', 'region'],
]);

function normalizeValue(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function isActiveRow(row) {
    return row && !row.revokedAt && !row.unlinkedAt && !row.removedAt;
}

function numericId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function groupId(group) {
    return numericId(group?.id);
}

function actorId(actor) {
    return numericId(actor?.id);
}

function organizationForGroup(group) {
    const organization = group?.organization;
    if (organization?.id) return organization;

    const organizationId = numericId(group?.organizationId);
    return organizationId ? { id: organizationId } : null;
}

function findActiveGroupMembership(actor, group, memberships = []) {
    const userId = actorId(actor);
    const targetGroupId = groupId(group);
    if (!userId || !targetGroupId) return null;

    return (memberships || []).find((membership) => (
        numericId(membership?.groupId) === targetGroupId
        && numericId(membership?.userId) === userId
        && isActiveRow(membership)
        && normalizeGovernanceGroupRole(membership?.groupRole)
    )) || null;
}

function canAssignGroupAdminRole(actor, group, organizationAccessRows = []) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    if (normalizeGovernanceGroupType(group?.groupType || group?.type) !== 'org') return false;

    const organization = organizationForGroup(group);
    return Boolean(organization && canManageOrganizationGovernance(actor, organization, organizationAccessRows));
}

export function normalizeGovernanceGroupType(value) {
    return GROUP_TYPES.get(normalizeValue(value)) || null;
}

export function normalizeGovernanceGroupRole(value) {
    return normalizeOrganizationAccessRole(value);
}

export function governanceGroupRolesGrantResourceEditRights() {
    return false;
}

export function governanceGroupRolesGrantRestrictedContentAccess() {
    return false;
}

export function canCreateGovernanceGroup(actor, {
    groupType,
    organization = null,
    organizationAccessRows = [],
} = {}) {
    const normalizedGroupType = normalizeGovernanceGroupType(groupType);
    if (!normalizedGroupType) {
        return { allowed: false, reason: 'Governance group type is invalid.' };
    }

    if (normalizeRole(actor?.role) === 'super_admin') {
        return { allowed: true, reason: null };
    }

    if (normalizedGroupType === 'region') {
        return {
            allowed: false,
            reason: 'Region Groups can be created by Super Admin accounts only.',
        };
    }

    if (!organization?.id) {
        return {
            allowed: false,
            reason: 'Choose an organisation before creating an Org Group.',
        };
    }

    if (canManageOrganizationGovernance(actor, organization, organizationAccessRows)) {
        return { allowed: true, reason: null };
    }

    return {
        allowed: false,
        reason: 'Create Org Groups as an Organisation Admin or Super Admin.',
    };
}

export function canManageGovernanceGroup(
    actor,
    group,
    groupMemberships = [],
    organizationAccessRows = [],
) {
    const normalizedGroupType = normalizeGovernanceGroupType(group?.groupType || group?.type);
    if (!normalizedGroupType || !groupId(group)) {
        return { allowed: false, reason: 'Governance group is invalid.' };
    }

    if (normalizeRole(actor?.role) === 'super_admin') {
        return { allowed: true, reason: null };
    }

    if (normalizedGroupType === 'org') {
        const organization = organizationForGroup(group);
        if (organization && canManageOrganizationGovernance(actor, organization, organizationAccessRows)) {
            return { allowed: true, reason: null };
        }
    }

    const membership = findActiveGroupMembership(actor, group, groupMemberships);
    const groupRole = normalizeGovernanceGroupRole(membership?.groupRole);
    if (groupRole === 'admin') {
        return { allowed: true, reason: null };
    }

    if (groupRole === 'staff') {
        return {
            allowed: false,
            reason: 'Group Staff can view coordination context but cannot manage this group.',
        };
    }

    return {
        allowed: false,
        reason: 'Governance group management is outside your access.',
    };
}

export function canManageGovernanceGroupMemberRole(
    actor,
    group,
    groupMemberships = [],
    organizationAccessRows = [],
    targetRole,
) {
    const normalizedTargetRole = normalizeGovernanceGroupRole(targetRole);
    if (!normalizedTargetRole) {
        return { allowed: false, reason: 'Governance group member role is invalid.' };
    }

    if (canAssignGroupAdminRole(actor, group, organizationAccessRows)) {
        return { allowed: true, reason: null };
    }

    if (normalizedTargetRole === 'admin') {
        const normalizedGroupType = normalizeGovernanceGroupType(group?.groupType || group?.type);
        return {
            allowed: false,
            reason: normalizedGroupType === 'region'
                ? 'Only a Super Admin can assign Region Group Admin.'
                : 'Only an Organisation Admin or Super Admin can assign group Admin.',
        };
    }

    return canManageGovernanceGroup(actor, group, groupMemberships, organizationAccessRows);
}

export function filterExistingOrganizationUsersForOrgGroup(candidates = [], organizationAccessRows = []) {
    const activeOrganizationUserIds = new Set((organizationAccessRows || [])
        .filter((row) => isActiveRow(row) && normalizeOrganizationAccessRole(row?.accessRole))
        .map((row) => numericId(row?.userId))
        .filter(Boolean));

    return (candidates || []).filter((candidate) => activeOrganizationUserIds.has(numericId(candidate?.id)));
}
