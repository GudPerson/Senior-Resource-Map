import { z } from 'zod';

import { cleanOneLineText, validateRequestBody } from './inputValidation.js';

export const MAP_STUDIO_SCHEMA_VERSION = 2;
const MAP_STUDIO_LEGACY_SCHEMA_VERSION = 1;
export const MAP_STUDIO_MAX_VIEWS = 50;
export const MAP_STUDIO_MAX_VIEW_NAME_LENGTH = 80;
export const MAP_STUDIO_MAX_LAYER_REFERENCES = 200;
export const MAP_STUDIO_MAX_TOTAL_LAYER_REFERENCES = 2000;
export const MAP_STUDIO_MAX_DOCUMENT_BYTES = 512 * 1024;
export const MAP_STUDIO_MAX_REVISION = 2_147_483_646;

const viewIdSchema = z.string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/);

const viewNameSchema = z.string()
    .transform((value) => cleanOneLineText(value, 500))
    .refine((value) => value.length > 0, 'View name is required')
    .refine(
        (value) => value.length <= MAP_STUDIO_MAX_VIEW_NAME_LENGTH,
        `View name may contain at most ${MAP_STUDIO_MAX_VIEW_NAME_LENGTH} characters`,
    );

const layerReferenceSchema = z.string()
    .transform((value) => cleanOneLineText(value, 240))
    .refine((value) => value.length > 0, 'Layer reference is required');

const uniqueLayerReferencesSchema = z.array(layerReferenceSchema)
    .max(MAP_STUDIO_MAX_LAYER_REFERENCES)
    .superRefine((values, context) => {
        const seen = new Set();
        values.forEach((value, index) => {
            if (seen.has(value)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [index],
                    message: 'Layer references must be unique',
                });
            }
            seen.add(value);
        });
    });

const cameraViewSchema = z.object({
    center: z.tuple([
        z.number().finite().min(-90).max(90),
        z.number().finite().min(-180).max(180),
    ]),
    zoom: z.number().finite().min(0).max(22),
}).strict();

const cameraSchema = z.object({
    mode: z.enum(['fit', 'fixed']),
    view: cameraViewSchema.nullable(),
}).strict().superRefine((camera, context) => {
    if (camera.mode === 'fit' && camera.view !== null) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['view'],
            message: 'Fit camera must not include a fixed view',
        });
    }
    if (camera.mode === 'fixed' && camera.view === null) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['view'],
            message: 'Fixed camera requires a view',
        });
    }
});

const designSchema = z.object({
    basemap: z.object({
        style: z.enum(['default', 'gray']),
        detailMode: z.enum(['auto', 'live']),
    }).strict(),
    camera: cameraSchema,
    pins: z.object({
        style: z.enum(['category-bubble', 'numbered', 'category-icon']),
        size: z.enum(['standard', 'large', 'extra-large']),
    }).strict(),
    labels: z.object({
        detail: z.enum([
            'names',
            'names-logos',
            'names-addresses',
            'names-descriptions',
            'full',
        ]),
    }).strict(),
    layers: z.object({
        resources: z.enum(['show', 'hide']),
        annotations: z.enum(['show', 'hide']),
        hiddenResourceLayerKeys: uniqueLayerReferencesSchema,
        hiddenAnnotationIds: uniqueLayerReferencesSchema,
    }).strict(),
    layout: z.object({
        mapHeight: z.enum(['compact', 'standard', 'tall']),
        preset: z.enum(['balanced', 'map-focus', 'full-map']),
        mapSide: z.enum(['left', 'right']),
        mapWidth: z.enum(['wide', 'extra-wide']),
        resourceColumnCount: z.union([
            z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6),
        ]),
        sideResourceColumnCount: z.union([z.literal(1), z.literal(2)]),
    }).strict(),
}).strict();

const legacyDesignSchema = designSchema.extend({
    pins: z.object({
        style: z.enum(['category-bubble', 'numbered']),
        size: z.enum(['standard', 'large', 'extra-large']),
    }).strict(),
    layout: z.object({
        mapHeight: z.enum(['compact', 'standard', 'tall']),
        resourcePanel: z.enum(['responsive', 'below-map', 'beside-map']),
    }).strict(),
}).strict();

const viewSchema = z.object({
    id: viewIdSchema,
    name: viewNameSchema,
    revision: z.number().int().min(0).max(MAP_STUDIO_MAX_REVISION),
    design: designSchema,
}).strict();

const legacyViewSchema = viewSchema.extend({
    design: legacyDesignSchema,
}).strict();

const mapStudioStoredDocumentBaseSchema = z.object({
    schemaVersion: z.literal(MAP_STUDIO_SCHEMA_VERSION),
    defaultViewId: viewIdSchema,
    views: z.array(viewSchema).min(1).max(MAP_STUDIO_MAX_VIEWS),
}).strict();

const legacyMapStudioStoredDocumentBaseSchema = z.object({
    schemaVersion: z.literal(MAP_STUDIO_LEGACY_SCHEMA_VERSION),
    defaultViewId: viewIdSchema,
    views: z.array(legacyViewSchema).min(1).max(MAP_STUDIO_MAX_VIEWS),
}).strict();

function refineMapStudioDocument(document, context) {
    const seenViewIds = new Set();
    let totalLayerReferences = 0;

    document.views.forEach((view, index) => {
        if (seenViewIds.has(view.id)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['views', index, 'id'],
                message: 'View ids must be unique',
            });
        }
        seenViewIds.add(view.id);
        totalLayerReferences += view.design.layers.hiddenResourceLayerKeys.length;
        totalLayerReferences += view.design.layers.hiddenAnnotationIds.length;
    });

    if (!seenViewIds.has(document.defaultViewId)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['defaultViewId'],
            message: 'Default view must reference a view in this document',
        });
    }

    if (totalLayerReferences > MAP_STUDIO_MAX_TOTAL_LAYER_REFERENCES) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['views'],
            message: `Map Studio may contain at most ${MAP_STUDIO_MAX_TOTAL_LAYER_REFERENCES} hidden layer references`,
        });
    }

    const byteLength = new TextEncoder().encode(JSON.stringify(document)).byteLength;
    if (byteLength > MAP_STUDIO_MAX_DOCUMENT_BYTES) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [],
            message: `Map Studio document may contain at most ${MAP_STUDIO_MAX_DOCUMENT_BYTES} bytes`,
        });
    }
}

export const mapStudioStoredDocumentSchema = mapStudioStoredDocumentBaseSchema
    .superRefine(refineMapStudioDocument);

const legacyMapStudioStoredDocumentSchema = legacyMapStudioStoredDocumentBaseSchema
    .superRefine(refineMapStudioDocument);

const mapStudioDocumentInputSchema = mapStudioStoredDocumentBaseSchema
    .extend({
        revision: z.number().int().min(0).max(MAP_STUDIO_MAX_REVISION),
    })
    .strict()
    .superRefine(refineMapStudioDocument);

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

export function validateMapStudioDocumentInput(body) {
    return validateRequestBody(body, mapStudioDocumentInputSchema, 'Map Studio design');
}

export function buildMapStudioStoredDocument(document) {
    const validated = validateMapStudioDocumentInput(document);
    return {
        schemaVersion: validated.schemaVersion,
        defaultViewId: validated.defaultViewId,
        views: validated.views,
    };
}

function migrateStoredMapStudioDocument(document) {
    if (document.schemaVersion === MAP_STUDIO_SCHEMA_VERSION) return document;
    return {
        schemaVersion: MAP_STUDIO_SCHEMA_VERSION,
        defaultViewId: document.defaultViewId,
        views: document.views.map((view) => {
            const resourcePanel = view.design.layout.resourcePanel;
            return {
                ...view,
                design: {
                    ...view.design,
                    layout: {
                        mapHeight: view.design.layout.mapHeight,
                        preset: resourcePanel === 'below-map'
                            ? 'full-map'
                            : resourcePanel === 'beside-map'
                                ? 'map-focus'
                                : 'balanced',
                        mapSide: 'left',
                        mapWidth: 'wide',
                        resourceColumnCount: 2,
                        sideResourceColumnCount: 1,
                    },
                },
            };
        }),
    };
}

export function formatMapStudioDocument(mapId, row = null) {
    if (!row) {
        return {
            mapId,
            document: null,
            updatedAt: null,
        };
    }

    const storedSchemaVersion = Number(row.schemaVersion ?? row.document?.schemaVersion);
    const schema = storedSchemaVersion === MAP_STUDIO_LEGACY_SCHEMA_VERSION
        ? legacyMapStudioStoredDocumentSchema
        : mapStudioStoredDocumentSchema;
    const parsed = schema.safeParse(row.document);
    if (!parsed.success) {
        throw createHttpError(500, 'Stored Map Studio design is invalid');
    }
    const storedRevision = Number(row.revision);
    if (
        storedSchemaVersion !== Number(parsed.data.schemaVersion)
        || ![MAP_STUDIO_LEGACY_SCHEMA_VERSION, MAP_STUDIO_SCHEMA_VERSION].includes(storedSchemaVersion)
        || !Number.isSafeInteger(storedRevision)
        || storedRevision < 1
    ) {
        throw createHttpError(500, 'Stored Map Studio design metadata is invalid');
    }

    return {
        mapId,
        document: {
            ...migrateStoredMapStudioDocument(parsed.data),
            revision: storedRevision,
        },
        updatedAt: row.updatedAt || null,
    };
}
