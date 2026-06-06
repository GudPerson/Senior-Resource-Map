import { normalizeRole } from './roles.js';

function scopeError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

export function normalizeAdminRegionScopeIds(rawSubregionIds) {
    const input = Array.isArray(rawSubregionIds)
        ? rawSubregionIds
        : [rawSubregionIds].filter((value) => value !== undefined && value !== null && value !== '');

    const ids = [];
    const seen = new Set();

    for (const value of input.flatMap((item) => typeof item === 'string' ? item.split(',') : [item])) {
        const text = String(value ?? '').trim();
        if (!text) continue;
        if (!/^\d+$/.test(text)) {
            throw scopeError('Region scope must use valid region ids.', 400);
        }
        const id = Number.parseInt(text, 10);
        if (!Number.isInteger(id) || id <= 0) {
            throw scopeError('Region scope must use valid region ids.', 400);
        }
        if (!seen.has(id)) {
            seen.add(id);
            ids.push(id);
        }
    }

    return ids;
}

function getManagedUserRegionId(user) {
    const direct = Number.parseInt(String(user?.derivedSubregionId ?? ''), 10);
    if (Number.isInteger(direct) && direct > 0) return direct;

    const firstAssigned = Array.isArray(user?.subregionIds) ? user.subregionIds[0] : null;
    const fallback = Number.parseInt(String(firstAssigned ?? ''), 10);
    return Number.isInteger(fallback) && fallback > 0 ? fallback : null;
}

export function validateAdminRegionScopeUpdate({
    actor,
    targetUser,
    subregionIds,
    managedUsers = [],
}) {
    const normalizedSubregionIds = normalizeAdminRegionScopeIds(subregionIds);

    if (normalizeRole(actor?.role) !== 'super_admin') {
        throw scopeError('Only Super Admins can manage Admin region scope.', 403);
    }

    if (normalizeRole(targetUser?.role) !== 'regional_admin') {
        throw scopeError('Region scope can only be assigned to Admin accounts.', 400);
    }

    const selected = new Set(normalizedSubregionIds);
    const strandedManagedUsers = managedUsers.filter((user) => {
        const managedRegionId = getManagedUserRegionId(user);
        return Number.isInteger(managedRegionId) && !selected.has(managedRegionId);
    });

    if (strandedManagedUsers.length > 0) {
        const examples = strandedManagedUsers
            .slice(0, 3)
            .map((user) => user.name || user.username || `User ${user.id}`)
            .join(', ');
        const suffix = examples
            ? ` Affected users: ${examples}${strandedManagedUsers.length > 3 ? `, and ${strandedManagedUsers.length - 3} more` : ''}.`
            : '';
        throw scopeError(
            `Move or reassign users outside this Admin's new region scope before saving.${suffix}`,
            400,
        );
    }

    return {
        subregionIds: normalizedSubregionIds,
        strandedManagedUsers: [],
    };
}
