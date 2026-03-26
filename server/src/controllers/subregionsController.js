import { getDb } from '../db/index.js';
import { subregionPostalCodes, subregions } from '../db/schema.js';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { normalizePostalCode, parsePostalCodeListInput, serializePostalCodeList } from '../utils/postalBoundaries.js';
import { normalizeRole } from '../utils/roles.js';

let ensureSubregionSchemaPromise = null;

async function ensureSubregionSchema(db, env) {
    if (!ensureSubregionSchemaPromise) {
        ensureSubregionSchemaPromise = (async () => {
            await db.execute(sql`ALTER TABLE subregions ADD COLUMN IF NOT EXISTS subregion_code VARCHAR(80)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS subregions_subregion_code_unique ON subregions (subregion_code)`);
            await ensureBoundarySchema(db, env);
        })().catch((err) => {
            ensureSubregionSchemaPromise = null;
            throw err;
        });
    }

    await ensureSubregionSchemaPromise;
}

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

function looksLikePositiveInteger(value) {
    return /^\d+$/.test(value);
}

function parseOptionalPositiveInteger(value) {
    const text = normalizeText(value);
    if (!text) return null;
    if (!looksLikePositiveInteger(text)) return Number.NaN;

    const parsed = Number.parseInt(text, 10);
    return parsed > 0 ? parsed : Number.NaN;
}

function isUniqueViolation(err) {
    return err?.code === '23505' || err?.message?.toLowerCase().includes('unique');
}

async function assertUniqueSubregionFields(db, { name, subregionCode, ignoreId = null }) {
    const [existingName] = await db
        .select({ id: subregions.id })
        .from(subregions)
        .where(eq(subregions.name, name));

    if (existingName && existingName.id !== ignoreId) {
        throw createClientError(`A subregion named "${name}" already exists.`);
    }

    if (subregionCode) {
        const [existingCode] = await db
            .select({ id: subregions.id })
            .from(subregions)
            .where(eq(subregions.subregionCode, subregionCode));

        if (existingCode && existingCode.id !== ignoreId) {
            throw createClientError(`A subregion with ID "${subregionCode}" already exists.`);
        }
    }
}

function parseOptionalPostalCodes(rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
        return { provided: false, postalCodes: [] };
    }

    return {
        provided: true,
        postalCodes: parsePostalCodeListInput(rawValue),
    };
}

function parseCreatePayload(body) {
    const id = parseOptionalPositiveInteger(body?.id);
    if (Number.isNaN(id)) {
        return { error: 'Record ID must be a positive integer.' };
    }

    const name = normalizeText(body?.name);
    if (!name) {
        return { error: 'Name is required.' };
    }

    const subregionCode = normalizeText(body?.subregionCode ?? body?.subregionId);
    const description = normalizeText(body?.description);

    try {
        const boundaryPayload = parseOptionalPostalCodes(
            body?.postalCodes
            ?? body?.boundaryPostalCodes
            ?? body?.postalPatterns
            ?? body?.postalCodeList
        );

        return {
            id,
            name,
            subregionCode,
            description,
            postalCodes: boundaryPayload.postalCodes,
            postalCodesProvided: boundaryPayload.provided,
        };
    } catch (err) {
        return { error: err.message };
    }
}

function parseBulkMetadataRow(row) {
    const rawId = normalizeText(row?.id);
    let id = null;
    let subregionCodeFromId = null;
    if (rawId) {
        if (looksLikePositiveInteger(rawId)) {
            id = Number.parseInt(rawId, 10);
        } else {
            subregionCodeFromId = rawId;
        }
    }

    const dbId = parseOptionalPositiveInteger(row?.dbId ?? row?.db_id);
    if (Number.isNaN(dbId)) {
        throw new Error('dbId must be a positive integer when supplied.');
    }
    if (dbId) {
        id = dbId;
    }

    const legacySubregionId = normalizeText(row?.subregionId ?? row?.['Subregion ID'] ?? row?.['Sub-region ID']);
    let subregionCode = normalizeText(
        row?.subregionCode
        ?? row?.subregion_code
        ?? row?.code
        ?? row?.['Subregion Code']
        ?? row?.['Sub-region Code']
    ) ?? subregionCodeFromId;

    if (!subregionCode && legacySubregionId) {
        if (!id && looksLikePositiveInteger(legacySubregionId)) {
            id = Number.parseInt(legacySubregionId, 10);
        } else {
            subregionCode = legacySubregionId;
        }
    }

    const name = normalizeText(row?.name ?? row?.Name ?? row?.subregionName ?? row?.['Sub-region']);
    if (!name) {
        throw new Error('name is required.');
    }

    const description = normalizeText(row?.description ?? row?.Description);

    const rawPostalCodes = row?.postalCodes
        ?? row?.postal_codes
        ?? row?.boundaryPostalCodes
        ?? row?.['Postal Codes'];

    const boundaryPayload = parseOptionalPostalCodes(rawPostalCodes);

    return {
        id,
        name,
        subregionCode,
        description,
        postalCodes: boundaryPayload.postalCodes,
        postalCodesProvided: boundaryPayload.provided,
    };
}

function buildSubregionReferenceMaps(list) {
    const byId = new Map();
    const byCode = new Map();
    const byName = new Map();

    for (const subregion of list) {
        byId.set(String(subregion.id), subregion);
        if (subregion.subregionCode) byCode.set(subregion.subregionCode.toLowerCase(), subregion);
        if (subregion.name) byName.set(subregion.name.toLowerCase(), subregion);
    }

    return { byId, byCode, byName };
}

function resolveSubregionReference(referenceMaps, row) {
    const dbId = normalizeText(row?.dbId ?? row?.db_id);
    if (dbId) {
        const match = referenceMaps.byId.get(dbId);
        if (match) return match;
    }

    const subregionCode = normalizeText(
        row?.subregionId
        ?? row?.subregionCode
        ?? row?.subregion_code
        ?? row?.code
        ?? row?.['Subregion ID']
        ?? row?.['Subregion Code']
    );
    if (subregionCode) {
        if (looksLikePositiveInteger(subregionCode)) {
            const idMatch = referenceMaps.byId.get(subregionCode);
            if (idMatch) return idMatch;
        }

        const codeMatch = referenceMaps.byCode.get(subregionCode.toLowerCase());
        if (codeMatch) return codeMatch;

        const nameAliasMatch = referenceMaps.byName.get(subregionCode.toLowerCase());
        if (nameAliasMatch) return nameAliasMatch;
    }

    const rawId = normalizeText(row?.id);
    if (rawId) {
        if (looksLikePositiveInteger(rawId)) {
            const idMatch = referenceMaps.byId.get(rawId);
            if (idMatch) return idMatch;
        }

        const codeMatch = referenceMaps.byCode.get(rawId.toLowerCase());
        if (codeMatch) return codeMatch;

        const nameAliasMatch = referenceMaps.byName.get(rawId.toLowerCase());
        if (nameAliasMatch) return nameAliasMatch;
    }

    const name = normalizeText(row?.name ?? row?.Name ?? row?.subregionName ?? row?.['Sub-region']);
    if (name) {
        const nameMatch = referenceMaps.byName.get(name.toLowerCase());
        if (nameMatch) return nameMatch;
    }

    return null;
}

function chunk(array, size) {
    const parts = [];
    for (let i = 0; i < array.length; i += size) {
        parts.push(array.slice(i, i + size));
    }
    return parts;
}

function getScopedSubregionIds(user) {
    return Array.isArray(user?.subregionIds)
        ? user.subregionIds.map((value) => Number.parseInt(String(value), 10)).filter(Number.isInteger)
        : [];
}

async function syncSubregionPostalCodes(db, subregionId, postalCodes) {
    const normalizedPostalCodes = [...new Set((postalCodes || []).map((value) => normalizePostalCode(value)).filter(Boolean))]
        .sort();

    await db.delete(subregionPostalCodes).where(eq(subregionPostalCodes.subregionId, subregionId));

    for (const group of chunk(normalizedPostalCodes, 5000)) {
        if (group.length === 0) continue;
        await db.insert(subregionPostalCodes).values(
            group.map((postalCode) => ({ subregionId, postalCode }))
        );
    }

    await db.update(subregions)
        .set({ postalPatterns: serializePostalCodeList(normalizedPostalCodes) })
        .where(eq(subregions.id, subregionId));
}

async function loadSubregionsWithPostalCodes(db) {
    const list = await db.query.subregions.findMany({
        orderBy: [subregions.name]
    });

    const postalRows = await db
        .select({
            subregionId: subregionPostalCodes.subregionId,
            postalCode: subregionPostalCodes.postalCode,
        })
        .from(subregionPostalCodes)
        .orderBy(subregionPostalCodes.subregionId, subregionPostalCodes.postalCode);

    const grouped = new Map();
    for (const row of postalRows) {
        if (!grouped.has(row.subregionId)) grouped.set(row.subregionId, []);
        grouped.get(row.subregionId).push(row.postalCode);
    }

    return list.map((subregion) => {
        let postalCodes = grouped.get(subregion.id) || [];
        if (postalCodes.length === 0 && subregion.postalPatterns) {
            try {
                postalCodes = parsePostalCodeListInput(subregion.postalPatterns);
            } catch {
                postalCodes = [];
            }
        }

        return {
            ...subregion,
            postalCodesList: postalCodes,
            postalCodesPreview: postalCodes.slice(0, 6),
            postalCodeCount: postalCodes.length,
        };
    });
}

export const getSubregions = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureSubregionSchema(db, c.env);

        let list = await loadSubregionsWithPostalCodes(db);
        if (user?.role === 'regional_admin' || user?.role === 'partner') {
            const scopedIds = Array.isArray(user?.subregionIds)
                ? user.subregionIds.map((value) => Number.parseInt(String(value), 10)).filter(Number.isInteger)
                : [];
            list = list.filter((subregion) => scopedIds.includes(subregion.id));
        }
        return c.json(list);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to fetch subregions' }, 500);
    }
};

export const createSubregion = async (c) => {
    try {
        const user = c.get('user');
        if (user?.role !== 'super_admin') {
            return c.json({ error: 'Only Super Admins can create subregions' }, 403);
        }

        const db = getDb(c.env);
        await ensureSubregionSchema(db, c.env);

        const payload = parseCreatePayload(await c.req.json());
        if (payload.error) {
            return c.json({ error: payload.error }, 400);
        }

        const { id, name, description, subregionCode, postalCodes, postalCodesProvided } = payload;
        await assertUniqueSubregionFields(db, { name, subregionCode, ignoreId: id });

        let result = null;
        if (id) {
            [result] = await db.update(subregions)
                .set({ name, description, subregionCode })
                .where(eq(subregions.id, id))
                .returning();

            if (!result) {
                [result] = await db.insert(subregions).values({
                    id,
                    name,
                    description,
                    subregionCode,
                }).returning();
            }
        } else {
            [result] = await db.insert(subregions).values({
                name,
                description,
                subregionCode,
            }).returning();
        }

        if (postalCodesProvided) {
            await syncSubregionPostalCodes(db, result.id, postalCodes);
        }

        const [formatted] = (await loadSubregionsWithPostalCodes(db)).filter((subregion) => subregion.id === result.id);
        return c.json(formatted || result, 201);
    } catch (err) {
        console.error('Create Subregion Error:', err);
        if (err?.status && err.status >= 400 && err.status < 500) {
            return c.json({ error: err.message }, err.status);
        }
        if (isUniqueViolation(err)) {
            return c.json({ error: err.message || 'Subregion ID or name already exists.' }, 400);
        }
        return c.json({ error: err.message || 'Failed to create subregion' }, 500);
    }
};

export const bulkCreateSubregions = async (c) => {
    try {
        const user = c.get('user');
        if (user?.role !== 'super_admin') {
            return c.json({ error: 'Permission denied' }, 403);
        }

        const body = await c.req.json();
        const { rows } = body;
        if (!Array.isArray(rows)) return c.json({ error: 'Invalid data' }, 400);

        const db = getDb(c.env);
        await ensureSubregionSchema(db, c.env);

        const results = { successful: 0, failed: 0, errors: [] };

        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            try {
                const payload = parseBulkMetadataRow(row);
                const { id, name, subregionCode, description, postalCodes, postalCodesProvided } = payload;

                let target = null;
                if (id) {
                    [target] = await db
                        .select({ id: subregions.id })
                        .from(subregions)
                        .where(eq(subregions.id, id));
                } else if (subregionCode) {
                    [target] = await db
                        .select({ id: subregions.id })
                        .from(subregions)
                        .where(eq(subregions.subregionCode, subregionCode));
                } else {
                    [target] = await db
                        .select({ id: subregions.id })
                        .from(subregions)
                        .where(eq(subregions.name, name));
                }

                const targetId = target?.id ?? id ?? null;
                await assertUniqueSubregionFields(db, {
                    name,
                    subregionCode,
                    ignoreId: targetId
                });

                let resolvedId = target?.id ?? null;
                if (target) {
                    const [updated] = await db.update(subregions)
                        .set({ name, description, subregionCode })
                        .where(eq(subregions.id, target.id))
                        .returning({ id: subregions.id });
                    if (!updated) throw new Error('Update failed');
                    resolvedId = updated.id;
                } else if (id) {
                    const [inserted] = await db.insert(subregions).values({ id, name, description, subregionCode }).returning({ id: subregions.id });
                    resolvedId = inserted.id;
                } else {
                    const [inserted] = await db.insert(subregions).values({ name, description, subregionCode }).returning({ id: subregions.id });
                    resolvedId = inserted.id;
                }

                if (postalCodesProvided && resolvedId) {
                    await syncSubregionPostalCodes(db, resolvedId, postalCodes);
                }

                results.successful++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${index + 2}: ${err.message}`);
            }
        }

        return c.json(results);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Bulk import failed' }, 500);
    }
};

export const bulkUploadSubregionBoundaries = async (c) => {
    try {
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        if (!['super_admin', 'regional_admin'].includes(role)) {
            return c.json({ error: 'Only Super Admins and Regional Admins can manage subregion boundaries.' }, 403);
        }

        const body = await c.req.json();
        const { rows, mode = 'replace', finalize = true } = body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return c.json({ error: 'Boundary CSV must include at least one row.' }, 400);
        }

        const db = getDb(c.env);
        await ensureSubregionSchema(db, c.env);

        const existingSubregions = await db
            .select({ id: subregions.id, subregionCode: subregions.subregionCode, name: subregions.name })
            .from(subregions);
        const referenceMaps = buildSubregionReferenceMaps(existingSubregions);
        const scopedSubregionIds = new Set(getScopedSubregionIds(user));

        const groupedPostalCodes = new Map();
        const errors = [];
        let successfulRows = 0;

        let lastSubregionVal = null;
        let lastSubregionRef = null;

        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            try {
                const currentSubregionVal = row?.subregionId ?? row?.subregionCode ?? row?.dbId ?? row?.name;
                let targetSubregion = (currentSubregionVal !== undefined && currentSubregionVal !== null && currentSubregionVal === lastSubregionVal)
                    ? lastSubregionRef
                    : resolveSubregionReference(referenceMaps, row);
                
                lastSubregionVal = currentSubregionVal;
                lastSubregionRef = targetSubregion;

                if (!targetSubregion) throw new Error('Unknown subregion');
                if (role === 'regional_admin' && !scopedSubregionIds.has(targetSubregion.id)) {
                    throw new Error(`Out of scope.`);
                }

                const postalCode = normalizePostalCode(row?.postalCode ?? row?.['Postal Code'] ?? row?.postcode ?? row?.['Postcode']);
                if (!postalCode) throw new Error('Invalid code.');

                if (!groupedPostalCodes.has(targetSubregion.id)) {
                    groupedPostalCodes.set(targetSubregion.id, new Set());
                }
                groupedPostalCodes.get(targetSubregion.id).add(postalCode);
                successfulRows += 1;
            } catch (err) {
                errors.push(`Row ${index + 2}: ${err.message}`);
            }
        }

        const allTargetIds = [...groupedPostalCodes.keys()];
        let updatedSubregions = 0;
        let assignedPostalCodes = 0;

        if (allTargetIds.length > 0) {
            if (mode === 'replace') {
                await db.delete(subregionPostalCodes).where(inArray(subregionPostalCodes.subregionId, allTargetIds));
            }

            const allInserts = [];
            for (const [subregionId, postalCodeSet] of groupedPostalCodes.entries()) {
                const sortedCodes = [...postalCodeSet];
                sortedCodes.forEach(postalCode => allInserts.push({ subregionId, postalCode }));
            }

            for (const insertsGroup of chunk(allInserts, 5000)) {
                await db.insert(subregionPostalCodes).values(insertsGroup).onConflictDoNothing();
            }
            assignedPostalCodes = allInserts.length;

            if (finalize) {
                for (const subregionId of allTargetIds) {
                    const postalRows = await db
                        .select({ postalCode: subregionPostalCodes.postalCode })
                        .from(subregionPostalCodes)
                        .where(eq(subregionPostalCodes.subregionId, subregionId))
                        .orderBy(subregionPostalCodes.postalCode);
                    
                    const codes = postalRows.map(r => r.postalCode);
                    await db.update(subregions)
                        .set({ postalPatterns: codes.join(', ') })
                        .where(eq(subregions.id, subregionId));
                    updatedSubregions++;
                }
            }
        }

        return c.json({
            successful: successfulRows,
            failed: errors.length,
            updatedSubregions,
            assignedPostalCodes,
            errors,
        });
    } catch (err) {
        console.error(err);
        return c.json({ error: err.message || 'Upload failed' }, 500);
    }
};

export const bulkDeleteSubregions = async (c) => {
    try {
        const user = c.get('user');
        if (user?.role !== 'super_admin') {
            return c.json({ error: 'Permission denied' }, 403);
        }

        const body = await c.req.json();
        const { ids } = body;
        if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'No IDs provided' }, 400);

        const db = getDb(c.env);
        const normalized = ids.map(normalizeText).filter(Boolean);
        const numericIds = [...new Set(normalized.filter(looksLikePositiveInteger).map((value) => Number.parseInt(value, 10)))];
        const subregionCodes = [...new Set(normalized.filter((value) => !looksLikePositiveInteger(value)))];

        if (numericIds.length === 0 && subregionCodes.length === 0) {
            return c.json({ error: 'Invalid subregion ID list.' }, 400);
        }

        const conditions = [];
        if (numericIds.length > 0) conditions.push(inArray(subregions.id, numericIds));
        if (subregionCodes.length > 0) conditions.push(inArray(subregions.subregionCode, subregionCodes));
        const whereClause = conditions.length === 1 ? conditions[0] : or(...conditions);

        const matched = await db
            .select({ id: subregions.id, subregionCode: subregions.subregionCode })
            .from(subregions)
            .where(whereClause);

        if (matched.length === 0) {
            return c.json({ error: 'No matching subregions found for deletion.' }, 404);
        }

        const matchedIds = matched.map((row) => row.id);
        await db.delete(subregions).where(inArray(subregions.id, matchedIds));

        return c.json({ success: true, deletedCount: matchedIds.length, deletedIds: matchedIds });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Bulk delete failed' }, 500);
    }
};

export const deleteSubregion = async (c) => {
    try {
        const user = c.get('user');
        if (user?.role !== 'super_admin') {
            return c.json({ error: 'Only Super Admins can delete subregions' }, 403);
        }

        const identifier = normalizeText(c.req.param('id'));
        if (!identifier) {
            return c.json({ error: 'Invalid subregion ID.' }, 400);
        }

        const db = getDb(c.env);
        const whereClause = looksLikePositiveInteger(identifier)
            ? eq(subregions.id, Number.parseInt(identifier, 10))
            : eq(subregions.subregionCode, identifier);

        const [target] = await db
            .select({ id: subregions.id, subregionCode: subregions.subregionCode })
            .from(subregions)
            .where(whereClause);

        if (!target) {
            return c.json({ error: 'Subregion not found.' }, 404);
        }

        await db.delete(subregionPostalCodes).where(eq(subregionPostalCodes.subregionId, target.id));
        const [deleted] = await db
            .delete(subregions)
            .where(eq(subregions.id, target.id))
            .returning({ id: subregions.id, subregionCode: subregions.subregionCode });

        return c.json({ success: true, deleted });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to delete subregion' }, 500);
    }
};

