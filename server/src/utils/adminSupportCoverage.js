import { normalizeRole } from './roles.js';

function parsePositiveId(value) {
    const id = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function uniquePositiveIds(values = []) {
    const ids = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : []) {
        const id = parsePositiveId(value);
        if (id && !seen.has(id)) {
            seen.add(id);
            ids.push(id);
        }
    }
    return ids;
}

function getProfileRegionIds(user) {
    const direct = parsePositiveId(user?.derivedSubregionId);
    if (direct) return [direct];
    return uniquePositiveIds(user?.subregionIds);
}

function getAdminScopeIds(user) {
    return uniquePositiveIds(user?.subregionIds);
}

function formatAdminSummary(admins) {
    const names = admins
        .slice(0, 2)
        .map((admin) => admin.name || admin.username)
        .filter(Boolean);

    if (admins.length === 0 || names.length === 0) return '';
    if (admins.length <= 2) return names.join(', ');
    return `${names.join(', ')} +${admins.length - 2} more`;
}

export function canViewUserThroughSupportCoverage(actor, targetUser) {
    const actorRole = normalizeRole(actor?.role);
    const targetRole = normalizeRole(targetUser?.role);

    if (!actor || !targetUser || actor.id === targetUser.id) return false;
    if (actorRole === 'super_admin') return targetRole !== 'guest';
    if (actorRole !== 'regional_admin' || targetRole !== 'standard') return false;

    const targetRegionIds = getProfileRegionIds(targetUser);
    if (targetRegionIds.length === 0) return false;

    const actorScope = new Set(getAdminScopeIds(actor));
    if (actorScope.size === 0) return false;

    return targetRegionIds.some((id) => actorScope.has(id));
}

export function buildUserSupportCoverage(user, adminUsers = []) {
    const role = normalizeRole(user?.role);

    if (role === 'super_admin') {
        return {
            status: 'platform',
            label: 'Platform-wide',
            detail: 'Super Admin account',
            adminCount: 0,
            admins: [],
        };
    }

    if (role === 'regional_admin') {
        return {
            status: 'admin_scope',
            label: 'Admin account',
            detail: 'Uses Admin Region Scope',
            adminCount: 0,
            admins: [],
        };
    }

    if (role !== 'standard') {
        return {
            status: 'legacy',
            label: 'Legacy account',
            detail: 'Uses legacy access rules',
            adminCount: 0,
            admins: [],
        };
    }

    const profileRegionIds = getProfileRegionIds(user);
    if (!user?.postalCode) {
        return {
            status: 'missing_postal',
            label: 'Needs postal code',
            detail: 'Visible to Super Admin until location details are completed',
            adminCount: 0,
            admins: [],
        };
    }

    if (profileRegionIds.length === 0) {
        return {
            status: 'missing_location',
            label: 'Needs location review',
            detail: 'Visible to Super Admin until the profile region is resolved',
            adminCount: 0,
            admins: [],
        };
    }

    const profileRegionSet = new Set(profileRegionIds);
    const admins = (Array.isArray(adminUsers) ? adminUsers : [])
        .filter((candidate) => normalizeRole(candidate?.role) === 'regional_admin')
        .filter((candidate) => getAdminScopeIds(candidate).some((id) => profileRegionSet.has(id)))
        .map((candidate) => ({
            id: candidate.id,
            name: candidate.name || null,
            username: candidate.username || null,
        }));

    if (admins.length === 0) {
        return {
            status: 'uncovered',
            label: 'No Admin coverage',
            detail: 'Profile region has no matching Admin Region Scope',
            adminCount: 0,
            admins: [],
        };
    }

    return {
        status: 'covered',
        label: admins.length === 1 ? 'Covered by 1 Admin' : `Covered by ${admins.length} Admins`,
        detail: formatAdminSummary(admins),
        adminCount: admins.length,
        admins,
    };
}
