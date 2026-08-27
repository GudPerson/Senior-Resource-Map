import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { myMapAssetNotes, myMapAssets, myMaps } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    applyEmbeddedResourceContactSnapshot,
    stripEmbeddedResourceContactsFromDirectory,
} from '../utils/embeddedResourceContacts.js';
import { normalizeMyMapCategoryOrder } from '../utils/myMapCategoryOrder.js';
import { normalizeMapEmbedOrigins } from '../utils/mapEmbed.js';
import {
    filterEmbeddedMapDirectoryByResourceAllowlist,
    normalizeEmbeddedMapPresentationSnapshot,
} from '../utils/embeddedMapPresentation.js';
import {
    buildMyMapDirectory,
    isLiveMyMapAssetVisible,
    loadLiveAssetsByKey,
    normalizeMyMapAssetSnapshot,
} from '../utils/myMapDirectory.js';
import { normalizeRole } from '../utils/roles.js';
import { translateSharedMapNotes } from '../utils/sharedNoteTranslations.js';
import { normalizeEmbeddedPrintAnnotationSnapshot } from './printAnnotationsController.js';

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
        with: {
            ...(includeAssets ? {
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
            } : {}),
            shareSnapshot: true,
        },
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

async function requireEmbeddedMap(db, token, includeAssets = false) {
    const map = await requireSharedMap(db, token, includeAssets);
    let allowedOrigins = [];
    try {
        allowedOrigins = normalizeMapEmbedOrigins(map.embedAllowedOrigins);
    } catch {
        // Persisted settings that cannot produce a safe frame-ancestor list fail closed.
    }
    if (!map.embedEnabled || allowedOrigins.length === 0) {
        throw createHttpError(404, 'This embedded map is no longer available');
    }
    if (
        !map.shareSnapshot?.snapshot
        || typeof map.shareSnapshot.snapshot !== 'object'
        || Array.isArray(map.shareSnapshot.snapshot)
        || map.shareSnapshot.shareToken !== map.shareToken
    ) {
        throw createHttpError(404, 'This embedded map is no longer available');
    }
    return { map, allowedOrigins };
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

function normalizeSnapshotDirectory(map, viewerUser, {
    includeEmbeddedAnnotations = false,
    includeEmbeddedResourceContacts = false,
    includeEmbeddedPresentation = false,
} = {}) {
    const snapshot = map?.shareSnapshot?.snapshot;
    if (!snapshot || typeof snapshot !== 'object') return null;
    const {
        embeddedAnnotations,
        embeddedResourceContacts,
        embeddedPresentation,
        embeddedResourceKeys,
        printAnnotations,
        ...sharedSnapshot
    } = snapshot;
    void printAnnotations;
    const publicSnapshot = includeEmbeddedPresentation
        ? filterEmbeddedMapDirectoryByResourceAllowlist(sharedSnapshot, embeddedResourceKeys)
        : sharedSnapshot;
    const directory = {
        ...publicSnapshot,
        ...(includeEmbeddedAnnotations ? {
            printAnnotations: normalizeEmbeddedPrintAnnotationSnapshot(embeddedAnnotations),
        } : {}),
        ...(includeEmbeddedPresentation ? {
            embeddedPresentation: normalizeEmbeddedMapPresentationSnapshot(embeddedPresentation),
        } : {}),
        share: {
            ...(sharedSnapshot.share || {}),
            isShared: true,
            shareToken: map.shareToken || sharedSnapshot.share?.shareToken || null,
            sharePath: map.shareToken ? `/shared/maps/${map.shareToken}` : sharedSnapshot.share?.sharePath || null,
            shareIncludesHandoffNotes: false,
            shareUpdatedAt: map.shareUpdatedAt || snapshot.share?.shareUpdatedAt || null,
        },
        viewer: createSnapshotViewerSummary(viewerUser, map.userId, map.name),
    };
    return includeEmbeddedResourceContacts
        ? applyEmbeddedResourceContactSnapshot(directory, embeddedResourceContacts)
        : stripEmbeddedResourceContactsFromDirectory(directory);
}

async function filterSnapshotDirectoryByLiveVisibility(db, directory) {
    if (!directory) return null;
    const hiddenKeys = new Set();
    const snapshotAssets = (directory.assets || [])
        .map((asset) => ({
            resourceType: asset?.resourceType,
            resourceId: Number.parseInt(String(asset?.resourceId ?? ''), 10),
        }))
        .filter((asset) => (
            ['hard', 'soft'].includes(asset.resourceType)
            && Number.isInteger(asset.resourceId)
            && asset.resourceId > 0
        ));
    const liveAssetsByKey = await loadLiveAssetsByKey(db, snapshotAssets);
    const guestVisibilityContext = {
        allowedPartnerAudienceIds: new Set(),
        allowedAudienceZoneIds: new Set(),
    };

    for (const asset of snapshotAssets) {
        const liveAsset = liveAssetsByKey.get(`${asset.resourceType}-${asset.resourceId}`) || null;
        if (!isLiveMyMapAssetVisible(asset.resourceType, liveAsset, { role: 'guest' }, guestVisibilityContext)) {
            hiddenKeys.add(`${asset.resourceType}:${asset.resourceId}`);
        }
    }

    if (hiddenKeys.size === 0) return directory;

    const assets = (directory.assets || [])
        .filter((asset) => !hiddenKeys.has(`${asset.resourceType}:${asset.resourceId}`));
    const places = (directory.places || [])
        .map((place) => ({
            ...place,
            rows: (place.rows || [])
                .filter((row) => !hiddenKeys.has(`${row.resourceType}:${row.resourceId}`)),
        }))
        .filter((place) => place.rows.length > 0);
    const visiblePlaceKeys = new Set(places.map((place) => place.placeKey));
    const pins = (directory.pins || [])
        .filter((pin) => visiblePlaceKeys.has(pin.placeKey));

    return {
        ...directory,
        assets,
        places,
        pins,
        summary: {
            ...(directory.summary || {}),
            resourceCount: assets.length,
            placeCount: places.length,
            mappablePlaceCount: pins.length,
        },
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

export async function getSharedMapDirectory(db, token, viewerUser, options = {}) {
    const map = await requireSharedMap(db, token, true);
    const snapshotDirectory = normalizeSnapshotDirectory(map, viewerUser, options);
    if (snapshotDirectory) {
        return filterSnapshotDirectoryByLiveVisibility(db, snapshotDirectory);
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

    return options.includeEmbeddedResourceContacts
        ? directory
        : stripEmbeddedResourceContactsFromDirectory(directory);
}

export async function getEmbeddedMapConfig(db, token) {
    const { allowedOrigins } = await requireEmbeddedMap(db, token);
    return { allowedOrigins };
}

export async function getEmbeddedMapDirectory(db, token) {
    await requireEmbeddedMap(db, token);
    const directory = await getSharedMapDirectory(db, token, { role: 'guest' }, {
        includeEmbeddedAnnotations: true,
        includeEmbeddedResourceContacts: true,
        includeEmbeddedPresentation: true,
    });
    const places = (directory.places || []).map((place) => ({
        ...place,
        rows: (place.rows || []).map((row) => {
            const {
                notes,
                saveEligible,
                access,
                missingProfileFields,
                addedAt,
                mapShortDescriptors,
                mapShortDescriptor,
                mapShortDescriptorTextColor,
                mapShortDescriptorHighlightColor,
                ...embeddedRow
            } = row;
            void notes;
            void saveEligible;
            void access;
            void missingProfileFields;
            void addedAt;
            void mapShortDescriptors;
            void mapShortDescriptor;
            void mapShortDescriptorTextColor;
            void mapShortDescriptorHighlightColor;
            return embeddedRow;
        }),
    }));

    return {
        id: directory.id,
        name: directory.name,
        description: directory.description || null,
        createdAt: directory.createdAt || null,
        updatedAt: directory.updatedAt || null,
        categoryOrder: directory.categoryOrder || [],
        summary: directory.summary,
        share: {
            isShared: true,
            shareToken: directory.share?.shareToken || token,
            sharePath: directory.share?.sharePath || `/shared/maps/${token}`,
            shareUpdatedAt: directory.share?.shareUpdatedAt || null,
        },
        places,
        printAnnotations: directory.printAnnotations || [],
        embeddedPresentation: directory.embeddedPresentation,
        viewer: {
            isAuthenticated: false,
            isOwner: false,
            canSaveCopy: false,
            canSaveResources: false,
            copyDefaultName: null,
        },
    };
}

export async function copySharedMapToMyMaps(db, viewerUser, token) {
    assertCopyViewer(viewerUser);
    const map = await requireSharedMap(db, token, true);

    if (viewerUser.id === map.userId) {
        throw createHttpError(409, 'You already own this map');
    }

    const name = await resolveUniqueCopyName(db, viewerUser.id, map.name);
    const snapshotDirectory = await getSharedMapDirectory(db, token, viewerUser);
    const snapshotAssets = getSharedSnapshotAssets(snapshotDirectory);
    const [createdMap] = await db.insert(myMaps).values({
        userId: viewerUser.id,
        name,
        description: map.description || null,
        isShared: false,
        shareToken: null,
        shareIncludesHandoffNotes: false,
        shareUpdatedAt: null,
        categoryOrder: normalizeMyMapCategoryOrder(
            snapshotDirectory?.categoryOrder ?? map.categoryOrder
        ),
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
    }

    return {
        id: createdMap.id,
        name: createdMap.name,
        description: createdMap.description || null,
        assetCount: snapshotAssets.length,
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

export const getEmbeddedMapConfigRoute = async (c) => {
    c.header('Cache-Control', 'no-store');
    try {
        const token = String(c.req.param('token') || '').trim();
        if (!token) return c.json({ error: 'Share token is required' }, 400);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        return c.json(await getEmbeddedMapConfig(db, token));
    } catch (err) {
        console.error('getEmbeddedMapConfigRoute Error:', err);
        return c.json({ error: err.message || 'Embedded map is unavailable' }, err.status || 500);
    }
};

export const getEmbeddedMap = async (c) => {
    c.header('Cache-Control', 'no-store');
    try {
        const token = String(c.req.param('token') || '').trim();
        if (!token) return c.json({ error: 'Share token is required' }, 400);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        return c.json(await getEmbeddedMapDirectory(db, token));
    } catch (err) {
        console.error('getEmbeddedMap Error:', err);
        return c.json({ error: err.message || 'Embedded map is unavailable' }, err.status || 500);
    }
};

export const getSharedMapNoteTranslations = async (c) => {
    try {
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const token = String(c.req.param('token') || '').trim();
        const locale = String(c.req.query('locale') || '').trim();
        if (!token) {
            return c.json({ error: 'Share token is required' }, 400);
        }

        const viewerUser = c.get('user');
        const directory = await getSharedMapDirectory(db, token, viewerUser);
        const payload = await translateSharedMapNotes(c.env, directory, locale);
        return c.json(payload);
    } catch (err) {
        console.error('getSharedMapNoteTranslations Error:', err);
        return c.json({ error: err.message || 'Failed to translate shared notes' }, err.status || 500);
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
