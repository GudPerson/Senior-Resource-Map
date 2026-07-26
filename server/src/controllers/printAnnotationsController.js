import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import {
    myMapPrintAnnotationDocuments,
    myMaps,
} from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { normalizeRole } from '../utils/roles.js';
import { validateRequestBody } from '../utils/inputValidation.js';

export const PRINT_ANNOTATION_SCHEMA_VERSION = 1;
export const PRINT_ANNOTATION_MAX_COUNT = 100;
export const PRINT_ANNOTATION_MAX_POINTS = 500;
export const PRINT_ANNOTATION_MAX_CONTROL_POINTS = 60;
export const PRINT_ANNOTATION_MAX_TOTAL_POINTS = 2000;
export const PRINT_ANNOTATION_MAX_TEXT_LENGTH = 240;

const annotationTypes = [
    'pin',
    'line',
    'rectangle',
    'circle',
    'polygon',
];

const coordinateSchema = z.tuple([
    z.number().finite().min(-90).max(90),
    z.number().finite().min(-180).max(180),
]);

const annotationStyleSchema = z.object({
    color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#0F766E'),
    fillColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#14B8A6'),
    fillOpacity: z.number().finite().min(0).max(0.6).default(0.14),
    weight: z.number().int().min(1).max(12).default(3),
    dashed: z.boolean().default(false),
    textColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#0F172A'),
    fontSize: z.number().int().min(10).max(32).default(14),
});

const printAnnotationSchema = z.object({
    id: z.string().trim().min(1).max(80).regex(/^[a-z0-9_-]+$/i),
    type: z.enum(annotationTypes),
    points: z.array(coordinateSchema).min(1).max(PRINT_ANNOTATION_MAX_POINTS),
    controlPoints: z.array(coordinateSchema)
        .min(3)
        .max(PRINT_ANNOTATION_MAX_CONTROL_POINTS)
        .optional(),
    text: z.string().trim().max(PRINT_ANNOTATION_MAX_TEXT_LENGTH).default(''),
    style: annotationStyleSchema,
}).superRefine((annotation, context) => {
    const pointCount = annotation.points.length;
    const expected = {
        pin: [1, 1],
        line: [2, 2],
        rectangle: [2, 2],
        circle: [2, 2],
        polygon: [3, PRINT_ANNOTATION_MAX_POINTS],
    }[annotation.type];

    if (pointCount < expected[0] || pointCount > expected[1]) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['points'],
            message: `${annotation.type} annotation has an invalid number of points`,
        });
    }

    if (annotation.type === 'pin' && !annotation.text) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['text'],
            message: `${annotation.type} annotation requires text`,
        });
    }

    if (annotation.controlPoints && annotation.type !== 'polygon') {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['controlPoints'],
            message: 'Control points are only supported for polygon annotations',
        });
    }

});

const replacePrintAnnotationsBodySchema = z.object({
    schemaVersion: z.literal(PRINT_ANNOTATION_SCHEMA_VERSION),
    revision: z.number().int().min(0).optional(),
    annotations: z.array(printAnnotationSchema).max(PRINT_ANNOTATION_MAX_COUNT),
}).superRefine((document, context) => {
    const ids = new Set();
    let totalPoints = 0;
    document.annotations.forEach((annotation, index) => {
        totalPoints += annotation.points.length + (annotation.controlPoints?.length || 0);
        if (ids.has(annotation.id)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['annotations', index, 'id'],
                message: 'Annotation ids must be unique',
            });
        }
        ids.add(annotation.id);
    });
    if (totalPoints > PRINT_ANNOTATION_MAX_TOTAL_POINTS) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['annotations'],
            message: `Annotations may contain at most ${PRINT_ANNOTATION_MAX_TOTAL_POINTS} total points`,
        });
    }
});

export function validatePrintAnnotationDocumentInput(body) {
    return validateRequestBody(
        body,
        replacePrintAnnotationsBodySchema,
        'Print annotations',
    );
}

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function assertPrintAnnotationUser(user) {
    if (!user?.id || normalizeRole(user.role) === 'guest') {
        throw createHttpError(403, 'Only authenticated non-guest users can manage print annotations');
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

function formatDocument(mapId, document = null) {
    return {
        mapId,
        schemaVersion: PRINT_ANNOTATION_SCHEMA_VERSION,
        annotations: Array.isArray(document?.annotations) ? document.annotations : [],
        revision: Number.isInteger(Number(document?.revision)) ? Number(document.revision) : 0,
        updatedAt: document?.updatedAt || null,
    };
}

export async function getPrintAnnotationDocument(db, user, mapId) {
    assertPrintAnnotationUser(user);
    await requireOwnedMap(db, user.id, mapId);
    const document = await db.query.myMapPrintAnnotationDocuments.findFirst({
        where: eq(myMapPrintAnnotationDocuments.mapId, mapId),
    });
    return formatDocument(mapId, document);
}

export async function replacePrintAnnotationDocument(db, user, mapId, body) {
    assertPrintAnnotationUser(user);
    await requireOwnedMap(db, user.id, mapId);

    const current = await db.query.myMapPrintAnnotationDocuments.findFirst({
        where: eq(myMapPrintAnnotationDocuments.mapId, mapId),
    });
    const currentRevision = Number(current?.revision || 0);
    if (body.revision !== undefined && body.revision !== currentRevision) {
        throw createHttpError(409, 'Print annotations changed in another session. Reload and try again.');
    }

    const timestamp = new Date();
    const nextRevision = currentRevision + 1;
    let saved;
    if (current) {
        [saved] = await db.update(myMapPrintAnnotationDocuments)
            .set({
                schemaVersion: PRINT_ANNOTATION_SCHEMA_VERSION,
                annotations: body.annotations,
                revision: nextRevision,
                updatedAt: timestamp,
            })
            .where(eq(myMapPrintAnnotationDocuments.mapId, mapId))
            .returning();
    } else {
        [saved] = await db.insert(myMapPrintAnnotationDocuments)
            .values({
                mapId,
                schemaVersion: PRINT_ANNOTATION_SCHEMA_VERSION,
                annotations: body.annotations,
                revision: nextRevision,
                createdAt: timestamp,
                updatedAt: timestamp,
            })
            .returning();
    }

    return formatDocument(mapId, saved);
}

export const getMyMapPrintAnnotations = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        return c.json(await getPrintAnnotationDocument(db, user, mapId));
    } catch (err) {
        console.error('getMyMapPrintAnnotations Error:', err);
        return c.json({ error: err.message || 'Failed to fetch print annotations' }, err.status || 500);
    }
};

export const putMyMapPrintAnnotations = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const body = validatePrintAnnotationDocumentInput(await c.req.json());
        return c.json(await replacePrintAnnotationDocument(db, user, mapId, body));
    } catch (err) {
        console.error('putMyMapPrintAnnotations Error:', err);
        return c.json({ error: err.message || 'Failed to save print annotations' }, err.status || 500);
    }
};
