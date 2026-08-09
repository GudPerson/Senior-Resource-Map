import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import {
    myMapAssetNotes,
    myMapAssetShortDescriptors,
    myMapAssets,
    myMapPersonalPlaceLinks,
    myMapPrintAnnotationDocuments,
    myMaps,
} from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { normalizeMyMapCategoryOrder } from '../utils/myMapCategoryOrder.js';
import { normalizeMyMapAssetSnapshot } from '../utils/myMapDirectory.js';
import { normalizeRole } from '../utils/roles.js';

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function assertMyMapCopyUser(user) {
    if (!user?.id || normalizeRole(user?.role) === 'guest') {
        throw createHttpError(403, 'Only authenticated non-guest users can duplicate My Maps');
    }
}

function parseMapId(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMapName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function cloneJson(value) {
    if (value === undefined || value === null) return null;
    return JSON.parse(JSON.stringify(value));
}

function formatMyMapCopySummary(map, assetCount, personalPlaceCount) {
    return {
        id: map.id,
        name: map.name,
        description: map.description || null,
        assetCount: assetCount + personalPlaceCount,
        savedResourceCount: assetCount,
        personalPlaceCount,
        isShared: false,
        shareToken: null,
        sharePath: null,
        shareIncludesHandoffNotes: false,
        shareUpdatedAt: null,
        createdAt: map.createdAt,
        updatedAt: map.updatedAt,
    };
}

async function resolveUniqueDuplicateName(db, userId, originalName) {
    const baseName = normalizeMapName(`Copy of ${originalName}`) || 'Copy of map';
    const maps = await db.query.myMaps.findMany({
        where: eq(myMaps.userId, userId),
        columns: {
            name: true,
        },
    });
    const names = new Set(maps.map((map) => normalizeMapName(map.name)));
    if (!names.has(baseName)) return baseName;

    let counter = 2;
    while (names.has(`${baseName} (${counter})`)) {
        counter += 1;
    }
    return `${baseName} (${counter})`;
}

async function loadOwnedMapForDuplicate(db, userId, mapId) {
    const map = await db.query.myMaps.findFirst({
        where: and(
            eq(myMaps.id, mapId),
            eq(myMaps.userId, userId),
        ),
        with: {
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
                orderBy: [asc(myMapAssets.addedAt), asc(myMapAssets.id)],
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
                        columns: {
                            id: true,
                            userId: true,
                        },
                    },
                },
                orderBy: [asc(myMapPersonalPlaceLinks.addedAt), asc(myMapPersonalPlaceLinks.id)],
            },
            printAnnotationDocument: true,
        },
    });

    if (!map) {
        throw createHttpError(404, 'Map not found');
    }
    return map;
}

function buildNoteRows(sourceAssets, insertedAssets, timestamp) {
    return insertedAssets.flatMap((mapAsset, assetIndex) => {
        const sourceAsset = sourceAssets[assetIndex];
        return (sourceAsset?.notes || [])
            .map((note, noteIndex) => ({
                mapAssetId: mapAsset.id,
                noteText: String(note?.noteText ?? note?.text ?? '').trim(),
                isShared: Boolean(note?.isShared),
                sortOrder: Number.isInteger(note?.sortOrder) ? note.sortOrder : noteIndex,
                createdAt: timestamp,
                updatedAt: timestamp,
            }))
            .filter((note) => note.noteText);
    });
}

function buildShortDescriptorRows(sourceAssets, insertedAssets, timestamp) {
    return insertedAssets.flatMap((mapAsset, assetIndex) => {
        const sourceAsset = sourceAssets[assetIndex];
        return (sourceAsset?.shortDescriptors || [])
            .map((descriptor, descriptorIndex) => ({
                mapAssetId: mapAsset.id,
                descriptorText: String(descriptor?.descriptorText ?? descriptor?.text ?? '').trim(),
                textColor: descriptor?.textColor || null,
                highlightColor: descriptor?.highlightColor || null,
                sortOrder: Number.isInteger(descriptor?.sortOrder) ? descriptor.sortOrder : descriptorIndex,
                createdAt: timestamp,
                updatedAt: timestamp,
            }))
            .filter((descriptor) => descriptor.descriptorText);
    });
}

function getOwnedPersonalPlaceLinks(map, userId) {
    const uniqueLinks = new Map();
    (map.personalPlaceLinks || []).forEach((link) => {
        const personalPlaceId = Number(link?.personalPlaceId);
        if (!Number.isInteger(personalPlaceId) || personalPlaceId <= 0) return;
        if (link?.personalPlace?.userId !== userId) return;
        uniqueLinks.set(personalPlaceId, {
            personalPlaceId,
            shortDescriptors: cloneJson(link.shortDescriptors) || [],
        });
    });
    return [...uniqueLinks.values()];
}

export async function duplicateMyMap(db, user, mapId) {
    assertMyMapCopyUser(user);
    const sourceMap = await loadOwnedMapForDuplicate(db, user.id, mapId);
    const timestamp = new Date();
    const name = await resolveUniqueDuplicateName(db, user.id, sourceMap.name);

    const [createdMap] = await db.insert(myMaps).values({
        userId: user.id,
        name,
        description: sourceMap.description || null,
        isShared: false,
        shareToken: null,
        shareIncludesHandoffNotes: false,
        shareUpdatedAt: null,
        categoryOrder: normalizeMyMapCategoryOrder(sourceMap.categoryOrder),
        createdAt: timestamp,
        updatedAt: timestamp,
    }).returning();

    const sourceAssets = Array.isArray(sourceMap.assets) ? sourceMap.assets : [];
    let insertedAssets = [];
    if (sourceAssets.length > 0) {
        insertedAssets = await db.insert(myMapAssets).values(
            sourceAssets.map((asset) => ({
                mapId: createdMap.id,
                resourceType: asset.resourceType,
                resourceId: asset.resourceId,
                snapshot: normalizeMyMapAssetSnapshot(
                    asset.resourceType,
                    asset.resourceId,
                    cloneJson(asset.snapshot),
                ),
                shortDescriptor: asset.shortDescriptor || null,
                shortDescriptorTextColor: asset.shortDescriptorTextColor || null,
                shortDescriptorHighlightColor: asset.shortDescriptorHighlightColor || null,
                privateNote: asset.privateNote || null,
                handoffNote: asset.handoffNote || null,
                notesUpdatedAt: asset.notesUpdatedAt || null,
                addedAt: timestamp,
            })),
        ).returning();

        const noteRows = buildNoteRows(sourceAssets, insertedAssets, timestamp);
        if (noteRows.length > 0) {
            await db.insert(myMapAssetNotes).values(noteRows);
        }

        const shortDescriptorRows = buildShortDescriptorRows(sourceAssets, insertedAssets, timestamp);
        if (shortDescriptorRows.length > 0) {
            await db.insert(myMapAssetShortDescriptors).values(shortDescriptorRows);
        }
    }

    const personalPlaceLinks = getOwnedPersonalPlaceLinks(sourceMap, user.id);
    if (personalPlaceLinks.length > 0) {
        await db.insert(myMapPersonalPlaceLinks).values(
            personalPlaceLinks.map((link) => ({
                mapId: createdMap.id,
                personalPlaceId: link.personalPlaceId,
                shortDescriptors: link.shortDescriptors,
                addedAt: timestamp,
            })),
        );
    }

    const sourceAnnotations = sourceMap.printAnnotationDocument;
    if (Array.isArray(sourceAnnotations?.annotations) && sourceAnnotations.annotations.length > 0) {
        await db.insert(myMapPrintAnnotationDocuments).values({
            mapId: createdMap.id,
            schemaVersion: Number(sourceAnnotations.schemaVersion) || 1,
            annotations: cloneJson(sourceAnnotations.annotations) || [],
            revision: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
        });
    }

    return formatMyMapCopySummary(createdMap, insertedAssets.length, personalPlaceLinks.length);
}

export const postMyMapDuplicate = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const mapId = parseMapId(c.req.param('id'));
        if (!mapId) {
            return c.json({ error: 'Map id is required' }, 400);
        }
        const map = await duplicateMyMap(db, user, mapId);
        return c.json(map, 201);
    } catch (err) {
        console.error('postMyMapDuplicate Error:', err);
        return c.json({ error: err.message || 'Failed to duplicate map' }, err.status || 500);
    }
};
