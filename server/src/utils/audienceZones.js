import { eq, inArray } from 'drizzle-orm';

import {
    audienceZonePostalCodes,
    audienceZones,
    softAssetAudienceZones,
    softAssetParentAudienceZones,
} from '../db/schema.js';
import { normalizePostalCode, parsePostalCodeListInput } from './postalBoundaries.js';
import { normalizeRole } from './roles.js';

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

export function canManageAudienceZone(actor, zone) {
    const actorRole = normalizeRole(actor?.role);

    if (!actor || !zone) return false;
    if (actorRole === 'super_admin') return true;
    if (actorRole === 'partner') return Number(zone.partnerUserId) === Number(actor.id);
    if (actorRole === 'regional_admin') {
        if (zone.partnerUserId) {
            return Number(zone.ownerPartner?.managerUserId) === Number(actor.id);
        }
        return Number(zone.createdByUserId) === Number(actor.id);
    }

    return false;
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
        },
    });
}

export async function assertManageableAudienceZones(db, actor, zoneIds) {
    const normalizedIds = normalizeAudienceZoneIds(zoneIds);
    if (normalizedIds.length === 0) return [];

    const rows = await loadAudienceZonesByIds(db, normalizedIds);
    if (rows.length !== normalizedIds.length) {
        throw createClientError('One or more audience zones were not found.', 404);
    }

    for (const zoneId of normalizedIds) {
        const zone = rows.find((row) => row.id === zoneId);
        if (!canManageAudienceZone(actor, zone)) {
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
