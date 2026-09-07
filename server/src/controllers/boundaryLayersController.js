import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import {
    regionPostalCodes,
    regionSubregions,
    regions,
    subregions,
    unmappedPostalCodes,
} from '../db/schema.js';
import {
    optionalTextSchema,
    positiveIntValueSchema,
    postalCodeListInputSchema,
    requiredOneLineTextSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';
import { parsePostalCodeListInput } from '../utils/postalBoundaries.js';
import { normalizeRole } from '../utils/roles.js';

const regionBoundaryBodySchema = z.object({
    name: requiredOneLineTextSchema('Region name', 160),
    description: optionalTextSchema(2000),
    postalCodes: postalCodeListInputSchema,
    subregionIds: z.array(positiveIntValueSchema('Subregion ID')).max(200).optional().default([]),
    mode: z.enum(['replace', 'append']).optional().default('append'),
});

const unmappedBoundaryBodySchema = z.object({
    postalCodes: postalCodeListInputSchema,
    mode: z.enum(['replace', 'append']).optional().default('append'),
});
const MAX_POSTAL_CODES_PER_LAYER_WRITE = 25000;

function clientError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function chunk(values, size = 5000) {
    const chunks = [];
    for (let index = 0; index < values.length; index += size) {
        chunks.push(values.slice(index, index + size));
    }
    return chunks;
}

function parseRequiredPostalCodes(value) {
    const postalCodes = parsePostalCodeListInput(value);
    if (postalCodes.length === 0) {
        throw clientError('At least one exact six-digit postal code or range is required.');
    }
    if (postalCodes.length > MAX_POSTAL_CODES_PER_LAYER_WRITE) {
        throw clientError(`A single boundary write cannot contain more than ${MAX_POSTAL_CODES_PER_LAYER_WRITE.toLocaleString()} postcodes.`);
    }
    return postalCodes.sort();
}

function getScopedSubregionIds(user) {
    return Array.isArray(user?.subregionIds)
        ? user.subregionIds
            .map((value) => Number.parseInt(String(value), 10))
            .filter(Number.isInteger)
        : [];
}

async function deleteRegionPostalCodes(db, regionId, postalCodes) {
    for (const postalCodeChunk of chunk(postalCodes)) {
        if (postalCodeChunk.length === 0) continue;
        await db.delete(regionPostalCodes).where(and(
            eq(regionPostalCodes.regionId, regionId),
            inArray(regionPostalCodes.postalCode, postalCodeChunk),
        ));
    }
}

async function deleteUnmappedPostalCodes(db, postalCodes) {
    for (const postalCodeChunk of chunk(postalCodes)) {
        if (postalCodeChunk.length === 0) continue;
        await db.delete(unmappedPostalCodes).where(inArray(unmappedPostalCodes.postalCode, postalCodeChunk));
    }
}

async function loadBoundaryLayerSummary(db, user, options = {}) {
    const role = normalizeRole(user?.role);
    const scopedIds = new Set(getScopedSubregionIds(user));
    const [subregionRows, regionSubregionRows] = await Promise.all([
        db.select({
            id: subregions.id,
            subregionCode: subregions.subregionCode,
            name: subregions.name,
        }).from(subregions).orderBy(subregions.name),
        db.select({
            regionId: regionSubregions.regionId,
            subregionId: regionSubregions.subregionId,
        }).from(regionSubregions),
    ]);
    const regionIdBySubregionId = new Map(
        regionSubregionRows.map((row) => [Number(row.subregionId), Number(row.regionId)]),
    );
    const allSubregions = subregionRows.map((subregion) => ({
        ...subregion,
        regionId: regionIdBySubregionId.get(Number(subregion.id)) || null,
    }));
    const visibleSubregions = role === 'super_admin'
        ? allSubregions
        : allSubregions.filter((subregion) => scopedIds.has(Number(subregion.id)));
    const visibleRegionIds = new Set(
        visibleSubregions.map((subregion) => Number(subregion.regionId)).filter(Number.isInteger),
    );

    const includeUnmappedPostalCodes = role === 'super_admin' && options.includeUnmappedPostalCodes === true;
    const [allRegions, regionCounts, unmappedCountRows, unmappedRows] = await Promise.all([
        db.select({ id: regions.id, name: regions.name, description: regions.description })
            .from(regions)
            .orderBy(regions.name),
        db.select({
            regionId: regionPostalCodes.regionId,
            postalCodeCount: sql`count(*)`.mapWith(Number),
        }).from(regionPostalCodes).groupBy(regionPostalCodes.regionId),
        role === 'super_admin'
            ? db.select({ postalCodeCount: sql`count(*)`.mapWith(Number) }).from(unmappedPostalCodes)
            : Promise.resolve([{ postalCodeCount: 0 }]),
        includeUnmappedPostalCodes
            ? db.select({ postalCode: unmappedPostalCodes.postalCode })
                .from(unmappedPostalCodes)
                .orderBy(unmappedPostalCodes.postalCode)
            : Promise.resolve([]),
    ]);
    const countsByRegionId = new Map(regionCounts.map((row) => [Number(row.regionId), Number(row.postalCodeCount || 0)]));
    const subregionIdsByRegionId = new Map();
    for (const subregion of visibleSubregions) {
        const regionId = Number(subregion.regionId);
        if (!Number.isInteger(regionId)) continue;
        if (!subregionIdsByRegionId.has(regionId)) subregionIdsByRegionId.set(regionId, []);
        subregionIdsByRegionId.get(regionId).push(subregion.id);
    }

    return {
        regions: allRegions
            .filter((region) => role === 'super_admin' || visibleRegionIds.has(Number(region.id)))
            .map((region) => ({
                ...region,
                postalCodeCount: countsByRegionId.get(Number(region.id)) || 0,
                subregionIds: subregionIdsByRegionId.get(Number(region.id)) || [],
            })),
        subregions: visibleSubregions.map((subregion) => ({
            ...subregion,
            systemFallback: String(subregion.subregionCode || '').toUpperCase() === 'SIN'
                && String(subregion.name || '').trim().toLowerCase() === 'singapore',
        })),
        unmapped: role === 'super_admin'
            ? {
                name: 'Unmapped',
                postalCodeCount: Number(unmappedCountRows[0]?.postalCodeCount || 0),
                postalCodesList: unmappedRows.map((row) => row.postalCode),
            }
            : null,
    };
}

export const getBoundaryLayers = async (c) => {
    try {
        return c.json(await loadBoundaryLayerSummary(getDb(c.env), c.get('user'), {
            includeUnmappedPostalCodes: String(c.req.query('includeUnmappedPostalCodes') || '').toLowerCase() === 'true',
        }));
    } catch (error) {
        console.error('Get boundary layers error:', error);
        return c.json({ error: 'Failed to fetch boundary layers.' }, 500);
    }
};

export const upsertRegionBoundary = async (c) => {
    try {
        const user = c.get('user');
        if (normalizeRole(user?.role) !== 'super_admin') {
            return c.json({ error: 'Only Super Admins can replace Region boundaries.' }, 403);
        }

        const body = validateRequestBody(await c.req.json(), regionBoundaryBodySchema, 'Region boundary');
        const postalCodes = parseRequiredPostalCodes(body.postalCodes);
        const requestedSubregionIds = [...new Set(body.subregionIds)];
        const db = getDb(c.env);

        const matchedSubregions = requestedSubregionIds.length > 0
            ? await db.select({ id: subregions.id }).from(subregions).where(inArray(subregions.id, requestedSubregionIds))
            : [];
        if (matchedSubregions.length !== requestedSubregionIds.length) {
            throw clientError('One or more Subregions in this Region are not configured.');
        }

        let [region] = await db.select().from(regions).where(
            sql`lower(${regions.name}) = lower(${body.name})`,
        );
        if (!region) {
            [region] = await db.insert(regions).values({
                name: body.name,
                description: body.description || null,
            }).returning();
        } else if (body.description !== undefined) {
            [region] = await db.update(regions)
                .set({ description: body.description || null })
                .where(eq(regions.id, region.id))
                .returning();
        }

        const existingPostalRows = body.mode === 'replace'
            ? await db.select({ postalCode: regionPostalCodes.postalCode })
                .from(regionPostalCodes)
                .where(eq(regionPostalCodes.regionId, region.id))
            : [];
        const requestedPostalSet = new Set(postalCodes);

        for (const postalCodeChunk of chunk(postalCodes)) {
            await db.update(regionPostalCodes)
                .set({ regionId: region.id })
                .where(inArray(regionPostalCodes.postalCode, postalCodeChunk));
            await db.insert(regionPostalCodes)
                .values(postalCodeChunk.map((postalCode) => ({ regionId: region.id, postalCode })))
                .onConflictDoNothing();
            await deleteUnmappedPostalCodes(db, postalCodeChunk);
        }

        if (body.mode === 'replace') {
            const stalePostalCodes = existingPostalRows
                .map((row) => row.postalCode)
                .filter((postalCode) => !requestedPostalSet.has(postalCode));
            await deleteRegionPostalCodes(db, region.id, stalePostalCodes);

            const existingLinkedSubregions = await db
                .select({ id: regionSubregions.subregionId })
                .from(regionSubregions)
                .where(eq(regionSubregions.regionId, region.id));
            const requestedIdSet = new Set(requestedSubregionIds);
            const staleSubregionIds = existingLinkedSubregions
                .map((row) => row.id)
                .filter((id) => !requestedIdSet.has(id));
            for (const idChunk of chunk(staleSubregionIds)) {
                await db.delete(regionSubregions).where(and(
                    eq(regionSubregions.regionId, region.id),
                    inArray(regionSubregions.subregionId, idChunk),
                ));
            }
        }

        for (const idChunk of chunk(requestedSubregionIds)) {
            await db.delete(regionSubregions).where(inArray(regionSubregions.subregionId, idChunk));
            await db.insert(regionSubregions)
                .values(idChunk.map((subregionId) => ({ regionId: region.id, subregionId })))
                .onConflictDoNothing();
        }

        return c.json({
            success: true,
            region: {
                id: region.id,
                name: region.name,
                postalCodeCount: postalCodes.length,
                subregionCount: requestedSubregionIds.length,
            },
        });
    } catch (error) {
        console.error('Region boundary upload error:', error);
        return c.json({ error: error.message || 'Region boundary upload failed.' }, error.status || 500);
    }
};

export const replaceUnmappedBoundary = async (c) => {
    try {
        const user = c.get('user');
        if (normalizeRole(user?.role) !== 'super_admin') {
            return c.json({ error: 'Only Super Admins can replace the Unmapped boundary.' }, 403);
        }

        const body = validateRequestBody(await c.req.json(), unmappedBoundaryBodySchema, 'Unmapped boundary');
        const postalCodes = parseRequiredPostalCodes(body.postalCodes);
        const db = getDb(c.env);
        const existingRows = body.mode === 'replace'
            ? await db.select({ postalCode: unmappedPostalCodes.postalCode }).from(unmappedPostalCodes)
            : [];
        const requestedSet = new Set(postalCodes);

        for (const postalCodeChunk of chunk(postalCodes)) {
            await db.insert(unmappedPostalCodes)
                .values(postalCodeChunk.map((postalCode) => ({ postalCode })))
                .onConflictDoNothing();
            await db.delete(regionPostalCodes).where(inArray(regionPostalCodes.postalCode, postalCodeChunk));
        }

        if (body.mode === 'replace') {
            const stalePostalCodes = existingRows
                .map((row) => row.postalCode)
                .filter((postalCode) => !requestedSet.has(postalCode));
            await deleteUnmappedPostalCodes(db, stalePostalCodes);
        }

        return c.json({ success: true, postalCodeCount: postalCodes.length });
    } catch (error) {
        console.error('Unmapped boundary upload error:', error);
        return c.json({ error: error.message || 'Unmapped boundary upload failed.' }, error.status || 500);
    }
};
