import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { myMapAssetNotes, myMapAssets, myMaps } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { buildMyMapDirectory, normalizeMyMapAssetSnapshot } from '../utils/myMapDirectory.js';
import { normalizeRole } from '../utils/roles.js';

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function normalizeMapName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function assertCopyViewer(user) {
    if (!user?.id || normalizeRole(user?.role) === 'guest') {
        throw createHttpError(403, 'Only authenticated non-guest users can save a copy');
    }
}

async function loadSharedMapByToken(db, token, includeAssets = false) {
    return db.query.myMaps.findFirst({
        where: and(
            eq(myMaps.shareToken, token),
            eq(myMaps.isShared, true)
        ),
        with: includeAssets
            ? {
                assets: {
                    columns: {
                        id: true,
                        resourceType: true,
                        resourceId: true,
                        snapshot: true,
                        privateNote: true,
                        handoffNote: true,
                        notesUpdatedAt: true,
                        addedAt: true,
                    },
                    with: {
                        notes: {
                            orderBy: [asc(myMapAssetNotes.sortOrder), asc(myMapAssetNotes.id)],
                        },
                    },
                },
                shareSnapshot: true,
            }
            : undefined,
    });
}

async function persistSnapshotUpdates(db, updates) {
    for (const update of updates || []) {
        await db.update(myMapAssets)
            .set({ snapshot: update.snapshot })
            .where(eq(myMapAssets.id, update.mapAssetId));
    }
}

async function requireSharedMap(db, token, includeAssets = false) {
    const map = await loadSharedMapByToken(db, token, includeAssets);
    if (!map) {
        throw createHttpError(404, 'This shared directory is no longer available');
    }
    return map;
}

async function resolveUniqueCopyName(db, userId, originalName) {
    const baseName = normalizeMapName(`Copy of ${originalName}`) || 'Copy of shared directory';
    const maps = await db.query.myMaps.findMany({
        where: eq(myMaps.userId, userId),
    });
    const names = new Set(maps.map((item) => normalizeMapName(item.name)));

    if (!names.has(baseName)) {
        return baseName;
    }

    let counter = 2;
    while (names.has(`${baseName} (${counter})`)) {
        counter += 1;
    }
    return `${baseName} (${counter})`;
}

function createSnapshotViewerSummary(viewerUser, ownerUserId, mapName) {
    const isAuthenticated = Boolean(viewerUser?.id);
    const isOwner = isAuthenticated && viewerUser.id === ownerUserId;
    return {
        isAuthenticated,
        isOwner,
        canSaveCopy: isAuthenticated && !isOwner,
        canSaveResources: isAuthenticated && !isOwner,
        copyDefaultName: isAuthenticated && !isOwner ? `Copy of ${mapName}` : null,
    };
}

function normalizeSnapshotDirectory(map, viewerUser) {
    const snapshot = map?.shareSnapshot?.snapshot;
    if (!snapshot || typeof snapshot !== 'object') return null;
    return {
        ...snapshot,
        share: {
            ...(snapshot.share || {}),
            isShared: true,
            shareToken: map.shareToken || snapshot.share?.shareToken || null,
            sharePath: map.shareToken ? `/shared/maps/${map.shareToken}` : snapshot.share?.sharePath || null,
            shareIncludesHandoffNotes: false,
            shareUpdatedAt: map.shareUpdatedAt || snapshot.share?.shareUpdatedAt || null,
        },
        viewer: createSnapshotViewerSummary(viewerUser, map.userId, map.name),
    };
}

function getSnapshotRows(directory) {
    return (directory?.places || []).flatMap((place) => (
        (place.rows || []).map((row) => ({ place, row }))
    ));
}

function buildCopiedSnapshotFromSharedDirectory(directory, asset) {
    const matchingRows = getSnapshotRows(directory)
        .filter(({ row }) => row.resourceType === asset.resourceType && row.resourceId === asset.resourceId);
    const first = matchingRows[0];
    if (!first) return null;

    return normalizeMyMapAssetSnapshot(asset.resourceType, asset.resourceId, {
        name: first.row.name,
        subCategory: first.row.subCategory,
        bucket: first.row.bucket,
        descriptor: first.row.descriptor,
        logoUrl: first.row.logoUrl,
        availabilityEnabled: first.row.availabilityEnabled,
        availabilityCount: first.row.availabilityCount,
        availabilityUnit: first.row.availabilityUnit,
        detailPath: first.row.detailPath,
        address: first.place.address,
        lat: first.place.lat,
        lng: first.place.lng,
        places: matchingRows.map(({ place }) => ({
            placeId: place.placeId,
            placeKey: place.placeKey,
            name: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
        })),
    });
}

function getSharedSnapshotAssets(directory) {
    return (directory?.assets || [])
        .map((asset) => ({
            resourceType: asset.resourceType,
            resourceId: asset.resourceId,
            snapshot: buildCopiedSnapshotFromSharedDirectory(directory, asset),
            notes: Array.isArray(asset?.notes?.items)
                ? asset.notes.items
                    .map((note, index) => ({
                        text: String(note?.text || '').trim(),
                        sortOrder: index,
                    }))
                    .filter((note) => note.text)
                : [],
        }))
        .filter((asset) => asset.resourceType && Number.isInteger(asset.resourceId));
}

export async function getSharedMapDirectory(db, token, viewerUser) {
    const map = await requireSharedMap(db, token, true);
    const snapshotDirectory = normalizeSnapshotDirectory(map, viewerUser);
    if (snapshotDirectory) {
        return snapshotDirectory;
    }

    const { directory, snapshotUpdates } = await buildMyMapDirectory(db, {
        map,
        viewerUser,
        visibilityUser: { role: 'guest' },
        resolutionContext: {
            allowedPartnerAudienceIds: new Set(),
            allowedAudienceZoneIds: new Set(),
        },
        mode: 'shared',
    });

    if (snapshotUpdates.length > 0) {
        await persistSnapshotUpdates(db, snapshotUpdates);
    }

    return directory;
}

export async function copySharedMapToMyMaps(db, viewerUser, token) {
    assertCopyViewer(viewerUser);
    const map = await requireSharedMap(db, token, true);

    if (viewerUser.id === map.userId) {
        throw createHttpError(409, 'You already own this map');
    }

    const name = await resolveUniqueCopyName(db, viewerUser.id, map.name);
    const snapshotDirectory = normalizeSnapshotDirectory(map, viewerUser);
    const snapshotAssets = snapshotDirectory ? getSharedSnapshotAssets(snapshotDirectory) : null;
    const [createdMap] = await db.insert(myMaps).values({
        userId: viewerUser.id,
        name,
        description: map.description || null,
        isShared: false,
        shareToken: null,
        shareIncludesHandoffNotes: false,
        shareUpdatedAt: null,
    }).returning();

    if (snapshotAssets?.length > 0) {
        const timestamp = new Date();
        const insertedAssets = await db.insert(myMapAssets).values(
            snapshotAssets.map((asset) => ({
                mapId: createdMap.id,
                resourceType: asset.resourceType,
                resourceId: asset.resourceId,
                privateNote: null,
                handoffNote: null,
                notesUpdatedAt: asset.notes.length > 0 ? timestamp : null,
                snapshot: asset.snapshot,
            }))
        ).returning();

        const noteRows = insertedAssets.flatMap((mapAsset, assetIndex) => (
            (snapshotAssets[assetIndex]?.notes || []).map((note, noteIndex) => ({
                mapAssetId: mapAsset.id,
                noteText: note.text,
                isShared: false,
                sortOrder: noteIndex,
                createdAt: timestamp,
                updatedAt: timestamp,
            }))
        ));

        if (noteRows.length > 0) {
            await db.insert(myMapAssetNotes).values(noteRows);
        }
    } else if ((map.assets || []).length > 0) {
        const timestamp = new Date();
        const insertedAssets = await db.insert(myMapAssets).values(
            map.assets.map((asset) => ({
                mapId: createdMap.id,
                resourceType: asset.resourceType,
                resourceId: asset.resourceId,
                privateNote: null,
                handoffNote: null,
                notesUpdatedAt: null,
                snapshot: normalizeMyMapAssetSnapshot(asset.resourceType, asset.resourceId, asset.snapshot),
            }))
        ).returning();

        const noteRows = insertedAssets.flatMap((mapAsset, assetIndex) => {
            const sourceAsset = map.assets[assetIndex];
            const explicitNotes = Array.isArray(sourceAsset?.notes) ? sourceAsset.notes : [];
            if (explicitNotes.length > 0) {
                return explicitNotes
                    .filter((note) => note?.isShared && String(note?.noteText || note?.text || '').trim())
                    .map((note, noteIndex) => ({
                        mapAssetId: mapAsset.id,
                        noteText: String(note.noteText || note.text).trim(),
                        isShared: false,
                        sortOrder: noteIndex,
                        createdAt: timestamp,
                        updatedAt: timestamp,
                    }));
            }

            const legacyNote = map.shareIncludesHandoffNotes ? String(sourceAsset?.handoffNote || '').trim() : '';
            return legacyNote
                ? [{
                    mapAssetId: mapAsset.id,
                    noteText: legacyNote,
                    isShared: false,
                    sortOrder: 0,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                }]
                : [];
        });

        if (noteRows.length > 0) {
            await db.insert(myMapAssetNotes).values(noteRows);
        }
    }

    return {
        id: createdMap.id,
        name: createdMap.name,
        description: createdMap.description || null,
        assetCount: snapshotAssets?.length ?? (map.assets || []).length,
        isShared: false,
        shareToken: null,
        sharePath: null,
        shareIncludesHandoffNotes: false,
        shareUpdatedAt: null,
        createdAt: createdMap.createdAt,
        updatedAt: createdMap.updatedAt,
    };
}

export const getSharedMap = async (c) => {
    try {
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const token = String(c.req.param('token') || '').trim();
        if (!token) {
            return c.json({ error: 'Share token is required' }, 400);
        }
        const viewerUser = c.get('user');
        const directory = await getSharedMapDirectory(db, token, viewerUser);
        return c.json(directory);
    } catch (err) {
        console.error('getSharedMap Error:', err);
        return c.json({ error: err.message || 'Failed to fetch shared directory' }, err.status || 500);
    }
};

export const postSharedMapCopy = async (c) => {
    try {
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const token = String(c.req.param('token') || '').trim();
        if (!token) {
            return c.json({ error: 'Share token is required' }, 400);
        }
        const viewerUser = c.get('user');
        const copied = await copySharedMapToMyMaps(db, viewerUser, token);
        return c.json(copied, 201);
    } catch (err) {
        console.error('postSharedMapCopy Error:', err);
        return c.json({ error: err.message || 'Failed to save a copy of this directory' }, err.status || 500);
    }
};
