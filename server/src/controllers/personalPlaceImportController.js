import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import { myMaps } from '../db/schema.js';
import { buildResourceWriteLockQuery, executeAtomicBatch } from '../utils/atomicWrites.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { cleanOneLineText, cleanText } from '../utils/inputValidation.js';
import { resolvePersonalPlaceLocation } from '../utils/personalPlaceLocation.js';
import { assertPersonalPlacesUser } from './personalPlacesController.js';

export const PERSONAL_PLACE_IMPORT_BATCH_LIMIT = 25;

const importRowSchema = z.object({
    name: z.string().trim().min(1, 'Name is required.').max(160, 'Name must be 160 characters or fewer.')
        .transform((value) => cleanOneLineText(value, 160))
        .refine(Boolean, 'Name is required.'),
    postalCode: z.string().trim().regex(/^\d{6}$/, 'Postal Code must contain exactly six digits.'),
    shortDescription: z.string().trim().max(240, 'Short Description must be 240 characters or fewer.')
        .nullable().optional().transform((value) => cleanOneLineText(value, 240) || null),
    address: z.string().trim().min(1, 'Review the address before importing.')
        .max(500, 'Address must be 500 characters or fewer.')
        .transform((value) => cleanText(value, 500))
        .refine(Boolean, 'Review the address before importing.'),
    categoryId: z.number().int().positive().max(2147483647).nullable().optional().default(null),
}).strict();

export const personalPlaceImportBodySchema = z.object({
    rows: z.array(importRowSchema).min(1, 'Choose at least one row to import.')
        .max(PERSONAL_PLACE_IMPORT_BATCH_LIMIT, 'Import at most 25 rows at a time.'),
}).strict();

function importError(status, message, rowErrors = undefined) {
    return Object.assign(new Error(message), { status, ...(rowErrors ? { rowErrors } : {}) });
}

function parseImportBody(body) {
    const parsed = personalPlaceImportBodySchema.safeParse(body);
    if (parsed.success) return parsed.data;
    const rowErrors = parsed.error.issues
        .filter((issue) => issue.path[0] === 'rows' && Number.isInteger(issue.path[1]))
        .map((issue) => ({ index: issue.path[1], error: issue.message }));
    throw importError(400, parsed.error.issues[0]?.message || 'Check the import rows.', rowErrors);
}

/**
 * Runs after the owner advisory lock in the same HTTP transaction. Content
 * matches and category/map checks are deliberately inside this statement,
 * rather than derived from a pre-lock library read. Every write is gated on
 * the complete batch being valid; the statement never changes a library place.
 */
export function buildPersonalPlaceImportQuery(userId, mapId, rows) {
    return sql`
        WITH input AS MATERIALIZED (
            SELECT row_data.*,
                lower(regexp_replace(name, '[[:space:]]+', ' ', 'g')) AS name_key,
                lower(regexp_replace(address, '[[:space:]]+', ' ', 'g')) AS address_key
            FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS row_data(
                index integer, name text, "postalCode" text, "shortDescription" text,
                address text, "categoryId" integer, lat numeric, lng numeric
            )
        ), owner_map AS MATERIALIZED (
            SELECT id FROM my_maps
            WHERE id = ${mapId} AND user_id = ${userId} FOR UPDATE
        ), categories AS MATERIALIZED (
            SELECT id, is_archived FROM user_personal_place_categories
            WHERE user_id = ${userId} AND id IN (SELECT "categoryId" FROM input)
            FOR SHARE
        ), matches AS MATERIALIZED (
            SELECT i.index, count(p.id)::integer AS match_count, min(p.id) AS place_id,
                coalesce(bool_or(p.category_id IS DISTINCT FROM i."categoryId"
                    OR (p.category_id IS NULL AND coalesce(trim(p.legacy_category_label), '') <> ''
                        AND lower(regexp_replace(trim(p.legacy_category_label), '[[:space:]]+', ' ', 'g')) <> 'personal place')
                    OR coalesce(p.short_description, p.note, '') <> coalesce(i."shortDescription", '')
                    OR p.lat <> round(i.lat, 7) OR p.lng <> round(i.lng, 7)), false) AS conflicting
            FROM input i LEFT JOIN user_personal_places p
                ON p.user_id = ${userId} AND p.postal_code = i."postalCode"
                AND lower(regexp_replace(trim(p.name), '[[:space:]]+', ' ', 'g')) = i.name_key
                AND lower(regexp_replace(trim(p.address), '[[:space:]]+', ' ', 'g')) = i.address_key
            GROUP BY i.index
        ), issues AS MATERIALIZED (
            SELECT i.index, 'Choose one of your active Personal place categories.' AS error
            FROM input i WHERE i."categoryId" IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM categories c WHERE c.id = i."categoryId" AND NOT c.is_archived
            )
            UNION ALL
            SELECT i.index, 'An existing place has different details. Reuse or edit it from My Places.'
            FROM input i JOIN matches m ON m.index = i.index
            WHERE m.match_count = 1 AND m.conflicting
            UNION ALL
            SELECT i.index, 'More than one existing place matches this row. Review My Places first.'
            FROM input i JOIN matches m ON m.index = i.index WHERE m.match_count > 1
            UNION ALL
            SELECT i.index, 'Duplicate rows have different descriptions or categories. Review these rows.'
            FROM input i WHERE EXISTS (
                SELECT 1 FROM input other WHERE other.index <> i.index
                    AND (other.name_key, other."postalCode", other.address_key)
                        = (i.name_key, i."postalCode", i.address_key)
                    AND (other."categoryId" IS DISTINCT FROM i."categoryId"
                        OR coalesce(other."shortDescription", '') <> coalesce(i."shortDescription", ''))
            )
        ), canonical AS MATERIALIZED (
            SELECT DISTINCT ON (name_key, "postalCode", address_key) * FROM input
            ORDER BY name_key, "postalCode", address_key, index
        ), created AS (
            INSERT INTO user_personal_places (
                user_id, category_id, name, address, postal_code, lat, lng, short_description
            )
            SELECT ${userId}, c."categoryId", c.name, c.address, c."postalCode", c.lat, c.lng,
                c."shortDescription"
            FROM canonical c JOIN matches m ON m.index = c.index
            WHERE m.match_count = 0 AND EXISTS (SELECT 1 FROM owner_map)
                AND NOT EXISTS (SELECT 1 FROM issues)
            RETURNING id, name, address, postal_code
        ), resolved AS MATERIALIZED (
            SELECT i.*, coalesce(m.place_id, p.id) AS place_id, p.id IS NOT NULL AS is_created,
                c.index AS first_index
            FROM input i JOIN matches m ON m.index = i.index
            JOIN canonical c ON (c.name_key, c."postalCode", c.address_key)
                = (i.name_key, i."postalCode", i.address_key)
            LEFT JOIN created p ON p.postal_code = i."postalCode"
                AND lower(regexp_replace(p.name, '[[:space:]]+', ' ', 'g')) = i.name_key
                AND lower(regexp_replace(p.address, '[[:space:]]+', ' ', 'g')) = i.address_key
            WHERE EXISTS (SELECT 1 FROM owner_map) AND NOT EXISTS (SELECT 1 FROM issues)
        ), linked AS (
            INSERT INTO my_map_personal_place_links (map_id, personal_place_id, short_descriptors)
            SELECT DISTINCT ON (r.place_id) ${mapId}, r.place_id,
                CASE WHEN r."shortDescription" IS NULL THEN '[]'::jsonb
                    ELSE jsonb_build_array(jsonb_build_object('text', r."shortDescription",
                        'textColor', NULL, 'highlightColor', NULL, 'sortOrder', 0)) END
            FROM resolved r ORDER BY r.place_id, r.index
            ON CONFLICT (map_id, personal_place_id) DO NOTHING
            RETURNING personal_place_id
        ), touched AS (
            UPDATE my_maps SET updated_at = now()
            WHERE id IN (SELECT id FROM owner_map) AND EXISTS (SELECT 1 FROM linked)
            RETURNING id
        )
        SELECT jsonb_build_object(
            'mapFound', EXISTS (SELECT 1 FROM owner_map),
            'rowErrors', coalesce((SELECT jsonb_agg(jsonb_build_object('index', index, 'error', error)
                ORDER BY index) FROM issues), '[]'::jsonb),
            'results', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'index', r.index, 'placeId', r.place_id,
                'status', CASE WHEN r.index = r.first_index AND r.is_created THEN 'created'
                    WHEN r.index = r.first_index AND l.personal_place_id IS NOT NULL THEN 'attached'
                    ELSE 'already_added' END) ORDER BY r.index)
                FROM resolved r LEFT JOIN linked l ON l.personal_place_id = r.place_id), '[]'::jsonb)
        ) AS result
    `;
}

export async function importMyMapPersonalPlaces(db, user, mapId, body, options = {}) {
    assertPersonalPlacesUser(user);
    if (!Number.isSafeInteger(user.id) || user.id <= 0 || !Number.isSafeInteger(mapId) || mapId <= 0) {
        throw importError(400, 'A valid map and account are required.');
    }
    const { rows } = parseImportBody(body);
    if (typeof db?.batch !== 'function') {
        throw importError(503, 'Import is temporarily unavailable. No places were saved.');
    }
    const ownedMap = await db.query.myMaps.findFirst({
        where: and(eq(myMaps.id, mapId), eq(myMaps.userId, user.id)),
        columns: { id: true },
    });
    if (!ownedMap) throw importError(404, 'Map not found');

    const resolveLocation = options.resolveLocation || resolvePersonalPlaceLocation;
    const locations = new Map();
    for (const postalCode of new Set(rows.map((row) => row.postalCode))) {
        try {
            const verified = await resolveLocation({ postalCode, locationMode: 'addressed' });
            if (verified.postalCode !== postalCode || !verified.address
                || !Number.isFinite(verified.lat) || Math.abs(verified.lat) > 90
                || !Number.isFinite(verified.lng) || Math.abs(verified.lng) > 180) {
                throw importError(400, 'This postal code could not be verified as an exact Singapore address.');
            }
            locations.set(postalCode, verified);
        } catch (error) {
            const message = error.status === 400 ? error.message
                : 'Postal-code verification is temporarily unavailable. No places were saved; please try again.';
            throw importError(error.status === 400 ? 400 : 503, message,
                rows.flatMap((row, index) => row.postalCode === postalCode ? [{ index, error: message }] : []));
        }
    }
    const verifiedRows = rows.map((row, index) => ({ ...row, index,
        lat: locations.get(row.postalCode).lat, lng: locations.get(row.postalCode).lng }));
    const batchResults = await executeAtomicBatch(db, [
        buildResourceWriteLockQuery(db, 'personalPlaceImport', user.id),
        db.execute(buildPersonalPlaceImportQuery(user.id, mapId, verifiedRows)),
    ], 'Personal place import');
    const row = batchResults[1]?.rows?.[0] ?? batchResults[1]?.[0];
    const outcome = row?.result ?? (Array.isArray(row) ? row[0] : undefined);
    if (!outcome || !Array.isArray(outcome.results) || !Array.isArray(outcome.rowErrors)) {
        throw importError(503, 'The import result could not be confirmed. Refresh My Places before retrying.');
    }
    if (!outcome.mapFound) throw importError(404, 'Map not found');
    if (outcome.rowErrors.length) {
        throw importError(409, 'Review the conflicting rows. No places were saved in this batch.', outcome.rowErrors);
    }
    return {
        results: outcome.results,
        createdCount: outcome.results.filter((result) => result.status === 'created').length,
        attachedCount: outcome.results.filter((result) => result.status === 'attached').length,
        skippedCount: outcome.results.filter((result) => result.status === 'already_added').length,
    };
}

export function createMyMapPersonalPlacesImportHandler(options = {}) {
    return async (c) => {
        try {
            const user = c.get('user');
            assertPersonalPlacesUser(user);
            const mapIdText = c.req.param('id');
            if (!/^[1-9]\d*$/.test(mapIdText || '')) throw importError(400, 'Map id is required');
            const mapId = Number(mapIdText);
            if (!Number.isSafeInteger(mapId)) throw importError(400, 'Map id is required');
            let body;
            try { body = await c.req.json(); }
            catch { throw importError(400, 'Provide a valid import request.'); }
            const db = (options.dbForContext || ((context) => getDb(context.env)))(c);
            await (options.ensureSchema || ensureBoundarySchema)(db, c.env);
            return c.json(await importMyMapPersonalPlaces(db, user, mapId, body, options), 201);
        } catch (error) {
            const status = [400, 403, 404, 409, 503].includes(error.status) ? error.status : 500;
            return c.json({ error: status === 500
                ? 'The import result could not be confirmed. Refresh My Places before retrying.' : error.message,
                ...(error.rowErrors ? { rowErrors: error.rowErrors } : {}) }, status);
        }
    };
}

export const postMyMapPersonalPlacesImport = createMyMapPersonalPlacesImportHandler();
