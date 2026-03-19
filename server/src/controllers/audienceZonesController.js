import { desc, eq } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { audienceZones } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    canManageAudienceZone,
    syncAudienceZonePostalCodes,
} from '../utils/audienceZones.js';
import { normalizePostalCode } from '../utils/postalBoundaries.js';
import { normalizeRole } from '../utils/roles.js';
import { normalizeOwnershipMode, resolveAssetOwner } from '../utils/softAssetScope.js';

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
        ?? row?.zoneCode
        ?? row?.zone_code
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

        if (!['super_admin', 'regional_admin', 'partner'].includes(role)) {
            return c.json({ error: 'Only partners and admins can manage audience zones.' }, 403);
        }

        const zones = await loadAudienceZoneList(db);
        const visible = zones
            .filter((zone) => canManageAudienceZone(actor, zone))
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

        if (!['super_admin', 'regional_admin', 'partner'].includes(role)) {
            return c.json({ error: 'Only partners and admins can create audience zones.' }, 403);
        }

        const body = await c.req.json();
        const name = normalizeText(body?.name);
        const zoneCode = normalizeText(body?.zoneCode);
        const description = normalizeText(body?.description);

        if (!name) {
            return c.json({ error: 'Name is required.' }, 400);
        }

        const ownershipMode = normalizeOwnershipMode(role, body);
        const { owner } = await resolveAssetOwner(db, actor, { ...body, ownershipMode }, null);
        await assertUniqueZoneCode(db, zoneCode);

        const [created] = await db.insert(audienceZones).values({
            zoneCode,
            partnerUserId: owner?.id || null,
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

        const body = await c.req.json();
        const role = normalizeRole(actor?.role);
        let owner = existing.ownerPartner || null;
        if (role === 'partner') {
            owner = actor;
        } else if (body.partnerId !== undefined || body.ownershipMode !== undefined) {
            const ownershipMode = normalizeOwnershipMode(role, body);
            const resolved = await resolveAssetOwner(db, actor, { ...body, ownershipMode }, null);
            owner = resolved.owner;
        }

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

        const body = await c.req.json();
        if (!Array.isArray(body?.rows) || body.rows.length === 0) {
            return c.json({ error: 'Boundary CSV must include at least one row.' }, 400);
        }

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

                const postalCode = normalizePostalCode(row?.postalCode ?? row?.['Postal Code'] ?? row?.postcode ?? row?.['Postcode']);
                if (!postalCode) {
                    throw new Error('postalCode must be a valid 6-digit code.');
                }

                if (!groupedPostalCodes.has(targetZone.id)) {
                    groupedPostalCodes.set(targetZone.id, new Set());
                }
                groupedPostalCodes.get(targetZone.id).add(postalCode);
                successfulRows += 1;
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

        await db.delete(audienceZones).where(eq(audienceZones.id, id));
        return c.json({ success: true });
    } catch (err) {
        console.error('deleteAudienceZone Error:', err);
        return c.json({ error: err.message || 'Failed to delete audience zone.' }, err.status || 500);
    }
};
