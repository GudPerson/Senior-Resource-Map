import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ANNOTATION_RESOURCE_GLOW_COLOR_PATTERN } from '../../../shared/annotationAppearance.js';
import { KML_MAX_GEOMETRY_POINTS, normalizeKmlBoundaryParts } from '../../../shared/kmlBoundaryGeometry.js';

import { getDb } from '../db/index.js';
import {
    myMapPrintAnnotationDocuments,
    myMaps,
} from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { normalizeRole } from '../utils/roles.js';
import { validateRequestBody } from '../utils/inputValidation.js';
import { detachInvalidAnnotationResourceLinks, loadMapAnnotationResourceKeys,
    PRINT_ANNOTATION_MAX_RESOURCE_LINKS, PRINT_ANNOTATION_MAX_TOTAL_RESOURCE_LINKS } from '../utils/mapAnnotationResources.js';
import { createPrivateMapMediaRepository, MAP_MEDIA_MAX_COUNT, MAP_MEDIA_MAX_PIXELS, MAP_MEDIA_MAX_SIDE } from '../utils/privateMapMedia.js';

export const PRINT_ANNOTATION_SCHEMA_VERSION = 1;
export const PRINT_ANNOTATION_MAX_COUNT = 100;
export const PRINT_ANNOTATION_MAX_POINTS = 500;
export const PRINT_ANNOTATION_MAX_CONTROL_POINTS = 200;
export const PRINT_ANNOTATION_MAX_TOTAL_POINTS = 20000;
export const PRINT_ANNOTATION_MAX_TEXT_LENGTH = 240;

const annotationTypes = [
    'pin',
    'line',
    'rectangle',
    'circle',
    'polygon',
    'image',
];

const coordinateSchema = z.tuple([
    z.number().finite().min(-90).max(90),
    z.number().finite().min(-180).max(180),
]);

const annotationStyleSchema = z.object({
    color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#0F766E'),
    fillColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#14B8A6'),
    fillOpacity: z.number().finite().min(0).max(1).default(0.14),
    weight: z.number().finite().min(0).max(12).default(3),
    strokeOpacity: z.number().finite().min(0).max(1).optional(),
    dashed: z.boolean().default(false),
    textColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#0F172A'),
    fontSize: z.number().int().min(10).max(32).default(14),
});

const printAnnotationSchema = z.object({
    id: z.string().trim().min(1).max(80).regex(/^[a-z0-9_-]+$/i),
    type: z.enum(annotationTypes),
    isShared: z.boolean().optional(),
    boundarySource: z.literal('kml').optional(),
    points: z.array(coordinateSchema).min(1).max(KML_MAX_GEOMETRY_POINTS),
    controlPoints: z.array(coordinateSchema)
        .min(3)
        .max(KML_MAX_GEOMETRY_POINTS)
        .optional(),
    boundaryParts: z.array(z.array(z.number().int().min(3)).min(1)).min(1).optional(),
    rotationDegrees: z.number().finite().min(-180).max(180).optional(),
    text: z.string().trim().max(PRINT_ANNOTATION_MAX_TEXT_LENGTH).default(''),
    style: annotationStyleSchema,
    resourceLinks: z.array(z.object({ type: z.enum(['hard', 'soft', 'personal_place']), id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict())
        .max(PRINT_ANNOTATION_MAX_RESOURCE_LINKS).optional(),
    resourceBehaviour: z.enum(['appear', 'pulse', 'highlight']).optional(),
    resourceGlowColor: z.string().regex(ANNOTATION_RESOURCE_GLOW_COLOR_PATTERN).transform(value => value.toLowerCase()).optional(),
    imageBorder: z.boolean().optional(),
    image: z.object({ assetId: z.string().regex(/^[a-f0-9]{64}$/), width: z.number().int().min(1).max(MAP_MEDIA_MAX_SIDE),
        height: z.number().int().min(1).max(MAP_MEDIA_MAX_SIDE), alt: z.string().trim().max(240).default('') }).strict().optional(),
}).superRefine((annotation, context) => {
    if (annotation.boundarySource !== undefined) {
        if (annotation.type !== 'polygon' || annotation.isShared === true) context.addIssue({
            code: z.ZodIssueCode.custom, path: ['boundarySource'], message: 'Imported boundaries must be private polygons',
        });
        if (!annotation.controlPoints || annotation.points.length !== annotation.controlPoints.length
            || annotation.points.some((point, index) => point[0] !== annotation.controlPoints[index][0]
                || point[1] !== annotation.controlPoints[index][1])) context.addIssue({
            code: z.ZodIssueCode.custom, path: ['controlPoints'], message: 'Imported boundary corners must be retained exactly',
        });
        if (!normalizeKmlBoundaryParts(annotation.boundaryParts, annotation.points.length)) context.addIssue({
            code: z.ZodIssueCode.custom, path: ['boundaryParts'], message: 'Imported polygon parts must retain every ring and contain at most 1,000 corners each',
        });
    } else if (!Number.isInteger(annotation.style.weight) || annotation.style.weight < 1
        || annotation.style.fillOpacity > 0.6 || annotation.style.strokeOpacity !== undefined) context.addIssue({
        code: z.ZodIssueCode.custom, path: ['style'], message: 'Drawing styles require an integer width and fill opacity at most 0.6',
    });
    const pointCount = annotation.points.length;
    const expected = {
        pin: [1, 1],
        line: [2, 2],
        rectangle: [2, 2],
        circle: [2, 2],
        polygon: [3, annotation.boundarySource === 'kml' ? KML_MAX_GEOMETRY_POINTS : PRINT_ANNOTATION_MAX_POINTS],
        image: [2, 2],
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
    if (!annotation.boundarySource && (annotation.controlPoints?.length > PRINT_ANNOTATION_MAX_CONTROL_POINTS || annotation.boundaryParts !== undefined)) context.addIssue({
        code: z.ZodIssueCode.custom, path: ['controlPoints'], message: 'Drawings retain their original control-point limits and cannot contain imported ring metadata',
    });

    if (
        annotation.rotationDegrees !== undefined
        && !['rectangle', 'circle', 'polygon'].includes(annotation.type)
    ) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rotationDegrees'],
            message: 'Rotation angles are only supported for area-shape annotations',
        });
    }

    const linkKeys = annotation.resourceLinks?.map((link) => `${link.type}:${link.id}`) || [];
    if (new Set(linkKeys).size !== linkKeys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['resourceLinks'], message: 'Linked resources must be unique' });
    if (annotation.type === 'image') {
        if (!annotation.image || annotation.isShared === true) context.addIssue({ code: z.ZodIssueCode.custom, path: ['image'], message: 'Map images must remain private and reference an uploaded image' });
        if (annotation.image && annotation.image.width * annotation.image.height > MAP_MEDIA_MAX_PIXELS) context.addIssue({ code: z.ZodIssueCode.custom, path: ['image'], message: 'Map images may contain at most 4 million pixels' });
        if (annotation.points.length === 2 && (annotation.points[0][0] >= annotation.points[1][0] || annotation.points[0][1] >= annotation.points[1][1])) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['points'], message: 'Image bounds must be ordered southwest to northeast with a positive area' });
        }
    } else if (annotation.image) context.addIssue({ code: z.ZodIssueCode.custom, path: ['image'], message: 'Image metadata is only supported on image annotations' });
    if (annotation.type !== 'image' && annotation.imageBorder !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ['imageBorder'], message: 'Image borders are only supported on image annotations' });
}).transform((annotation) => {
    const { resourceLinks, resourceBehaviour, resourceGlowColor, imageBorder, ...rest } = annotation;
    return { ...rest, ...(annotation.type === 'image' || annotation.boundarySource ? { isShared: false } : {}),
        ...(annotation.type === 'image' && imageBorder === true ? { imageBorder: true } : {}),
        ...(resourceLinks?.length ? { resourceLinks, resourceBehaviour: resourceBehaviour || 'highlight',
            ...(resourceGlowColor ? { resourceGlowColor } : {}) } : {}) };
});

const replacePrintAnnotationsBodySchema = z.object({
    schemaVersion: z.literal(PRINT_ANNOTATION_SCHEMA_VERSION),
    revision: z.number().int().min(0).optional(),
    annotations: z.array(printAnnotationSchema).max(PRINT_ANNOTATION_MAX_COUNT),
}).superRefine((document, context) => {
    const ids = new Set();
    let totalPoints = 0;
    let totalLinks = 0;
    document.annotations.forEach((annotation, index) => {
        totalPoints += annotation.points.length + (annotation.controlPoints?.length || 0);
        totalLinks += annotation.resourceLinks?.length || 0;
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
    if (totalLinks > PRINT_ANNOTATION_MAX_TOTAL_RESOURCE_LINKS) context.addIssue({ code: z.ZodIssueCode.custom, path: ['annotations'], message: 'Annotations may link at most 2000 total resources' });
    if (document.annotations.filter((annotation) => annotation.type === 'image').length > MAP_MEDIA_MAX_COUNT) context.addIssue({ code: z.ZodIssueCode.custom, path: ['annotations'], message: 'A map may contain at most 20 image annotations' });
});

export function validatePrintAnnotationDocumentInput(body) {
    return validateRequestBody(
        body,
        replacePrintAnnotationsBodySchema,
        'Print annotations',
    );
}

function normalizePrintAnnotationSnapshot(annotations) {
    // Images and resource links are private owner data, even if a caller passes
    // untrusted new metadata into an existing publication or frozen snapshot.
    const publicAnnotations = (Array.isArray(annotations) ? annotations : []).filter((annotation) => annotation && typeof annotation === 'object' && annotation.type !== 'image' && annotation.boundarySource === undefined)
        .map(({ resourceLinks, resourceBehaviour, resourceGlowColor, imageBorder, image, ...annotation }) => {
            void resourceLinks; void resourceBehaviour; void resourceGlowColor; void imageBorder; void image;
            return annotation;
        });
    const parsed = replacePrintAnnotationsBodySchema.safeParse({
        schemaVersion: PRINT_ANNOTATION_SCHEMA_VERSION,
        annotations: publicAnnotations,
    });
    return parsed.success ? parsed.data.annotations : [];
}

export function buildEmbeddedPrintAnnotationSnapshot(annotations) {
    return normalizePrintAnnotationSnapshot(annotations)
        .filter((annotation) => Boolean(annotation.isShared))
        .map(({ isShared, ...annotation }) => {
            void isShared;
            return annotation;
        });
}

export function normalizeEmbeddedPrintAnnotationSnapshot(annotations) {
    return normalizePrintAnnotationSnapshot(annotations)
        .map(({ isShared, ...annotation }) => {
            void isShared;
            return annotation;
        });
}

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function assertPrintAnnotationUser(user) {
    if (!user?.id || normalizeRole(user.role) === 'guest' || user.isImpersonating) {
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
    const result = formatDocument(mapId, document);
    if (result.annotations.some((annotation) => annotation.resourceLinks?.length)) {
        result.annotations = detachInvalidAnnotationResourceLinks(result.annotations, await loadMapAnnotationResourceKeys(db, user.id, mapId));
    }
    return result;
}

export async function replacePrintAnnotationDocument(db, user, mapId, body, { mediaBucket } = {}) {
    assertPrintAnnotationUser(user);
    await requireOwnedMap(db, user.id, mapId);
    if (body.annotations.some((annotation) => annotation.resourceLinks?.length)) {
        const allowedKeys = await loadMapAnnotationResourceKeys(db, user.id, mapId);
        if (body.annotations.some((annotation) => annotation.resourceLinks?.some((link) => !allowedKeys.has(`${link.type}:${link.id}`)))) {
            throw createHttpError(400, 'Linked resources must belong to this Care Map. Refresh the map and review its resource links.');
        }
    }
    for (const annotation of body.annotations.filter((item) => item.type === 'image')) {
        const { metadata } = await createPrivateMapMediaRepository(mediaBucket, user.id).getAsset(annotation.image.assetId);
        if (metadata.width !== annotation.image.width || metadata.height !== annotation.image.height) throw createHttpError(400, 'Image dimensions do not match the uploaded map image.');
    }

    const current = await db.query.myMapPrintAnnotationDocuments.findFirst({
        where: eq(myMapPrintAnnotationDocuments.mapId, mapId),
    });
    const currentRevision = Number(current?.revision || 0);
    if (body.revision !== undefined && body.revision !== currentRevision) {
        throw createHttpError(409, 'Print annotations changed in another session. Reload and try again.');
    }

    const timestamp = new Date();
    const nextRevision = currentRevision + 1;
    const publicSnapshotChanged = JSON.stringify(
        buildEmbeddedPrintAnnotationSnapshot(current?.annotations),
    ) !== JSON.stringify(
        buildEmbeddedPrintAnnotationSnapshot(body.annotations),
    );
    if (publicSnapshotChanged) {
        await db.update(myMaps)
            .set({ updatedAt: timestamp })
            .where(eq(myMaps.id, mapId));
    }
    let saved;
    if (current) {
        [saved] = await db.update(myMapPrintAnnotationDocuments)
            .set({
                schemaVersion: PRINT_ANNOTATION_SCHEMA_VERSION,
                annotations: body.annotations,
                revision: nextRevision,
                updatedAt: timestamp,
            })
            .where(and(eq(myMapPrintAnnotationDocuments.mapId, mapId), eq(myMapPrintAnnotationDocuments.revision, currentRevision)))
            .returning();
        if (!saved) throw createHttpError(409, 'Print annotations changed in another session. Reload and try again.');
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
        return c.json(await replacePrintAnnotationDocument(db, user, mapId, body, { mediaBucket: c.env?.HELP_CMS_BUCKET }));
    } catch (err) {
        console.error('putMyMapPrintAnnotations Error:', err);
        return c.json({ error: err.message || 'Failed to save print annotations' }, err.status || 500);
    }
};
