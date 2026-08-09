import { and, eq } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { myMapStudioDocuments, myMaps } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    MAP_STUDIO_SCHEMA_VERSION,
    buildMapStudioStoredDocument,
    formatMapStudioDocument,
    validateMapStudioDocumentInput,
} from '../utils/mapStudioDocument.js';
import { normalizeRole } from '../utils/roles.js';

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function assertMapStudioUser(user) {
    if (!user?.id || normalizeRole(user?.role) === 'guest') {
        throw createHttpError(403, 'Only authenticated non-guest users can manage Map Studio designs');
    }
}

function parseMapId(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function requireOwnedMap(db, userId, mapId) {
    const map = await db.query.myMaps.findFirst({
        where: and(
            eq(myMaps.id, mapId),
            eq(myMaps.userId, userId),
        ),
        columns: {
            id: true,
        },
    });
    if (!map) {
        throw createHttpError(404, 'Map not found');
    }
    return map;
}

function createRevisionConflict() {
    return createHttpError(
        409,
        'Map Studio design changed in another session. Reload and try again.',
    );
}

export async function getMapStudioDocument(db, user, mapId) {
    assertMapStudioUser(user);
    await requireOwnedMap(db, user.id, mapId);
    const row = await db.query.myMapStudioDocuments.findFirst({
        where: eq(myMapStudioDocuments.mapId, mapId),
    });
    return formatMapStudioDocument(mapId, row || null);
}

export async function replaceMapStudioDocument(db, user, mapId, body) {
    assertMapStudioUser(user);
    await requireOwnedMap(db, user.id, mapId);

    const validated = validateMapStudioDocumentInput(body);
    const storedDocument = buildMapStudioStoredDocument(validated);
    const timestamp = new Date();
    let savedRows;

    if (validated.revision === 0) {
        savedRows = await db.insert(myMapStudioDocuments)
            .values({
                mapId,
                schemaVersion: MAP_STUDIO_SCHEMA_VERSION,
                document: storedDocument,
                revision: 1,
                createdAt: timestamp,
                updatedAt: timestamp,
            })
            .onConflictDoNothing({ target: myMapStudioDocuments.mapId })
            .returning();
    } else {
        savedRows = await db.update(myMapStudioDocuments)
            .set({
                schemaVersion: MAP_STUDIO_SCHEMA_VERSION,
                document: storedDocument,
                revision: validated.revision + 1,
                updatedAt: timestamp,
            })
            .where(and(
                eq(myMapStudioDocuments.mapId, mapId),
                eq(myMapStudioDocuments.revision, validated.revision),
            ))
            .returning();
    }

    const [saved] = savedRows || [];
    if (!saved) {
        throw createRevisionConflict();
    }
    return formatMapStudioDocument(mapId, saved);
}

export const getMyMapStudio = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        return c.json(await getMapStudioDocument(db, user, mapId));
    } catch (err) {
        console.error('getMyMapStudio Error:', err);
        return c.json({ error: err.message || 'Failed to fetch Map Studio design' }, err.status || 500);
    }
};

export const putMyMapStudio = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        return c.json(await replaceMapStudioDocument(db, user, mapId, await c.req.json()));
    } catch (err) {
        console.error('putMyMapStudio Error:', err);
        return c.json({ error: err.message || 'Failed to save Map Studio design' }, err.status || 500);
    }
};
