import { eq, inArray } from 'drizzle-orm';

import { hardAssets, users } from '../db/schema.js';
import { actorCanManageAsset, canAssignPartnerOwner } from './ownership.js';
import { normalizeRole } from './roles.js';

export function getCacheRegionId(...ids) {
    return ids.find((value) => value !== undefined && value !== null && value !== '') || 'all';
}

export function clientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

export async function loadPartnerUser(db, partnerId) {
    if (!Number.isInteger(partnerId)) return null;

    const partner = await db.query.users.findFirst({
        where: eq(users.id, partnerId),
        columns: {
            id: true,
            name: true,
            username: true,
            role: true,
            managerUserId: true,
        },
        with: {
            subregions: {
                columns: {
                    subregionId: true,
                },
            },
        },
    });

    if (!partner) return null;
    return {
        ...partner,
        role: normalizeRole(partner.role),
        subregionIds: partner.subregions.map((item) => item.subregionId),
    };
}

export async function loadHardAssetsByIds(db, ids) {
    const uniqueIds = [...new Set((ids || []).map((value) => Number.parseInt(String(value), 10)).filter(Number.isInteger))];
    if (uniqueIds.length === 0) return [];

    return await db.query.hardAssets.findMany({
        where: inArray(hardAssets.id, uniqueIds),
        with: {
            partner: {
                columns: {
                    id: true,
                    name: true,
                    role: true,
                    managerUserId: true,
                },
            },
        },
    });
}

export function parseLinkedHardAssetIds(body, keys = ['locationIds', 'hostIds']) {
    for (const key of keys) {
        if (Array.isArray(body?.[key])) {
            return body[key].map((value) => Number.parseInt(String(value), 10)).filter(Number.isInteger);
        }
    }

    for (const key of ['locationId', 'hostId']) {
        if (body?.[key] !== undefined && body?.[key] !== null && body?.[key] !== '') {
            const parsed = Number.parseInt(String(body[key]), 10);
            return Number.isInteger(parsed) ? [parsed] : [];
        }
    }

    return [];
}

export function ensureActorCanManageLinkedHardAssets(actor, linkedHardAssets) {
    const actorRole = normalizeRole(actor?.role);
    if (actorRole === 'super_admin') return;

    for (const hardAsset of linkedHardAssets) {
        if (!actorCanManageAsset(actor, hardAsset, hardAsset.partner)) {
            throw clientError(`Linked place "${hardAsset.name}" is outside your allowed scope.`, 403);
        }
    }
}

export function ensureActorCanTargetSubregion(actor, subregionId) {
    const actorRole = normalizeRole(actor?.role);
    if (actorRole === 'super_admin') return;

    if (!Array.isArray(actor?.subregionIds) || !actor.subregionIds.includes(subregionId)) {
        throw clientError('Target subregion is outside your allowed scope.', 403);
    }
}

export function normalizeAudienceMode(bodyOrMode, owner) {
    const requestedMode = typeof bodyOrMode === 'string'
        ? String(bodyOrMode || 'public').trim() || 'public'
        : String(bodyOrMode?.audienceMode || 'public').trim() || 'public';

    if (!['public', 'partner_boundary', 'audience_zones'].includes(requestedMode)) {
        throw clientError('Invalid audience mode.', 400);
    }
    if (requestedMode === 'partner_boundary' && !owner?.id) {
        throw clientError('Partner-boundary audience is only allowed for partner-owned offerings.', 400);
    }

    return requestedMode;
}

export function normalizeOwnershipMode(actorRole, body) {
    if (normalizeRole(actorRole) === 'partner') return 'partner';
    if (body?.ownershipMode === 'partner' || body?.partnerId) return 'partner';
    return 'system';
}

export async function resolveAssetOwner(db, actor, body, subregionId = null) {
    const actorRole = normalizeRole(actor?.role);
    const ownershipMode = normalizeOwnershipMode(actorRole, body);

    if (actorRole === 'partner') {
        return { ownershipMode: 'partner', owner: actor };
    }

    if (ownershipMode === 'system') {
        return { ownershipMode: 'system', owner: null };
    }

    const partnerId = Number.parseInt(String(body?.partnerId ?? ''), 10);
    if (!Number.isInteger(partnerId)) {
        throw clientError('A partner owner is required for partner-owned offerings.', 400);
    }

    const owner = await loadPartnerUser(db, partnerId);
    if (!owner || normalizeRole(owner.role) !== 'partner') {
        throw clientError('Selected partner owner was not found.', 404);
    }

    if (!canAssignPartnerOwner(actor, owner, subregionId)) {
        throw clientError('Selected partner owner is outside your allowed scope.', 403);
    }

    return { ownershipMode: 'partner', owner };
}

export function resolveExplicitSubregionId(body) {
    const parsed = Number.parseInt(String(body?.subregionId ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

export function determineSoftSubregion(actor, body, linkedHardAssets) {
    const actorRole = normalizeRole(actor?.role);
    const uniqueSubregionIds = [...new Set(linkedHardAssets.map((asset) => asset.subregionId).filter(Number.isInteger))];

    if (uniqueSubregionIds.length > 1) {
        throw clientError('Linked places must all belong to the same subregion.', 400);
    }

    if (uniqueSubregionIds.length === 1) {
        const targetSubregionId = uniqueSubregionIds[0];
        ensureActorCanTargetSubregion(actor, targetSubregionId);
        return targetSubregionId;
    }

    if (actorRole === 'partner') {
        const partnerSubregionId = actor?.subregionIds?.[0];
        if (!Number.isInteger(partnerSubregionId)) {
            throw clientError('Partner account is missing its assigned subregion.', 400);
        }
        return partnerSubregionId;
    }

    const explicitSubregionId = resolveExplicitSubregionId(body);
    if (!Number.isInteger(explicitSubregionId)) {
        throw clientError('A target subregion is required when no linked place is selected.', 400);
    }

    ensureActorCanTargetSubregion(actor, explicitSubregionId);
    return explicitSubregionId;
}
