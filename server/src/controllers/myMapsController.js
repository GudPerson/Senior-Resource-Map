import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import {
    myMapAssetNotes,
    myMapAssetShortDescriptors,
    myMapAssets,
    myMapPersonalPlaceLinks,
    myMapShareSnapshots,
    myMaps,
    userFavorites,
} from '../db/schema.js';
import {
    attachPersonalPlaceBodySchema,
    attachPersonalPlaceToMap,
    createPersonalPlace,
    detachPersonalPlaceFromMap,
    personalPlaceBodySchema,
    updatePersonalPlace,
} from './personalPlacesController.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    buildEmbeddedResourceContactSnapshot,
    stripEmbeddedResourceContactsFromDirectory,
} from '../utils/embeddedResourceContacts.js';
import {
    createSavedAssetResolutionContext,
} from '../utils/savedAssets.js';
import {
    buildLiveMyMapAssetSnapshotFromDb,
    buildMyMapDirectory,
    normalizeMyMapAssetSnapshot,
} from '../utils/myMapDirectory.js';
import {
    MY_MAP_CATEGORY_ORDER_LIMIT,
    normalizeMyMapCategoryOrder,
} from '../utils/myMapCategoryOrder.js';
import { normalizeRole } from '../utils/roles.js';
import { createShareToken } from '../utils/shareTokens.js';
import { MAX_MAP_EMBED_ORIGINS, normalizeMapEmbedOrigins } from '../utils/mapEmbed.js';
import { buildEmbeddedPrintAnnotationSnapshot } from './printAnnotationsController.js';
import { buildEmbeddedMapPresentationSnapshot } from '../utils/embeddedMapPresentation.js';
import { formatMapStudioDocument } from '../utils/mapStudioDocument.js';
import {
    optionalOneLineTextSchema,
    optionalTextSchema,
    positiveIntValueSchema,
    requiredOneLineTextSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';

const MY_MAP_NOTE_MAX_LENGTH = 3000;
const MY_MAP_SHORT_DESCRIPTOR_MAX_LENGTH = 240;
const optionalHexColorSchema = z.union([
    z.string().trim().regex(/^#[0-9a-f]{6}$/i, 'Colour must use a 6-digit hex value'),
    z.null(),
]).optional();
const mapAssetRefBodySchema = z.object({
    resourceType: z.enum(['hard', 'soft']),
    resourceId: positiveIntValueSchema('Resource id'),
});

const createMyMapBodySchema = z.object({
    name: requiredOneLineTextSchema('Map name', 160),
    description: optionalTextSchema(2000),
    assets: z.array(mapAssetRefBodySchema).max(500).optional(),
});

const updateMyMapBodySchema = z.object({
    name: requiredOneLineTextSchema('Map name', 160),
    description: optionalTextSchema(2000),
});

const updateMyMapCategoryOrderBodySchema = z.object({
    categoryOrder: z.array(
        z.string().trim().min(1).max(160),
    ).max(MY_MAP_CATEGORY_ORDER_LIMIT),
});

const mapAssetNoteInputSchema = z.object({
    id: z.number().int().positive().optional(),
    text: optionalTextSchema(MY_MAP_NOTE_MAX_LENGTH),
    isShared: z.boolean().optional(),
});

const mapAssetShortDescriptorInputSchema = z.object({
    id: z.number().int().positive().optional(),
    text: optionalOneLineTextSchema(MY_MAP_SHORT_DESCRIPTOR_MAX_LENGTH),
    textColor: optionalHexColorSchema,
    highlightColor: optionalHexColorSchema,
    sortOrder: z.number().int().min(0).optional(),
});

const updateMyMapAssetNotesBodySchema = z.object({
    resourceType: z.enum(['hard', 'soft']),
    resourceId: positiveIntValueSchema('Resource id'),
    notes: z.array(mapAssetNoteInputSchema).max(20).optional(),
    privateNote: optionalTextSchema(MY_MAP_NOTE_MAX_LENGTH),
    handoffNote: optionalTextSchema(MY_MAP_NOTE_MAX_LENGTH),
});

const updateMyMapAssetShortDescriptorBodySchema = z.object({
    resourceType: z.enum(['hard', 'soft']),
    resourceId: positiveIntValueSchema('Resource id'),
    shortDescriptor: optionalOneLineTextSchema(MY_MAP_SHORT_DESCRIPTOR_MAX_LENGTH),
    shortDescriptorTextColor: optionalHexColorSchema,
    shortDescriptorHighlightColor: optionalHexColorSchema,
    shortDescriptors: z.array(mapAssetShortDescriptorInputSchema).max(20).optional(),
});

const updateMyMapPersonalPlaceShortDescriptorBodySchema = z.object({
    shortDescriptor: optionalOneLineTextSchema(MY_MAP_SHORT_DESCRIPTOR_MAX_LENGTH),
    shortDescriptorTextColor: optionalHexColorSchema,
    shortDescriptorHighlightColor: optionalHexColorSchema,
    shortDescriptors: z.array(mapAssetShortDescriptorInputSchema).max(20).optional(),
});

const shareMyMapBodySchema = z.object({
    includeHandoffNotes: z.boolean().optional(),
    studioViewId: z.string()
        .trim()
        .min(1)
        .max(80)
        .regex(/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/)
        .optional(),
});
const updateMyMapEmbedBodySchema = z.object({
    enabled: z.boolean(),
    allowedOrigins: z.array(z.string().trim().min(1).max(500)).max(MAX_MAP_EMBED_ORIGINS),
});

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function assertDirectoryUser(user) {
    if (!user?.id || normalizeRole(user?.role) === 'guest') {
        throw createHttpError(403, 'Only authenticated non-guest users can manage My Maps');
    }
}

function parseMapId(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePersonalPlaceId(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMapName(value) {
    const text = String(value ?? '').trim();
    return text ? text : null;
}

function normalizeMapDescription(value) {
    if (value === undefined) return undefined;
    const text = String(value ?? '').trim();
    return text ? text : null;
}

function normalizeHexColor(value) {
    const text = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toUpperCase() : null;
}

function normalizeNote(value) {
    if (value === undefined) return undefined;
    const text = String(value ?? '').trim();
    return text ? text : null;
}

function normalizeNoteItems(body = {}) {
    if (Array.isArray(body.notes)) {
        return body.notes
            .map((note, index) => ({
                text: normalizeNote(note?.text),
                isShared: Boolean(note?.isShared),
                sortOrder: index,
            }))
            .filter((note) => Boolean(note.text));
    }

    const legacyNotes = [];
    const privateNote = normalizeNote(body?.privateNote);
    const handoffNote = normalizeNote(body?.handoffNote);

    if (privateNote) {
        legacyNotes.push({ text: privateNote, isShared: false, sortOrder: 0 });
    }
    if (handoffNote) {
        legacyNotes.push({ text: handoffNote, isShared: true, sortOrder: 1 });
    }
    return legacyNotes;
}

function normalizeResourceType(value) {
    const type = String(value || '').trim().toLowerCase();
    return type === 'hard' || type === 'soft' ? type : null;
}

function parseResourceId(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseAssetRef(value) {
    const resourceType = normalizeResourceType(value?.resourceType);
    const resourceId = parseResourceId(value?.resourceId);
    if (!resourceType || !resourceId) return null;
    return { resourceType, resourceId };
}

function parseAssetRefs(values) {
    if (!Array.isArray(values)) return [];

    const unique = new Map();
    values.forEach((value) => {
        const parsed = parseAssetRef(value);
        if (!parsed) return;
        unique.set(`${parsed.resourceType}:${parsed.resourceId}`, parsed);
    });

    return [...unique.values()];
}

function formatMyMapSummary(map) {
    const savedResourceCount = Array.isArray(map?.assets) ? map.assets.length : Number(map?.savedResourceCount || map?.assetCount || 0);
    const personalPlaceCount = Array.isArray(map?.personalPlaces) ? map.personalPlaces.length : Number(map?.personalPlaceCount || 0);
    const assetCount = savedResourceCount + personalPlaceCount;
    return {
        id: map.id,
        name: map.name,
        description: map.description || null,
        assetCount,
        savedResourceCount,
        personalPlaceCount,
        isShared: Boolean(map.isShared),
        shareToken: map.isShared ? (map.shareToken || null) : null,
        sharePath: map.isShared && map.shareToken ? `/shared/maps/${map.shareToken}` : null,
        shareIncludesHandoffNotes: Boolean(map.shareIncludesHandoffNotes),
        shareUpdatedAt: map.shareUpdatedAt || null,
        embedEnabled: Boolean(map.embedEnabled),
        embedAllowedOrigins: Array.isArray(map.embedAllowedOrigins) ? map.embedAllowedOrigins : [],
        embedPath: map.isShared && map.shareToken ? `/embed/maps/${map.shareToken}` : null,
        createdAt: map.createdAt,
        updatedAt: map.updatedAt,
    };
}

function serializeMapAssetShortDescriptorItems(mapAsset) {
    const explicitDescriptors = Array.isArray(mapAsset?.shortDescriptors)
        ? mapAsset.shortDescriptors.map((descriptor, index) => ({
            id: Number.isInteger(descriptor?.id) ? descriptor.id : null,
            text: String(descriptor?.descriptorText ?? descriptor?.text ?? '').trim(),
            textColor: normalizeHexColor(descriptor?.textColor),
            highlightColor: normalizeHexColor(descriptor?.highlightColor),
            sortOrder: Number.isInteger(descriptor?.sortOrder) ? descriptor.sortOrder : index,
            createdAt: descriptor?.createdAt ?? null,
            updatedAt: descriptor?.updatedAt ?? null,
        })).filter((descriptor) => descriptor.text)
        : [];

    if (explicitDescriptors.length > 0) {
        return explicitDescriptors.sort((left, right) => (
            left.sortOrder - right.sortOrder || (left.id || 0) - (right.id || 0)
        ));
    }

    const legacyText = String(mapAsset?.shortDescriptor || '').trim();
    if (!legacyText) return [];
    return [{
        id: null,
        text: legacyText,
        textColor: normalizeHexColor(mapAsset?.shortDescriptorTextColor),
        highlightColor: normalizeHexColor(mapAsset?.shortDescriptorHighlightColor),
        sortOrder: 0,
        createdAt: mapAsset?.addedAt ?? null,
        updatedAt: mapAsset?.addedAt ?? null,
    }];
}

function normalizeNextShortDescriptors(body, existingShortDescriptors = []) {
    if (Array.isArray(body.shortDescriptors)) {
        return body.shortDescriptors
            .map((descriptor, index) => ({
                text: String(descriptor?.text || '').trim(),
                textColor: normalizeHexColor(descriptor?.textColor),
                highlightColor: normalizeHexColor(descriptor?.highlightColor),
                sortOrder: index,
            }))
            .filter((descriptor) => descriptor.text);
    }

    const legacyText = String(body.shortDescriptor || '').trim();
    const remainingDescriptors = existingShortDescriptors.slice(1);
    return legacyText
        ? [{
            text: legacyText,
            textColor: body.shortDescriptorTextColor === undefined
                ? (existingShortDescriptors[0]?.textColor || null)
                : normalizeHexColor(body.shortDescriptorTextColor),
            highlightColor: body.shortDescriptorHighlightColor === undefined
                ? (existingShortDescriptors[0]?.highlightColor || null)
                : normalizeHexColor(body.shortDescriptorHighlightColor),
            sortOrder: 0,
        }, ...remainingDescriptors.map((descriptor, index) => ({
            text: descriptor.text,
            textColor: descriptor.textColor,
            highlightColor: descriptor.highlightColor,
            sortOrder: index + 1,
        }))]
        : remainingDescriptors.map((descriptor, index) => ({
            text: descriptor.text,
            textColor: descriptor.textColor,
            highlightColor: descriptor.highlightColor,
            sortOrder: index,
        }));
}

function serializeShortDescriptorUpdate(shortDescriptors) {
    const firstShortDescriptor = shortDescriptors[0] || null;
    return {
        shortDescriptor: firstShortDescriptor?.text || null,
        shortDescriptorTextColor: firstShortDescriptor?.textColor || null,
        shortDescriptorHighlightColor: firstShortDescriptor?.highlightColor || null,
        shortDescriptors,
    };
}

function serializeMyMapAssetRecord(mapAsset) {
    const shortDescriptors = serializeMapAssetShortDescriptorItems(mapAsset);
    const firstShortDescriptor = shortDescriptors[0] || null;
    return {
        id: mapAsset.id,
        mapId: mapAsset.mapId,
        resourceType: mapAsset.resourceType,
        resourceId: mapAsset.resourceId,
        assetKey: `${mapAsset.resourceType}-${mapAsset.resourceId}`,
        addedAt: mapAsset.addedAt ?? null,
        shortDescriptor: firstShortDescriptor?.text || null,
        shortDescriptorTextColor: firstShortDescriptor?.textColor || null,
        shortDescriptorHighlightColor: firstShortDescriptor?.highlightColor || null,
        shortDescriptors,
        notes: {
            items: serializeMapAssetNoteItems(mapAsset),
            notesUpdatedAt: mapAsset.notesUpdatedAt ?? null,
        },
        snapshot: normalizeMyMapAssetSnapshot(mapAsset.resourceType, mapAsset.resourceId, mapAsset.snapshot),
    };
}

function serializeMapAssetNoteItems(mapAsset) {
    const explicitNotes = Array.isArray(mapAsset?.notes)
        ? mapAsset.notes.map((note, index) => ({
            id: Number.isInteger(note?.id) ? note.id : null,
            text: String(note?.noteText ?? note?.text ?? '').trim(),
            isShared: Boolean(note?.isShared),
            sortOrder: Number.isInteger(note?.sortOrder) ? note.sortOrder : index,
            createdAt: note?.createdAt ?? null,
            updatedAt: note?.updatedAt ?? null,
        })).filter((note) => note.text)
        : [];

    if (explicitNotes.length > 0) return explicitNotes;

    const legacyNotes = [];
    const privateNote = String(mapAsset?.privateNote || '').trim();
    const handoffNote = String(mapAsset?.handoffNote || '').trim();
    if (privateNote) {
        legacyNotes.push({
            id: null,
            text: privateNote,
            isShared: false,
            sortOrder: 0,
            createdAt: mapAsset?.notesUpdatedAt ?? null,
            updatedAt: mapAsset?.notesUpdatedAt ?? null,
        });
    }
    if (handoffNote) {
        legacyNotes.push({
            id: null,
            text: handoffNote,
            isShared: true,
            sortOrder: 1,
            createdAt: mapAsset?.notesUpdatedAt ?? null,
            updatedAt: mapAsset?.notesUpdatedAt ?? null,
        });
    }
    return legacyNotes;
}

async function loadOwnedMap(
    db,
    userId,
    mapId,
    includeAssets = false,
    includeStudioDocument = false,
) {
    const map = await db.query.myMaps.findFirst({
        where: and(
            eq(myMaps.id, mapId),
            eq(myMaps.userId, userId)
        ),
        with: includeAssets
            ? {
                assets: {
                    columns: {
                        id: true,
                        resourceType: true,
                        resourceId: true,
                        snapshot: true,
                        shortDescriptor: true,
                        shortDescriptorTextColor: true,
                        shortDescriptorHighlightColor: true,
                        privateNote: true,
                        handoffNote: true,
                        notesUpdatedAt: true,
                        addedAt: true,
                    },
                    with: {
                        notes: {
                            orderBy: [asc(myMapAssetNotes.sortOrder), asc(myMapAssetNotes.id)],
                        },
                        shortDescriptors: {
                            orderBy: [
                                asc(myMapAssetShortDescriptors.sortOrder),
                                asc(myMapAssetShortDescriptors.id),
                            ],
                        },
                    },
                },
                personalPlaceLinks: {
                    columns: {
                        id: true,
                        mapId: true,
                        personalPlaceId: true,
                        shortDescriptors: true,
                        addedAt: true,
                    },
                    with: {
                        personalPlace: {
                            with: {
                                category: true,
                            },
                        },
                    },
                    orderBy: [asc(myMapPersonalPlaceLinks.addedAt), asc(myMapPersonalPlaceLinks.id)],
                },
                printAnnotationDocument: true,
                ...(includeStudioDocument ? { studioDocument: true } : {}),
            }
            : undefined,
    });

    if (!map || !includeAssets) return map;
    const personalPlaces = Array.isArray(map.personalPlaceLinks)
        ? map.personalPlaceLinks
            .filter((link) => link?.personalPlace)
            .map((link) => ({
                ...link.personalPlace,
                mapId: map.id,
                linkId: link.id,
                shortDescriptors: link.shortDescriptors,
                addedAt: link.addedAt,
            }))
        : (map.personalPlaces || []);
    return {
        ...map,
        personalPlaces,
    };
}

async function requireOwnedMap(
    db,
    userId,
    mapId,
    includeAssets = false,
    includeStudioDocument = false,
) {
    const map = await loadOwnedMap(db, userId, mapId, includeAssets, includeStudioDocument);
    if (!map) {
        throw createHttpError(404, 'Map not found');
    }
    return map;
}

async function persistSnapshotUpdates(db, updates) {
    const statements = (updates || []).map((update) => (
        db.update(myMapAssets)
            .set({ snapshot: update.snapshot })
            .where(eq(myMapAssets.id, update.mapAssetId))
    ));
    if (statements.length === 0) return;

    if (typeof db.batch === 'function') {
        await db.batch(statements);
        return;
    }

    for (const statement of statements) {
        await statement;
    }
}

async function findSavedAssetRecord(db, userId, resourceType, resourceId) {
    return db.query.userFavorites.findFirst({
        where: and(
            eq(userFavorites.userId, userId),
            eq(userFavorites.resourceType, resourceType),
            eq(userFavorites.resourceId, resourceId)
        ),
    });
}

async function requireSavedAssetRecord(db, user, assetRef, resolutionContext = null) {
    const favorite = await findSavedAssetRecord(db, user.id, assetRef.resourceType, assetRef.resourceId);
    if (!favorite) {
        throw createHttpError(400, 'You can only add assets that are already saved');
    }

    return {
        ...favorite,
        snapshot: favorite.snapshot
            ? normalizeMyMapAssetSnapshot(assetRef.resourceType, assetRef.resourceId, favorite.snapshot)
            : (await buildLiveMyMapAssetSnapshotFromDb(db, assetRef.resourceType, assetRef.resourceId))
                || normalizeMyMapAssetSnapshot(assetRef.resourceType, assetRef.resourceId, null),
    };
}

async function touchMap(db, mapId) {
    await db.update(myMaps)
        .set({ updatedAt: new Date() })
        .where(eq(myMaps.id, mapId));
}

async function persistShareSnapshot(db, mapId, shareToken, snapshot, timestamp = new Date()) {
    const existing = await db.query?.myMapShareSnapshots?.findFirst?.({
        where: eq(myMapShareSnapshots.mapId, mapId),
    });

    if (existing) {
        await db.update(myMapShareSnapshots)
            .set({
                shareToken,
                snapshot,
                updatedAt: timestamp,
            })
            .where(eq(myMapShareSnapshots.mapId, mapId));
        return;
    }

    await db.insert(myMapShareSnapshots).values({
        mapId,
        shareToken,
        snapshot,
        createdAt: timestamp,
        updatedAt: timestamp,
    });
}

async function deleteShareSnapshot(db, mapId) {
    await db.delete(myMapShareSnapshots).where(eq(myMapShareSnapshots.mapId, mapId));
}

export async function listMyMaps(db, user) {
    assertDirectoryUser(user);
    const maps = await db.query.myMaps.findMany({
        where: eq(myMaps.userId, user.id),
        with: {
            assets: {
                columns: {
                    id: true,
                },
            },
            personalPlaceLinks: {
                columns: {
                    id: true,
                },
            },
        },
        orderBy: [desc(myMaps.updatedAt)],
    });

    return maps.map((map) => formatMyMapSummary({
        ...map,
        personalPlaces: map.personalPlaceLinks || map.personalPlaces || [],
    }));
}

export async function createMyMap(db, user, body, resolutionContext = null) {
    assertDirectoryUser(user);
    const name = normalizeMapName(body?.name);
    if (!name) {
        throw createHttpError(400, 'Map name is required');
    }

    const assetRefs = parseAssetRefs(body?.assets);
    const finalResolutionContext = resolutionContext || await createSavedAssetResolutionContext(db, user);
    const savedRecords = [];

    for (const assetRef of assetRefs) {
        const favorite = await requireSavedAssetRecord(db, user, assetRef, finalResolutionContext);
        savedRecords.push(favorite);
    }

    const [createdMap] = await db.insert(myMaps).values({
        userId: user.id,
        name,
    }).returning();

    if (savedRecords.length > 0) {
        await db.insert(myMapAssets).values(
            savedRecords.map((favorite) => ({
                mapId: createdMap.id,
                resourceType: favorite.resourceType,
                resourceId: favorite.resourceId,
                snapshot: favorite.snapshot || null,
            }))
        );
    }

    const map = await requireOwnedMap(db, user.id, createdMap.id, true);
    return {
        ...formatMyMapSummary(map),
        assets: [],
    };
}

export async function getMyMapDetail(db, user, mapId, resolutionContext = null) {
    assertDirectoryUser(user);
    const map = await requireOwnedMap(db, user.id, mapId, true);
    const finalResolutionContext = resolutionContext || await createSavedAssetResolutionContext(db, user);
    const { directory, snapshotUpdates } = await buildMyMapDirectory(db, {
        map,
        viewerUser: user,
        visibilityUser: user,
        resolutionContext: finalResolutionContext,
        mode: 'owner',
    });

    if (snapshotUpdates.length > 0) {
        await persistSnapshotUpdates(db, snapshotUpdates);
    }

    return directory;
}

export async function renameMyMap(db, user, mapId, body) {
    assertDirectoryUser(user);
    const name = normalizeMapName(body?.name);
    const description = normalizeMapDescription(body?.description);
    if (!name) {
        throw createHttpError(400, 'Map name is required');
    }

    await requireOwnedMap(db, user.id, mapId);
    await db.update(myMaps)
        .set({
            name,
            ...(description !== undefined ? { description } : {}),
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(myMaps.id, mapId),
                eq(myMaps.userId, user.id)
            )
        );

    const updated = await requireOwnedMap(db, user.id, mapId, true);
    return formatMyMapSummary(updated);
}

export async function updateMyMapCategoryOrder(db, user, mapId, body) {
    assertDirectoryUser(user);
    await requireOwnedMap(db, user.id, mapId);

    const categoryOrder = normalizeMyMapCategoryOrder(body?.categoryOrder);
    const updatedAt = new Date();
    await db.update(myMaps)
        .set({
            categoryOrder,
            updatedAt,
        })
        .where(
            and(
                eq(myMaps.id, mapId),
                eq(myMaps.userId, user.id)
            )
        );

    return {
        mapId,
        categoryOrder,
        updatedAt,
    };
}

export async function updateMyMapEmbedSettings(db, user, mapId, body) {
    assertDirectoryUser(user);
    const map = await requireOwnedMap(db, user.id, mapId);
    const allowedOrigins = normalizeMapEmbedOrigins(body?.allowedOrigins);
    const enabled = Boolean(body?.enabled);

    if (enabled && (!map.isShared || !map.shareToken)) {
        throw createHttpError(409, 'Publish this map before enabling website embedding');
    }
    if (enabled && allowedOrigins.length === 0) {
        throw createHttpError(400, 'Add at least one approved website before enabling embedding');
    }
    if (enabled) {
        const shareSnapshot = await db.query.myMapShareSnapshots.findFirst({
            where: and(
                eq(myMapShareSnapshots.mapId, mapId),
                eq(myMapShareSnapshots.shareToken, map.shareToken)
            ),
        });
        if (
            !shareSnapshot?.snapshot
            || typeof shareSnapshot.snapshot !== 'object'
            || Array.isArray(shareSnapshot.snapshot)
            || shareSnapshot.shareToken !== map.shareToken
        ) {
            throw createHttpError(409, 'Update the shared link before enabling website embedding');
        }
    }

    const updatedAt = new Date();
    await db.update(myMaps)
        .set({
            embedEnabled: enabled,
            embedAllowedOrigins: allowedOrigins,
            updatedAt,
        })
        .where(
            and(
                eq(myMaps.id, mapId),
                eq(myMaps.userId, user.id)
            )
        );

    const updated = await requireOwnedMap(db, user.id, mapId, true);
    return formatMyMapSummary(updated);
}

export async function publishMyMap(db, user, mapId, resolutionContext = null, options = {}) {
    assertDirectoryUser(user);
    const map = await requireOwnedMap(db, user.id, mapId, true, true);
    let embeddedPresentation = buildEmbeddedMapPresentationSnapshot(null);
    if (options.studioViewId) {
        const studioDocument = formatMapStudioDocument(mapId, map.studioDocument).document;
        const selectedView = studioDocument?.views?.find((view) => view.id === options.studioViewId);
        if (!selectedView) {
            throw createHttpError(409, 'Save the selected Map Studio view before updating the shared link');
        }
        embeddedPresentation = buildEmbeddedMapPresentationSnapshot(selectedView.design);
    }
    const finalResolutionContext = resolutionContext || await createSavedAssetResolutionContext(db, user);
    const sharedAt = new Date();
    const { snapshotUpdates } = await buildMyMapDirectory(db, {
        map,
        viewerUser: user,
        visibilityUser: user,
        resolutionContext: finalResolutionContext,
        mode: 'owner',
    });

    if (snapshotUpdates.length > 0) {
        await persistSnapshotUpdates(db, snapshotUpdates);
    }

    const shareToken = map.isShared && map.shareToken ? map.shareToken : createShareToken();
    const sharedMap = {
        ...map,
        isShared: true,
        shareToken,
        shareIncludesHandoffNotes: false,
        shareUpdatedAt: sharedAt,
    };
    const { directory: sharedSnapshot } = await buildMyMapDirectory(db, {
        map: sharedMap,
        viewerUser: { role: 'guest' },
        visibilityUser: { role: 'guest' },
        resolutionContext: {
            allowedPartnerAudienceIds: new Set(),
            allowedAudienceZoneIds: new Set(),
        },
        mode: 'shared',
    });

    await db.update(myMaps)
        .set({
            isShared: true,
            shareToken,
            shareIncludesHandoffNotes: false,
            shareUpdatedAt: sharedAt,
            updatedAt: sharedAt,
        })
        .where(
            and(
                eq(myMaps.id, mapId),
                eq(myMaps.userId, user.id)
            )
        );
    const embeddedResourceContacts = buildEmbeddedResourceContactSnapshot(sharedSnapshot);
    const publicSharedSnapshot = stripEmbeddedResourceContactsFromDirectory(sharedSnapshot);
    await persistShareSnapshot(db, mapId, shareToken, {
        ...publicSharedSnapshot,
        embeddedAnnotations: buildEmbeddedPrintAnnotationSnapshot(
            map.printAnnotationDocument?.annotations,
        ),
        embeddedResourceContacts,
        embeddedPresentation,
    }, sharedAt);

    const updated = await requireOwnedMap(db, user.id, mapId, true);
    return formatMyMapSummary(updated);
}

export async function unpublishMyMap(db, user, mapId) {
    assertDirectoryUser(user);
    await requireOwnedMap(db, user.id, mapId);
    await db.update(myMaps)
        .set({
            isShared: false,
            shareToken: null,
            shareIncludesHandoffNotes: false,
            shareUpdatedAt: new Date(),
            embedEnabled: false,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(myMaps.id, mapId),
                eq(myMaps.userId, user.id)
            )
        );
    await deleteShareSnapshot(db, mapId);

    const updated = await requireOwnedMap(db, user.id, mapId, true);
    return formatMyMapSummary(updated);
}

export async function deleteMyMapRecord(db, user, mapId) {
    assertDirectoryUser(user);
    await requireOwnedMap(db, user.id, mapId);
    await db.delete(myMaps)
        .where(
            and(
                eq(myMaps.id, mapId),
                eq(myMaps.userId, user.id)
            )
        );

    return { success: true };
}

export async function addAssetToMyMap(db, user, mapId, body, resolutionContext = null) {
    assertDirectoryUser(user);
    const assetRef = parseAssetRef(body);
    if (!assetRef) {
        throw createHttpError(400, 'resourceType and resourceId are required');
    }

    const map = await requireOwnedMap(db, user.id, mapId);
    const favorite = await requireSavedAssetRecord(db, user, assetRef, resolutionContext);

    const existing = await db.query.myMapAssets.findFirst({
        where: and(
            eq(myMapAssets.mapId, map.id),
            eq(myMapAssets.resourceType, assetRef.resourceType),
            eq(myMapAssets.resourceId, assetRef.resourceId)
        ),
    });

    if (existing) {
        throw createHttpError(409, 'This asset is already in the map');
    }

    const [createdAsset] = await db.insert(myMapAssets).values({
        mapId: map.id,
        resourceType: assetRef.resourceType,
        resourceId: assetRef.resourceId,
        snapshot: favorite.snapshot || null,
    }).returning();

    await touchMap(db, map.id);
    return serializeMyMapAssetRecord(createdAsset);
}

export async function updateMyMapAssetNotes(db, user, mapId, body) {
    assertDirectoryUser(user);
    const assetRef = parseAssetRef(body);
    if (!assetRef) {
        throw createHttpError(400, 'resourceType and resourceId are required');
    }

    await requireOwnedMap(db, user.id, mapId);

    const existing = await db.query.myMapAssets.findFirst({
        where: and(
            eq(myMapAssets.mapId, mapId),
            eq(myMapAssets.resourceType, assetRef.resourceType),
            eq(myMapAssets.resourceId, assetRef.resourceId)
        ),
    });

    if (!existing) {
        throw createHttpError(404, 'Map resource not found');
    }

    const nextNotes = normalizeNoteItems(body);
    const timestamp = new Date();
    const updateValues = {
        privateNote: null,
        handoffNote: null,
        notesUpdatedAt: timestamp,
    };

    await db.update(myMapAssets)
        .set(updateValues)
        .where(
            and(
                eq(myMapAssets.mapId, mapId),
                eq(myMapAssets.resourceType, assetRef.resourceType),
                eq(myMapAssets.resourceId, assetRef.resourceId)
            )
        );

    await db.delete(myMapAssetNotes)
        .where(eq(myMapAssetNotes.mapAssetId, existing.id));

    if (nextNotes.length > 0) {
        await db.insert(myMapAssetNotes).values(
            nextNotes.map((note) => ({
                mapAssetId: existing.id,
                noteText: note.text,
                isShared: note.isShared,
                sortOrder: note.sortOrder,
                createdAt: timestamp,
                updatedAt: timestamp,
            }))
        );
    }

    await touchMap(db, mapId);

    const updated = await db.query.myMapAssets.findFirst({
        where: and(
            eq(myMapAssets.mapId, mapId),
            eq(myMapAssets.resourceType, assetRef.resourceType),
            eq(myMapAssets.resourceId, assetRef.resourceId)
        ),
        with: {
            notes: {
                orderBy: [asc(myMapAssetNotes.sortOrder), asc(myMapAssetNotes.id)],
            },
        },
    });

    return serializeMyMapAssetRecord(updated || {
        ...existing,
        ...updateValues,
    });
}

export async function updateMyMapAssetShortDescriptor(db, user, mapId, body) {
    assertDirectoryUser(user);
    const assetRef = parseAssetRef(body);
    if (!assetRef) {
        throw createHttpError(400, 'resourceType and resourceId are required');
    }

    await requireOwnedMap(db, user.id, mapId);

    const existing = await db.query.myMapAssets.findFirst({
        where: and(
            eq(myMapAssets.mapId, mapId),
            eq(myMapAssets.resourceType, assetRef.resourceType),
            eq(myMapAssets.resourceId, assetRef.resourceId)
        ),
        with: {
            shortDescriptors: {
                orderBy: [
                    asc(myMapAssetShortDescriptors.sortOrder),
                    asc(myMapAssetShortDescriptors.id),
                ],
            },
        },
    });
    if (!existing) {
        throw createHttpError(404, 'Map resource not found');
    }

    const existingShortDescriptors = serializeMapAssetShortDescriptorItems(existing);
    const nextShortDescriptors = normalizeNextShortDescriptors(body, existingShortDescriptors);

    const firstShortDescriptor = nextShortDescriptors[0] || null;
    const shortDescriptor = firstShortDescriptor?.text || null;
    const shortDescriptorTextColor = firstShortDescriptor?.textColor || null;
    const shortDescriptorHighlightColor = firstShortDescriptor?.highlightColor || null;
    await db.update(myMapAssets)
        .set({
            shortDescriptor,
            shortDescriptorTextColor,
            shortDescriptorHighlightColor,
        })
        .where(and(
            eq(myMapAssets.mapId, mapId),
            eq(myMapAssets.resourceType, assetRef.resourceType),
            eq(myMapAssets.resourceId, assetRef.resourceId)
        ));
    await db.delete(myMapAssetShortDescriptors)
        .where(eq(myMapAssetShortDescriptors.mapAssetId, existing.id));
    if (nextShortDescriptors.length > 0) {
        await db.insert(myMapAssetShortDescriptors).values(
            nextShortDescriptors.map((descriptor, index) => ({
                mapAssetId: existing.id,
                descriptorText: descriptor.text,
                textColor: descriptor.textColor,
                highlightColor: descriptor.highlightColor,
                sortOrder: index,
                updatedAt: new Date(),
            }))
        );
    }
    await touchMap(db, mapId);

    const updated = await db.query.myMapAssets.findFirst({
        where: eq(myMapAssets.id, existing.id),
        with: {
            shortDescriptors: {
                orderBy: [
                    asc(myMapAssetShortDescriptors.sortOrder),
                    asc(myMapAssetShortDescriptors.id),
                ],
            },
        },
    });
    return serializeMyMapAssetRecord(updated || {
        ...existing,
        shortDescriptor,
        shortDescriptorTextColor,
        shortDescriptorHighlightColor,
        shortDescriptors: nextShortDescriptors,
    });
}

export async function updateMyMapPersonalPlaceShortDescriptor(db, user, mapId, personalPlaceId, body) {
    assertDirectoryUser(user);
    await requireOwnedMap(db, user.id, mapId);

    const link = await db.query.myMapPersonalPlaceLinks.findFirst({
        where: and(
            eq(myMapPersonalPlaceLinks.personalPlaceId, personalPlaceId),
            eq(myMapPersonalPlaceLinks.mapId, mapId)
        ),
    });
    if (!link) {
        throw createHttpError(404, 'Personal place is not on this map');
    }

    const existingShortDescriptors = serializeMapAssetShortDescriptorItems({
        shortDescriptors: link.shortDescriptors,
    });
    const nextShortDescriptors = normalizeNextShortDescriptors(body, existingShortDescriptors);
    await db.update(myMapPersonalPlaceLinks)
        .set({ shortDescriptors: nextShortDescriptors })
        .where(and(
            eq(myMapPersonalPlaceLinks.personalPlaceId, personalPlaceId),
            eq(myMapPersonalPlaceLinks.mapId, mapId)
        ));
    await touchMap(db, mapId);

    return {
        mapId,
        resourceType: 'personal_place',
        resourceId: personalPlaceId,
        personalPlaceId,
        ...serializeShortDescriptorUpdate(nextShortDescriptors),
    };
}

export async function removeAssetFromMyMap(db, user, mapId, resourceType, resourceId) {
    assertDirectoryUser(user);
    await requireOwnedMap(db, user.id, mapId);

    await db.delete(myMapAssets)
        .where(
            and(
                eq(myMapAssets.mapId, mapId),
                eq(myMapAssets.resourceType, resourceType),
                eq(myMapAssets.resourceId, resourceId)
            )
        );

    await touchMap(db, mapId);

    return {
        success: true,
        mapId,
        resourceType,
        resourceId,
    };
}

export async function createMyMapPersonalPlace(db, user, mapId, body) {
    assertDirectoryUser(user);
    await requireOwnedMap(db, user.id, mapId);

    if (body?.personalPlaceId) {
        return attachPersonalPlaceToMap(db, user, mapId, body.personalPlaceId);
    }

    const created = await createPersonalPlace(db, user, body);
    const initialShortDescriptors = created.shortDescription ? [{
        text: created.shortDescription,
        textColor: null,
        highlightColor: null,
        sortOrder: 0,
    }] : [];
    return attachPersonalPlaceToMap(db, user, mapId, created.id, {
        shortDescriptors: initialShortDescriptors,
    });
}

export async function updateMyMapPersonalPlace(db, user, mapId, personalPlaceId, body) {
    assertDirectoryUser(user);
    await requireOwnedMap(db, user.id, mapId);
    const link = await db.query.myMapPersonalPlaceLinks.findFirst({
        where: and(
            eq(myMapPersonalPlaceLinks.personalPlaceId, personalPlaceId),
            eq(myMapPersonalPlaceLinks.mapId, mapId)
        ),
    });

    if (!link) {
        throw createHttpError(404, 'Personal place is not on this map');
    }

    await touchMap(db, mapId);
    return {
        ...await updatePersonalPlace(db, user, personalPlaceId, body),
        mapId,
    };
}

export async function deleteMyMapPersonalPlace(db, user, mapId, personalPlaceId) {
    assertDirectoryUser(user);
    return detachPersonalPlaceFromMap(db, user, mapId, personalPlaceId);
}

export const getMyMaps = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const maps = await listMyMaps(db, user);
        return c.json(maps);
    } catch (err) {
        console.error('getMyMaps Error:', err);
        return c.json({ error: err.message || 'Failed to fetch maps' }, err.status || 500);
    }
};

export const postMyMap = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const body = validateRequestBody(await c.req.json(), createMyMapBodySchema, 'Map details');
        const map = await createMyMap(db, user, body);
        return c.json(map, 201);
    } catch (err) {
        console.error('postMyMap Error:', err);
        return c.json({ error: err.message || 'Failed to create map' }, err.status || 500);
    }
};

export const getMyMap = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const map = await getMyMapDetail(db, user, mapId);
        return c.json(map);
    } catch (err) {
        console.error('getMyMap Error:', err);
        return c.json({ error: err.message || 'Failed to fetch map' }, err.status || 500);
    }
};

export const patchMyMap = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const body = validateRequestBody(await c.req.json(), updateMyMapBodySchema, 'Map details');
        const map = await renameMyMap(db, user, mapId, body);
        return c.json(map);
    } catch (err) {
        console.error('patchMyMap Error:', err);
        return c.json({ error: err.message || 'Failed to update map' }, err.status || 500);
    }
};

export const patchMyMapCategoryOrder = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const body = validateRequestBody(
            await c.req.json(),
            updateMyMapCategoryOrderBodySchema,
            'Map category order'
        );
        const result = await updateMyMapCategoryOrder(db, user, mapId, body);
        return c.json(result);
    } catch (err) {
        console.error('patchMyMapCategoryOrder Error:', err);
        return c.json({ error: err.message || 'Failed to update map category order' }, err.status || 500);
    }
};

async function readOptionalJsonBody(c) {
    const contentType = String(c.req.header('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
        return {};
    }

    try {
        return await c.req.json();
    } catch {
        return {};
    }
}

export const postMyMapShare = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const rawBody = await readOptionalJsonBody(c);
        const body = validateRequestBody(rawBody, shareMyMapBodySchema, 'Share settings');
        const map = await publishMyMap(db, user, mapId, null, {
            includeHandoffNotes: Boolean(body.includeHandoffNotes),
            studioViewId: body.studioViewId,
        });
        return c.json(map);
    } catch (err) {
        console.error('postMyMapShare Error:', err);
        return c.json({ error: err.message || 'Failed to publish share link' }, err.status || 500);
    }
};

export const patchMyMapEmbed = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const body = validateRequestBody(
            await c.req.json(),
            updateMyMapEmbedBodySchema,
            'Website embed settings'
        );
        return c.json(await updateMyMapEmbedSettings(db, user, mapId, body));
    } catch (err) {
        console.error('patchMyMapEmbed Error:', err);
        return c.json({ error: err.message || 'Failed to update website embed settings' }, err.status || 500);
    }
};

export const deleteMyMapShare = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const map = await unpublishMyMap(db, user, mapId);
        return c.json(map);
    } catch (err) {
        console.error('deleteMyMapShare Error:', err);
        return c.json({ error: err.message || 'Failed to unpublish share link' }, err.status || 500);
    }
};

export const deleteMyMap = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const result = await deleteMyMapRecord(db, user, mapId);
        return c.json(result);
    } catch (err) {
        console.error('deleteMyMap Error:', err);
        return c.json({ error: err.message || 'Failed to delete map' }, err.status || 500);
    }
};

export const postMyMapAsset = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const body = validateRequestBody(await c.req.json(), mapAssetRefBodySchema, 'Map resource');
        const item = await addAssetToMyMap(db, user, mapId, body);
        return c.json(item, 201);
    } catch (err) {
        console.error('postMyMapAsset Error:', err);
        return c.json({ error: err.message || 'Failed to add asset to map' }, err.status || 500);
    }
};

export const postMyMapPersonalPlace = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const requestBody = await c.req.json();
        const body = validateRequestBody(
            requestBody,
            Object.prototype.hasOwnProperty.call(requestBody || {}, 'personalPlaceId')
                ? attachPersonalPlaceBodySchema
                : personalPlaceBodySchema,
            'Personal place'
        );
        const place = await createMyMapPersonalPlace(db, user, mapId, body);
        return c.json(place, 201);
    } catch (err) {
        console.error('postMyMapPersonalPlace Error:', err);
        return c.json({ error: err.message || 'Failed to add personal place' }, err.status || 500);
    }
};

export const patchMyMapPersonalPlace = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        const personalPlaceId = parsePersonalPlaceId(c.req.param('placeId'));
        if (!mapId || !personalPlaceId) {
            return c.json({ error: 'Map id and personal place id are required' }, 400);
        }
        const body = validateRequestBody(await c.req.json(), personalPlaceBodySchema, 'Personal place');
        const place = await updateMyMapPersonalPlace(db, user, mapId, personalPlaceId, body);
        return c.json(place);
    } catch (err) {
        console.error('patchMyMapPersonalPlace Error:', err);
        return c.json({ error: err.message || 'Failed to update personal place' }, err.status || 500);
    }
};

export const patchMyMapPersonalPlaceShortDescriptor = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        const personalPlaceId = parsePersonalPlaceId(c.req.param('placeId'));
        if (!mapId || !personalPlaceId) {
            return c.json({ error: 'Map id and personal place id are required' }, 400);
        }
        const body = validateRequestBody(
            await c.req.json(),
            updateMyMapPersonalPlaceShortDescriptorBodySchema,
            'Personal place short description'
        );
        const place = await updateMyMapPersonalPlaceShortDescriptor(
            db,
            user,
            mapId,
            personalPlaceId,
            body
        );
        return c.json(place);
    } catch (err) {
        console.error('patchMyMapPersonalPlaceShortDescriptor Error:', err);
        return c.json({ error: err.message || 'Failed to update personal place short description' }, err.status || 500);
    }
};

export const deleteMyMapPersonalPlaceRoute = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        const personalPlaceId = parsePersonalPlaceId(c.req.param('placeId'));
        if (!mapId || !personalPlaceId) {
            return c.json({ error: 'Map id and personal place id are required' }, 400);
        }
        const result = await deleteMyMapPersonalPlace(db, user, mapId, personalPlaceId);
        return c.json(result);
    } catch (err) {
        console.error('deleteMyMapPersonalPlace Error:', err);
        return c.json({ error: err.message || 'Failed to remove personal place' }, err.status || 500);
    }
};

export const patchMyMapAssetNotes = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        const resourceType = normalizeResourceType(c.req.param('resourceType'));
        const resourceId = parseResourceId(c.req.param('resourceId'));
        if (!mapId || !resourceType || !resourceId) {
            return c.json({ error: 'Map id, resourceType, and resourceId are required' }, 400);
        }
        const body = validateRequestBody({
            ...(await c.req.json()),
            resourceType,
            resourceId,
        }, updateMyMapAssetNotesBodySchema, 'Map resource notes');
        const item = await updateMyMapAssetNotes(db, user, mapId, body);
        return c.json(item);
    } catch (err) {
        console.error('patchMyMapAssetNotes Error:', err);
        return c.json({ error: err.message || 'Failed to update map resource notes' }, err.status || 500);
    }
};

export const patchMyMapAssetShortDescriptor = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        const resourceType = normalizeResourceType(c.req.param('resourceType'));
        const resourceId = parseResourceId(c.req.param('resourceId'));
        if (!mapId || !resourceType || !resourceId) {
            return c.json({ error: 'Map id, resourceType, and resourceId are required' }, 400);
        }
        const body = validateRequestBody({
            ...(await c.req.json()),
            resourceType,
            resourceId,
        }, updateMyMapAssetShortDescriptorBodySchema, 'Map resource short description');
        const item = await updateMyMapAssetShortDescriptor(db, user, mapId, body);
        return c.json(item);
    } catch (err) {
        console.error('patchMyMapAssetShortDescriptor Error:', err);
        return c.json({ error: err.message || 'Failed to update map resource short description' }, err.status || 500);
    }
};

export const deleteMyMapAsset = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        const resourceType = normalizeResourceType(c.req.param('resourceType'));
        const resourceId = parseResourceId(c.req.param('resourceId'));
        if (!mapId || !resourceType || !resourceId) {
            return c.json({ error: 'Map id, resourceType, and resourceId are required' }, 400);
        }
        const result = await removeAssetFromMyMap(db, user, mapId, resourceType, resourceId);
        return c.json(result);
    } catch (err) {
        console.error('deleteMyMapAsset Error:', err);
        return c.json({ error: err.message || 'Failed to remove asset from map' }, err.status || 500);
    }
};
