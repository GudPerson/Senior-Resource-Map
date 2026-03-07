import { getDb } from '../db/index.js';
import { subregions } from '../db/schema.js';
import { eq, inArray, or, sql } from 'drizzle-orm';

let ensureSubregionSchemaPromise = null;

async function ensureSubregionSchema(db) {
    if (!ensureSubregionSchemaPromise) {
        ensureSubregionSchemaPromise = (async () => {
            await db.execute(sql`ALTER TABLE subregions ADD COLUMN IF NOT EXISTS subregion_code VARCHAR(80)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS subregions_subregion_code_unique ON subregions (subregion_code)`);
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

    return { id, name, subregionCode, description };
}

function parseBulkRow(row) {
    const rawId = normalizeText(row?.id);
    let id = null;
    let subregionCodeFromId = null;
    if (rawId) {
        if (looksLikePositiveInteger(rawId)) {
            id = Number.parseInt(rawId, 10);
        } else {
            // Allow CSV files that place the human-readable subregion ID code in "id"
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

    // Backward compatibility: older CSVs used subregionId as the numeric DB id.
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
    return { id, name, subregionCode, description };
}

export const getSubregions = async (c) => {
    try {
        const db = getDb(c.env);
        await ensureSubregionSchema(db);

        const list = await db.query.subregions.findMany({
            orderBy: [subregions.name]
        });
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
        await ensureSubregionSchema(db);

        const payload = parseCreatePayload(await c.req.json());
        if (payload.error) {
            return c.json({ error: payload.error }, 400);
        }

        const { id, name, description, subregionCode } = payload;
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
                    subregionCode
                }).returning();
            }
        } else {
            [result] = await db.insert(subregions).values({
                name,
                description,
                subregionCode
            }).returning();
        }

        return c.json(result, 201);
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
        await ensureSubregionSchema(db);

        const results = { successful: 0, failed: 0, errors: [] };

        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            try {
                const payload = parseBulkRow(row);
                const { id, name, subregionCode, description } = payload;

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

                if (target) {
                    const [updated] = await db.update(subregions)
                        .set({ name, description, subregionCode })
                        .where(eq(subregions.id, target.id))
                        .returning();
                    if (!updated) throw new Error('Update failed');
                } else if (id) {
                    await db.insert(subregions).values({ id, name, description, subregionCode });
                } else {
                    await db.insert(subregions).values({ name, description, subregionCode });
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

        const [deleted] = await db
            .delete(subregions)
            .where(whereClause)
            .returning({ id: subregions.id, subregionCode: subregions.subregionCode });

        if (!deleted) {
            return c.json({ error: 'Subregion not found.' }, 404);
        }

        return c.json({ success: true, deleted });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to delete subregion' }, 500);
    }
};
