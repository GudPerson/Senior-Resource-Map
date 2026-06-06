import { desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import { audienceZones, hardAssets } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    canManageAudienceZone,
    canViewAudienceZone,
    getActorHardAssetAccessIds,
    normalizeAudienceZoneSharingStatus,
    syncAudienceZonePostalCodes,
} from '../utils/audienceZones.js';
import { canAssignHardAssetStaffRole } from '../utils/hardAssetStaff.js';
import { normalizePostalCode, parsePostalCodeListInput } from '../utils/postalBoundaries.js';
import { normalizeRole } from '../utils/roles.js';
import { normalizeOwnershipMode, resolveAssetOwner } from '../utils/softAssetScope.js';
import {
    flexibleImportRowsSchema,
    optionalOneLineTextSchema,
    optionalPositiveIntValueSchema,
    optionalTextSchema,
    positiveIntListSchema,
    postalCodeListInputSchema,
    requiredOneLineTextSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';

const audienceZoneCreateBodySchema = z.object({
    name: requiredOneLineTextSchema('Name', 160),
    zoneCode: optionalOneLineTextSchema(80),
    description: optionalTextSchema(2000),
    ownershipMode: z.enum(['system', 'partner']).optional(),
    partnerId: optionalPositiveIntValueSchema('Partner owner'),
    hardAssetId: optionalPositiveIntValueSchema('Asset owner'),
    sharingStatus: z.enum(['local', 'pending_approval', 'approved']).optional(),
    postalCodes: postalCodeListInputSchema,
});

const audienceZoneUpdateBodySchema = z.object({
    name: optionalOneLineTextSchema(160),
    zoneCode: optionalOneLineTextSchema(80),
    description: optionalTextSchema(2000),
    ownershipMode: z.enum(['system', 'partner']).optional(),
    partnerId: optionalPositiveIntValueSchema('Partner owner'),
    hardAssetId: optionalPositiveIntValueSchema('Asset owner'),
    sharingStatus: z.enum(['local', 'pending_approval', 'approved']).optional(),
    postalCodes: postalCodeListInputSchema,
});

const audienceZoneBoundaryUploadBodySchema = z.object({
    rows: flexibleImportRowsSchema('Boundary rows'),
});

const audienceZoneBulkDeleteBodySchema = z.object({
    ids: positiveIntListSchema('Audience zone IDs'),
});

function normalizeText(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length > 0 ? text : null;
}

function createClientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function isRegionOrSuperAdmin(actor) {
    const role = normalizeRole(actor?.role);
    return role === 'super_admin' || role === 'regional_admin';
}

async function loadHardAssetForAudienceZone(db, hardAssetId) {
    if (!Number.isInteger(hardAssetId)) return null;
    return db.query.hardAssets.findFirst({
        where: eq(hardAssets.id, hardAssetId),
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

function resolveAssetZoneSharingStatus(actor, requestedStatus, currentStatus = null) {
    const normalized = normalizeAudienceZoneSharingStatus(requestedStatus || currentStatus || 'local');
    if (isRegionOrSuperAdmin(actor)) return normalized;
    if (normalized === 'approved') {
        throw createClientError('Global audience-zone sharing requires Admin approval.', 403);
    }
    return normalized;
}

async function countApprovedZoneHardAssetUsage(db, audienceZoneId) {
    const result = await db.execute(sql`
        SELECT COUNT(DISTINCT usage.hard_asset_id)::int AS count
        FROM (
            SELECT sal.hard_asset_id
            FROM soft_asset_audience_zones saz
            INNER JOIN soft_asset_locations sal ON sal.soft_asset_id = saz.soft_asset_id
            WHERE saz.audience_zone_id = ${audienceZoneId}

            UNION

            SELECT sa.host_hard_asset_id AS hard_asset_id
            FROM soft_asset_audience_zones saz
            INNER JOIN soft_assets sa ON sa.id = saz.soft_asset_id
            WHERE saz.audience_zone_id = ${audienceZoneId}
              AND sa.host_hard_asset_id IS NOT NULL
        ) usage
        WHERE usage.hard_asset_id IS NOT NULL
    `);
    const rows = Array.isArray(result) ? result : result?.rows || [];
    return Number(rows[0]?.count || 0);
}

async function assertUniqueZoneCode(db, zoneCode, ignoreId = null) {
    if (!zoneCode) return;

    const [existing] = await db
        .select({ id: audienceZones.id })
        .from(audienceZones)
        .where(eq(audienceZones.zoneCode, zoneCode));

    if (existing && existing.id !== ignoreId) {
        throw createClientError(`An audience zone with code "${zoneCode}" already exists.`);
    }
}

function formatAudienceZone(zone) {
    const postalCodes = (zone.postalCodes || [])
        .map((entry) => normalizePostalCode(entry.postalCode))
        .filter(Boolean)
        .sort();

    return {
        id: zone.id,
        zoneCode: zone.zoneCode || null,
        name: zone.name,
        description: zone.description || null,
        partnerUserId: zone.partnerUserId || null,
        partnerName: zone.ownerPartner?.name || null,
        partnerUsername: zone.ownerPartner?.username || null,
        hardAssetId: zone.hardAssetId || null,
        hardAssetName: zone.hardAsset?.name || null,
        sharingStatus: normalizeAudienceZoneSharingStatus(zone.sharingStatus || (zone.hardAssetId ? 'local' : 'approved')),
        approvedByName: zone.approvedBy?.name || null,
        approvedAt: zone.approvedAt || null,
        ownershipMode: zone.partnerUserId ? 'partner' : 'system',
        creatorName: zone.creator?.name || null,
        postalCodes,
        postalCodesPreview: postalCodes.slice(0, 12),
        postalCodeCount: postalCodes.length,
        updatedAt: zone.updatedAt,
        createdAt: zone.createdAt,
    };
}

async function loadAudienceZoneList(db) {
    return db.query.audienceZones.findMany({
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
            postalCodes: {
                columns: {
                    postalCode: true,
                },
            },
        },
        orderBy: [desc(audienceZones.updatedAt)],
    });
}

async function loadAudienceZoneDetail(db, id) {
    return db.query.audienceZones.findFirst({
        where: eq(audienceZones.id, id),
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
            postalCodes: {
                columns: {
                    postalCode: true,
                },
            },
        },
    });
}

function parseBoundaryReference(row) {
    return normalizeText(
        row?.audienceZoneId
        ?? row?.audienceZoneCode
        ?? row?.zoneId
        ?? row?.zoneCode
        ?? row?.zone_code
        ?? row?.id
        ?? row?.ID
        ?? row?.['ID']
        ?? row?.name
        ?? row?.['Audience Zone ID']
        ?? row?.['Audience Zone Code']
        ?? row?.['Zone Code']
        ?? row?.['Audience Zone']
    );
}

export const getAudienceZones = async (c) => {
    try {
        const actor = c.get('user');
        const role = normalizeRole(actor?.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const hasAssetAccess = getActorHardAssetAccessIds(actor).length > 0;
        if (!['super_admin', 'regional_admin', 'partner'].includes(role) && !hasAssetAccess) {
            return c.json({ error: 'Only partners and admins can manage audience zones.' }, 403);
        }

        const zones = await loadAudienceZoneList(db);
        const visible = zones
            .filter((zone) => canViewAudienceZone(actor, zone))
            .map(formatAudienceZone);

        return c.json(visible);
    } catch (err) {
        console.error('getAudienceZones Error:', err);
        return c.json({ error: err.message || 'Failed to fetch audience zones.' }, err.status || 500);
    }
};

export const createAudienceZone = async (c) => {
    try {
        const actor = c.get('user');
        const role = normalizeRole(actor?.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const hasAssetOwnerAccess = getActorHardAssetAccessIds(actor, ['owner']).length > 0;
        if (!['super_admin', 'regional_admin', 'partner'].includes(role) && !hasAssetOwnerAccess) {
            return c.json({ error: 'Only partners and admins can create audience zones.' }, 403);
        }

        const body = validateRequestBody(await c.req.json(), audienceZoneCreateBodySchema, 'Audience zone details');
        const name = normalizeText(body?.name);
        const zoneCode = normalizeText(body?.zoneCode);
        const description = normalizeText(body?.description);

        if (!name) {
            return c.json({ error: 'Name is required.' }, 400);
        }

        let owner = null;
        let hardAssetId = body.hardAssetId || null;
        let sharingStatus = 'approved';

        if (hardAssetId) {
            const hardAsset = await loadHardAssetForAudienceZone(db, hardAssetId);
            if (!hardAsset || hardAsset.isDeleted) {
                return c.json({ error: 'Selected asset owner was not found.' }, 404);
            }
            if (!canManageAudienceZone(actor, { hardAssetId, hardAsset })) {
                return c.json({ error: 'Only asset Owners and Admins can create zones for this asset.' }, 403);
            }
            sharingStatus = resolveAssetZoneSharingStatus(actor, body.sharingStatus || 'local');
        } else {
            if (!['super_admin', 'regional_admin', 'partner'].includes(role)) {
                return c.json({ error: 'Select one of your assigned assets before creating an asset audience zone.' }, 400);
            }
            const ownershipMode = normalizeOwnershipMode(role, body);
            const resolved = await resolveAssetOwner(db, actor, { ...body, ownershipMode }, null);
            owner = resolved.owner;
            sharingStatus = isRegionOrSuperAdmin(actor)
                ? normalizeAudienceZoneSharingStatus(body.sharingStatus || 'approved')
                : 'approved';
        }
        await assertUniqueZoneCode(db, zoneCode);
        const approved = sharingStatus === 'approved';

        const [created] = await db.insert(audienceZones).values({
            zoneCode,
            partnerUserId: owner?.id || null,
            hardAssetId,
            sharingStatus,
            approvedByUserId: approved ? actor.id : null,
            approvedAt: approved ? new Date() : null,
            createdByUserId: actor.id,
            name,
            description,
            updatedAt: new Date(),
        }).returning({ id: audienceZones.id });

        if (body?.postalCodes !== undefined) {
            await syncAudienceZonePostalCodes(db, created.id, body.postalCodes);
        }

        const detail = await loadAudienceZoneDetail(db, created.id);
        return c.json(formatAudienceZone(detail), 201);
    } catch (err) {
        console.error('createAudienceZone Error:', err);
        return c.json({ error: err.message || 'Failed to create audience zone.' }, err.status || 500);
    }
};

export const updateAudienceZone = async (c) => {
    try {
        const actor = c.get('user');
        const id = Number.parseInt(c.req.param('id'), 10);
        if (!Number.isInteger(id)) {
            return c.json({ error: 'Invalid audience zone id.' }, 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const existing = await loadAudienceZoneDetail(db, id);
        if (!existing) {
            return c.json({ error: 'Audience zone not found.' }, 404);
        }
        if (!canManageAudienceZone(actor, existing)) {
            return c.json({ error: 'Insufficient permissions to edit this audience zone.' }, 403);
        }

        const body = validateRequestBody(await c.req.json(), audienceZoneUpdateBodySchema, 'Audience zone details');
        const role = normalizeRole(actor?.role);
        const existingSharingStatus = normalizeAudienceZoneSharingStatus(existing.sharingStatus || (existing.hardAssetId ? 'local' : 'approved'));
        if (existing.hardAssetId && existingSharingStatus === 'approved' && !isRegionOrSuperAdmin(actor)) {
            return c.json({ error: 'Approved shared zones can only be edited by Admins.' }, 403);
        }

        let nextHardAssetId = body.hardAssetId !== undefined ? (body.hardAssetId || null) : (existing.hardAssetId || null);
        let nextHardAsset = existing.hardAsset || null;
        if (nextHardAssetId && Number(nextHardAssetId) !== Number(existing.hardAssetId || 0)) {
            nextHardAsset = await loadHardAssetForAudienceZone(db, nextHardAssetId);
            if (!nextHardAsset || nextHardAsset.isDeleted) {
                return c.json({ error: 'Selected asset owner was not found.' }, 404);
            }
            if (!isRegionOrSuperAdmin(actor)) {
                return c.json({ error: 'Only Admins can move an audience zone between assets.' }, 403);
            }
            if (!canManageAudienceZone(actor, { hardAssetId: nextHardAssetId, hardAsset: nextHardAsset })) {
                return c.json({ error: 'Selected asset owner is outside your allowed scope.' }, 403);
            }
        }

        let owner = existing.ownerPartner || null;
        if (nextHardAssetId) {
            owner = null;
        } else if (role === 'partner') {
            owner = actor;
        } else if (body.partnerId !== undefined || body.ownershipMode !== undefined) {
            const ownershipMode = normalizeOwnershipMode(role, body);
            const resolved = await resolveAssetOwner(db, actor, { ...body, ownershipMode }, null);
            owner = resolved.owner;
        }

        const sharingStatus = nextHardAssetId
            ? resolveAssetZoneSharingStatus(actor, body.sharingStatus || existingSharingStatus)
            : (isRegionOrSuperAdmin(actor)
                ? normalizeAudienceZoneSharingStatus(body.sharingStatus || existingSharingStatus || 'approved')
                : existingSharingStatus);
        const approved = sharingStatus === 'approved';
        const wasApproved = existingSharingStatus === 'approved';

        const name = body?.name !== undefined ? normalizeText(body.name) : existing.name;
        const zoneCode = body?.zoneCode !== undefined ? normalizeText(body.zoneCode) : existing.zoneCode;
        const description = body?.description !== undefined ? normalizeText(body.description) : existing.description;
        if (!name) {
            return c.json({ error: 'Name is required.' }, 400);
        }

        await assertUniqueZoneCode(db, zoneCode, id);

        await db.update(audienceZones).set({
            zoneCode,
            partnerUserId: owner?.id || null,
            hardAssetId: nextHardAssetId,
            sharingStatus,
            approvedByUserId: approved ? (wasApproved ? existing.approvedByUserId : actor.id) : null,
            approvedAt: approved ? (wasApproved ? existing.approvedAt : new Date()) : null,
            name,
            description,
            updatedAt: new Date(),
        }).where(eq(audienceZones.id, id));

        if (body?.postalCodes !== undefined) {
            await syncAudienceZonePostalCodes(db, id, body.postalCodes);
        }

        const detail = await loadAudienceZoneDetail(db, id);
        return c.json(formatAudienceZone(detail));
    } catch (err) {
        console.error('updateAudienceZone Error:', err);
        return c.json({ error: err.message || 'Failed to update audience zone.' }, err.status || 500);
    }
};

export const bulkUploadAudienceZoneBoundaries = async (c) => {
    try {
        const actor = c.get('user');
        const role = normalizeRole(actor?.role);
        if (!['super_admin', 'regional_admin', 'partner'].includes(role)) {
            return c.json({ error: 'Only partners and admins can manage audience-zone boundaries.' }, 403);
        }

        const body = validateRequestBody(await c.req.json(), audienceZoneBoundaryUploadBodySchema, 'Audience-zone boundary upload');

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const zones = await loadAudienceZoneList(db);
        const visibleZones = zones.filter((zone) => canManageAudienceZone(actor, zone));
        const byId = new Map();
        const byCode = new Map();
        const byName = new Map();

        for (const zone of visibleZones) {
            byId.set(String(zone.id), zone);
            if (zone.zoneCode) byCode.set(zone.zoneCode.toLowerCase(), zone);
            if (zone.name) byName.set(zone.name.toLowerCase(), zone);
        }

        const groupedPostalCodes = new Map();
        const errors = [];
        let successfulRows = 0;

        body.rows.forEach((row, index) => {
            try {
                const reference = parseBoundaryReference(row);
                if (!reference) {
                    throw new Error('Supply audienceZoneId, zoneCode, or name.');
                }

                const targetZone = byId.get(reference) || byCode.get(reference.toLowerCase()) || byName.get(reference.toLowerCase());
                if (!targetZone) {
                    throw new Error(`Unknown audience zone reference "${reference}".`);
                }

                const rawInput = row?.postalCode ?? row?.['Postal Code'] ?? row?.postcode ?? row?.['Postcode'] ?? row?.postalcode ?? row?.['postalcode'];
                const postalCodes = parsePostalCodeListInput(rawInput);
                if (postalCodes.length === 0) {
                    throw new Error('No valid postal codes or ranges found.');
                }

                if (!groupedPostalCodes.has(targetZone.id)) {
                    groupedPostalCodes.set(targetZone.id, new Set());
                }
                
                const zoneSet = groupedPostalCodes.get(targetZone.id);
                postalCodes.forEach(code => {
                    zoneSet.add(code);
                });
                successfulRows += 1; // Count as 1 row successful regardless of expansion size
            } catch (err) {
                errors.push(`Row ${index + 2}: ${err.message}`);
            }
        });

        let updatedZones = 0;
        let assignedPostalCodes = 0;

        for (const [zoneId, postalCodeSet] of groupedPostalCodes.entries()) {
            const postalCodes = [...postalCodeSet].sort();
            await syncAudienceZonePostalCodes(db, zoneId, postalCodes);
            updatedZones += 1;
            assignedPostalCodes += postalCodes.length;
        }

        return c.json({
            successful: successfulRows,
            failed: errors.length,
            updatedZones,
            assignedPostalCodes,
            errors,
        });
    } catch (err) {
        console.error('bulkUploadAudienceZoneBoundaries Error:', err);
        return c.json({ error: err.message || 'Audience-zone boundary upload failed.' }, err.status || 500);
    }
};

export const deleteAudienceZone = async (c) => {
    try {
        const actor = c.get('user');
        const id = Number.parseInt(c.req.param('id'), 10);
        if (!Number.isInteger(id)) {
            return c.json({ error: 'Invalid audience zone id.' }, 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const existing = await loadAudienceZoneDetail(db, id);
        if (!existing) {
            return c.json({ error: 'Audience zone not found.' }, 404);
        }
        if (!canManageAudienceZone(actor, existing)) {
            return c.json({ error: 'Insufficient permissions to delete this audience zone.' }, 403);
        }
        const sharingStatus = normalizeAudienceZoneSharingStatus(existing.sharingStatus || (existing.hardAssetId ? 'local' : 'approved'));
        if (existing.hardAssetId && sharingStatus === 'approved' && !isRegionOrSuperAdmin(actor)) {
            return c.json({ error: 'Approved shared zones can only be deleted by Admins.' }, 403);
        }
        if (sharingStatus === 'approved' && await countApprovedZoneHardAssetUsage(db, id) > 1) {
            return c.json({ error: 'This shared audience zone is reused across multiple assets and cannot be deleted safely.' }, 409);
        }

        await db.delete(audienceZones).where(eq(audienceZones.id, id));
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message || 'Failed to delete audience zone.' }, err.status || 500);
    }
};

export const bulkDeleteAudienceZones = async (c) => {
    try {
        const user = c.get('user');
        if (user?.role !== 'super_admin') {
            return c.json({ error: 'Permission denied' }, 403);
        }

        const { ids } = validateRequestBody(await c.req.json(), audienceZoneBulkDeleteBodySchema, 'Audience zone delete list');

        const db = getDb(c.env);
        const normalized = ids;

        await db.delete(audienceZones).where(inArray(audienceZones.id, normalized));
        return c.json({ success: true, count: normalized.length });
    } catch (err) {
        console.error('bulkDeleteAudienceZones Error:', err);
        return c.json({ error: err.message || 'Bulk delete failed' }, err.status || 500);
    }
};
