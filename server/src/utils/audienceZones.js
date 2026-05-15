import { eq, inArray } from 'drizzle-orm';

import {
    audienceZonePostalCodes,
    audienceZones,
    softAssetAudienceZones,
    softAssetParentAudienceZones,
} from '../db/schema.js';
import { getActiveHardAssetStaffAccess, hasHardAssetStaffAccess } from './hardAssetStaff.js';
import { actorCanManagePartnerOwnedEntity } from './ownership.js';
import { normalizeRole } from './roles.js';
import { normalizePostalCode, parsePostalCodeListInput } from './postalBoundaries.js';

function normalizeText(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function createClientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function chunk(array, size) {
    const parts = [];
    for (let i = 0; i < array.length; i += size) {
        parts.push(array.slice(i, i + size));
    }
    return parts;
}

export function normalizeAudienceZoneIds(rawValue) {
    if (!Array.isArray(rawValue)) return [];

    return [...new Set(
        rawValue
            .map((value) => Number.parseInt(String(value), 10))
            .filter(Number.isInteger)
    )];
}

export function normalizeAudienceZoneSharingStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    if (status === 'local' || status === 'pending_approval' || status === 'approved') return status;
    return 'local';
}

function getAudienceZoneHardAssetId(zone) {
    const parsed = Number.parseInt(String(zone?.hardAssetId ?? zone?.hardAsset?.id ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function actorHasRegionScopeForZoneAsset(actor, zone) {
    const subregionId = Number.parseInt(String(zone?.hardAsset?.subregionId ?? ''), 10);
    if (!Number.isInteger(subregionId)) return false;
    const actorSubregions = Array.isArray(actor?.subregionIds) ? actor.subregionIds.map(Number) : [];
    return actorSubregions.includes(subregionId);
}

export function getActorHardAssetAccessIds(actor, allowedRoles = ['owner', 'staff']) {
    return getActiveHardAssetStaffAccess(actor, allowedRoles)
        .map((entry) => entry.hardAssetId)
        .filter(Number.isInteger);
}

export function canManageAudienceZone(actor, zone) {
    const hardAssetId = getAudienceZoneHardAssetId(zone);
    if (hardAssetId) {
        const role = normalizeRole(actor?.role);
        if (role === 'super_admin') return true;
        if (role === 'regional_admin') return actorHasRegionScopeForZoneAsset(actor, zone);
        return hasHardAssetStaffAccess(actor, hardAssetId, ['owner']);
    }
    return actorCanManagePartnerOwnedEntity(actor, zone, zone?.ownerPartner || null);
}

export function canViewAudienceZone(actor, zone) {
    if (canManageAudienceZone(actor, zone)) return true;
    if (normalizeAudienceZoneSharingStatus(zone?.sharingStatus) === 'approved') return true;

    const hardAssetId = getAudienceZoneHardAssetId(zone);
    return Boolean(hardAssetId && hasHardAssetStaffAccess(actor, hardAssetId, ['owner', 'staff']));
}

export function canUseAudienceZoneForHardAssetIds(actor, zone, hardAssetIds = []) {
    if (canManageAudienceZone(actor, zone)) return true;
    if (normalizeAudienceZoneSharingStatus(zone?.sharingStatus) === 'approved') return true;

    const hardAssetId = getAudienceZoneHardAssetId(zone);
    if (!hardAssetId) return false;

    const linkedIds = new Set((hardAssetIds || [])
        .map((value) => Number.parseInt(String(value), 10))
        .filter(Number.isInteger));
    return linkedIds.has(hardAssetId)
        && hasHardAssetStaffAccess(actor, hardAssetId, ['owner', 'staff']);
}

export async function loadAudienceZonesByIds(db, zoneIds) {
    const normalizedIds = normalizeAudienceZoneIds(zoneIds);
    if (normalizedIds.length === 0) return [];

    return db.query.audienceZones.findMany({
        where: inArray(audienceZones.id, normalizedIds),
        with: {
            ownerPartner: {
                columns: {
                    id: true,
                    name: true,
                    username: true,
                    role: true,
                    managerUserId: true,
                },
            },
            creator: {
                columns: {
                    id: true,
                    name: true,
                },
            },
            approvedBy: {
                columns: {
                    id: true,
                    name: true,
                },
            },
            hardAsset: {
                columns: {
                    id: true,
                    name: true,
                    subregionId: true,
                    partnerId: true,
                    isDeleted: true,
                },
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
            },
        },
    });
}

export async function assertManageableAudienceZones(db, actor, zoneIds, options = {}) {
    const normalizedIds = normalizeAudienceZoneIds(zoneIds);
    if (normalizedIds.length === 0) return [];

    const rows = await loadAudienceZonesByIds(db, normalizedIds);
    if (rows.length !== normalizedIds.length) {
        throw createClientError('One or more audience zones were not found.', 404);
    }

    for (const zoneId of normalizedIds) {
        const zone = rows.find((row) => row.id === zoneId);
        if (!canUseAudienceZoneForHardAssetIds(actor, zone, options.hardAssetIds || [])) {
            throw createClientError(`Audience zone "${zone?.name || zoneId}" is outside your allowed scope.`, 403);
        }
    }

    return rows;
}

export async function syncAudienceZonePostalCodes(db, audienceZoneId, rawPostalCodes) {
    const postalCodes = parsePostalCodeListInput(rawPostalCodes);

    await db.delete(audienceZonePostalCodes).where(eq(audienceZonePostalCodes.audienceZoneId, audienceZoneId));
    for (const group of chunk(postalCodes, 500)) {
        if (group.length === 0) continue;
        await db.insert(audienceZonePostalCodes).values(
            group.map((postalCode) => ({ audienceZoneId, postalCode }))
        );
    }

    return postalCodes;
}

export async function syncSoftAssetAudienceZones(db, softAssetId, zoneIds) {
    const normalizedIds = normalizeAudienceZoneIds(zoneIds);
    await db.delete(softAssetAudienceZones).where(eq(softAssetAudienceZones.softAssetId, softAssetId));

    if (normalizedIds.length > 0) {
        await db.insert(softAssetAudienceZones).values(
            normalizedIds.map((audienceZoneId) => ({ softAssetId, audienceZoneId }))
        );
    }

    return normalizedIds;
}

export async function syncSoftAssetParentAudienceZones(db, softAssetParentId, zoneIds) {
    const normalizedIds = normalizeAudienceZoneIds(zoneIds);
    await db.delete(softAssetParentAudienceZones).where(eq(softAssetParentAudienceZones.softAssetParentId, softAssetParentId));

    if (normalizedIds.length > 0) {
        await db.insert(softAssetParentAudienceZones).values(
            normalizedIds.map((audienceZoneId) => ({ softAssetParentId, audienceZoneId }))
        );
    }

    return normalizedIds;
}

export async function resolveMatchedAudienceZoneIds(db, rawPostalCode) {
    const postalCode = normalizePostalCode(rawPostalCode);
    if (!postalCode) return new Set();

    const rows = await db
        .select({ audienceZoneId: audienceZonePostalCodes.audienceZoneId })
        .from(audienceZonePostalCodes)
        .where(eq(audienceZonePostalCodes.postalCode, postalCode));

    return new Set(rows.map((row) => row.audienceZoneId).filter(Number.isInteger));
}

export async function resolveStandardAudienceZoneIds(db, user) {
    return resolveMatchedAudienceZoneIds(db, user?.postalCode);
}

function coerceAudienceZone(entry) {
    const zone = entry?.audienceZone || entry;
    const id = Number.parseInt(String(zone?.id ?? ''), 10);
    if (!Number.isInteger(id)) return null;

    return {
        id,
        zoneCode: normalizeText(zone?.zoneCode) || null,
        name: normalizeText(zone?.name) || `Audience Zone ${id}`,
        partnerUserId: Number.parseInt(String(zone?.partnerUserId ?? ''), 10) || null,
    };
}

export function getAssetAudienceZones(asset) {
    const source = (asset?.assetMode || 'standalone') === 'child'
        ? asset?.parent?.audienceZones
        : asset?.audienceZones;

    const deduped = new Map();
    for (const entry of source || []) {
        const zone = coerceAudienceZone(entry);
        if (!zone) continue;
        deduped.set(zone.id, zone);
    }

    return [...deduped.values()];
}

export function getAssetAudienceZoneIds(asset) {
    return getAssetAudienceZones(asset).map((zone) => zone.id);
}
