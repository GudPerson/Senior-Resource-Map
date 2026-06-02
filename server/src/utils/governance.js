import { normalizeRole } from './roles.js';

const ORGANIZATION_ACCESS_ROLES = new Set(['admin', 'staff']);
const ORGANIZATION_GOVERNANCE_STATUSES = new Set(['active', 'draft', 'paused', 'archived']);
const AGREEMENT_STATUSES = new Set(['draft', 'active', 'expired', 'revoked']);
const NOTIFICATION_CHANNELS = new Set(['in_app', 'email', 'whatsapp', 'sms']);
const EXTERNAL_NOTIFICATION_CHANNELS = new Set(['email', 'whatsapp', 'sms']);

function normalizeValue(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function isActiveRow(row) {
    return row && !row.revokedAt;
}

function isActiveLink(row) {
    return row && !row.unlinkedAt && normalizeValue(row.linkStatus || 'active') !== 'unlinked';
}

function organizationLabel(row, fallback = 'another organisation') {
    return row?.organizationName || row?.name || fallback;
}

function userLabel(row, fallback = 'This user') {
    return row?.userName || row?.name || row?.username || row?.email || fallback;
}

function toDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeOrganizationAccessRole(value) {
    const normalized = normalizeValue(value);
    return ORGANIZATION_ACCESS_ROLES.has(normalized) ? normalized : null;
}

export function normalizeOrganizationGovernanceStatus(value) {
    const normalized = normalizeValue(value || 'active');
    return ORGANIZATION_GOVERNANCE_STATUSES.has(normalized) ? normalized : 'active';
}

export function isOrganizationOpenForNewRecords(organization) {
    const status = normalizeOrganizationGovernanceStatus(organization?.governanceStatus);
    return status === 'active' || status === 'draft';
}

export function isOrganizationDeletableDraft({
    organization,
    activeAccess = [],
    activeAgreements = [],
    activeResourceLinks = [],
} = {}) {
    return normalizeOrganizationGovernanceStatus(organization?.governanceStatus) === 'draft'
        && !organization?.legacyPartnerUserId
        && activeAccess.length === 0
        && activeAgreements.length === 0
        && activeResourceLinks.length === 0;
}

export function normalizeAgreementStatus(value) {
    const normalized = normalizeValue(value || 'draft');
    return AGREEMENT_STATUSES.has(normalized) ? normalized : 'draft';
}

export function normalizeNotificationChannel(value) {
    const normalized = normalizeValue(value || 'in_app');
    return NOTIFICATION_CHANNELS.has(normalized) ? normalized : 'in_app';
}

export function organizationAccessGrantsResourceEditRights() {
    return false;
}

export function evaluateOrganizationUserAssignment({
    targetOrganizationId,
    existingMemberships = [],
} = {}) {
    const targetId = Number(targetOrganizationId);
    const activeMembership = existingMemberships.find((row) => (
        isActiveRow(row)
        && Number(row?.organizationId)
        && Number(row.organizationId) !== targetId
    ));

    if (!activeMembership) return { allowed: true, reason: null };

    return {
        allowed: false,
        reason: `This user is already assigned to ${organizationLabel(activeMembership)}. Remove that access before assigning another organisation.`,
    };
}

export function evaluateAssetOperatorOrganizationEligibility({
    resourceOrganizationLinks = [],
    userOrganizationMemberships = [],
} = {}) {
    const activeLinks = resourceOrganizationLinks.filter(isActiveLink);
    if (!activeLinks.length) return { allowed: true, reason: null };
    const activeLinkOrganizationIds = [...new Set(activeLinks.map((row) => Number(row.organizationId)).filter(Boolean))];
    if (activeLinkOrganizationIds.length > 1) {
        return {
            allowed: false,
            reason: 'This resource is linked to more than one active organisation. Clean up organisation links before changing asset access.',
        };
    }

    const linkedOrganization = activeLinks[0];
    const linkedOrganizationId = Number(linkedOrganization.organizationId);
    const activeMembership = userOrganizationMemberships.find((row) => (
        isActiveRow(row)
        && Number(row?.organizationId)
    ));

    if (!activeMembership) {
        return {
            allowed: false,
            reason: `This resource is linked to ${organizationLabel(linkedOrganization)}. Assign the user to that organisation before granting asset access.`,
        };
    }

    if (Number(activeMembership.organizationId) !== linkedOrganizationId) {
        return {
            allowed: false,
            reason: `This resource is linked to ${organizationLabel(linkedOrganization)}, but the user is assigned to ${organizationLabel(activeMembership)}.`,
        };
    }

    return { allowed: true, reason: null };
}

export function evaluateResourceOrganizationLink({
    targetOrganizationId,
    existingResourceLinks = [],
    activeOperators = [],
} = {}) {
    const targetId = Number(targetOrganizationId);
    const conflictingLink = existingResourceLinks.find((row) => (
        isActiveLink(row)
        && Number(row?.organizationId)
        && Number(row.organizationId) !== targetId
    ));

    if (conflictingLink) {
        return {
            allowed: false,
            reason: `This resource is already linked to ${organizationLabel(conflictingLink)}. Unlink it there before linking another organisation.`,
        };
    }

    if (!Array.isArray(activeOperators) || activeOperators.length === 0) {
        return {
            allowed: false,
            reason: 'This asset needs at least one active Owner or Staff before it can be linked to an organisation.',
        };
    }

    const missingOperators = [];
    const crossOrganizationOperators = [];

    for (const operator of activeOperators) {
        const activeMembership = (operator?.organizationMemberships || []).find((row) => (
            isActiveRow(row)
            && Number(row?.organizationId)
        ));
        if (!activeMembership) {
            missingOperators.push(userLabel(operator));
        } else if (Number(activeMembership.organizationId) !== targetId) {
            crossOrganizationOperators.push(`${userLabel(operator)} is assigned to ${organizationLabel(activeMembership)}`);
        }
    }

    if (missingOperators.length) {
        return {
            allowed: false,
            reason: `Cannot link this asset yet. Add ${missingOperators.join(', ')} to this organisation first.`,
        };
    }

    if (crossOrganizationOperators.length) {
        return {
            allowed: false,
            reason: `${crossOrganizationOperators.join('; ')}. Remove the cross-organisation access before linking this resource.`,
        };
    }

    return { allowed: true, reason: null };
}

export function findActiveOrganizationAccess(actor, organization, accessRows = []) {
    const actorId = Number(actor?.id);
    const organizationId = Number(organization?.id);
    if (!actorId || !organizationId) return null;

    return accessRows.find((row) => (
        Number(row?.organizationId) === organizationId
        && Number(row?.userId) === actorId
        && isActiveRow(row)
        && normalizeOrganizationAccessRole(row?.accessRole)
    )) || null;
}

function countActiveOrganizationAdmins(accessRows = [], organizationId) {
    const targetId = Number(organizationId);
    if (!targetId) return 0;
    return (accessRows || []).filter((row) => (
        Number(row?.organizationId) === targetId
        && isActiveRow(row)
        && normalizeOrganizationAccessRole(row?.accessRole) === 'admin'
    )).length;
}

export function canManageOrganizationGovernance(actor, organization, accessRows = []) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    const access = findActiveOrganizationAccess(actor, organization, accessRows);
    return normalizeOrganizationAccessRole(access?.accessRole) === 'admin';
}

export function canManageOrganizationAccessRole(actor, organization, accessRows = [], targetRole) {
    if (!normalizeOrganizationAccessRole(targetRole)) return false;
    return canManageOrganizationGovernance(actor, organization, accessRows);
}

export function canRevokeOrganizationAccessRole(actor, organization, accessRows = [], membership) {
    if (!canManageOrganizationGovernance(actor, organization, accessRows)) {
        return { allowed: false, reason: 'Organisation governance is outside your access.' };
    }

    const membershipRole = normalizeOrganizationAccessRole(membership?.accessRole);
    if (!membershipRole) {
        return { allowed: false, reason: 'Organisation access role is invalid.' };
    }

    if (
        membershipRole === 'admin'
        && countActiveOrganizationAdmins(accessRows, organization?.id) <= 1
    ) {
        return {
            allowed: false,
            reason: 'Every organisation needs at least one active Organisation Admin.',
        };
    }

    return { allowed: true, reason: null };
}

export function canViewOrganizationGovernance(actor, organization, accessRows = []) {
    if (canManageOrganizationGovernance(actor, organization, accessRows)) return true;
    return Boolean(findActiveOrganizationAccess(actor, organization, accessRows));
}

export function isNotificationDeliveryAllowed(preference) {
    const channel = normalizeNotificationChannel(preference?.channel);
    if (!preference?.enabled) return false;
    return !EXTERNAL_NOTIFICATION_CHANNELS.has(channel);
}

export function hasActiveOptOut(records = [], optOutType) {
    const target = normalizeValue(optOutType);
    if (!target) return false;
    return records.some((record) => (
        normalizeValue(record?.optOutType) === target
        && record?.active !== false
        && !record?.revokedAt
    ));
}

export function buildAgreementCoverageSummary(agreements = [], useKey, now = new Date()) {
    const active = agreements.filter((agreement) => normalizeAgreementStatus(agreement?.status) === 'active');
    if (!active.length) {
        return {
            status: 'missing',
            warning: 'No active agreement covers this use yet.',
        };
    }

    const nowDate = toDate(now) || new Date();
    const usable = active.filter((agreement) => {
        const expiresAt = toDate(agreement?.expiresAt);
        return !expiresAt || expiresAt >= nowDate;
    });

    if (!usable.length) {
        return {
            status: 'expired',
            warning: 'Agreement coverage exists, but it has expired.',
        };
    }

    const covered = usable.some((agreement) => agreement?.allowedUses?.[useKey] === true);
    if (!covered) {
        return {
            status: 'not_allowed',
            warning: 'Active agreement coverage does not allow this use.',
        };
    }

    return {
        status: 'covered',
        warning: null,
    };
}

export function isRetentionDeletionReady(record, now = new Date()) {
    if (!record?.deletionEligible) return false;
    if (normalizeValue(record?.deletionStatus) !== 'reviewed') return false;
    const retainUntil = toDate(record?.retainUntil);
    if (!retainUntil) return true;
    const nowDate = toDate(now) || new Date();
    return retainUntil <= nowDate;
}
