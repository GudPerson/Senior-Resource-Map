import { eq, inArray } from 'drizzle-orm';

import {
    audienceZones,
    hardAssets,
    softAssets,
    subregionPostalCodes,
} from '../db/schema.js';
import {
    getAssetAudienceZoneIds,
    resolveMatchedAudienceZoneIds,
    resolveStandardAudienceZoneIds,
} from './audienceZones.js';
import { normalizePostalCode } from './postalBoundaries.js';
import {
    attachHardAssetRegionMatches,
    getActorRegionIds,
} from './regionScope.js';
import { resolveContextPostalCodeFromLocation } from './discoveryLocationContext.js';
import { loadSingaporeFallbackRegion } from './singaporePostalFallback.js';

const RESOURCE_TYPES = new Set(['hard', 'soft']);

function toPositiveInteger(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function uniqueSortedIntegers(values = []) {
    return [...new Set(
        values
            .map(toPositiveInteger)
            .filter(Number.isInteger)
    )].sort((left, right) => left - right);
}

function hasIntersection(left = [], right = []) {
    const rightSet = new Set(uniqueSortedIntegers(right));
    if (rightSet.size === 0) return false;
    return uniqueSortedIntegers(left).some((value) => rightSet.has(value));
}

function excludeRegionIds(regionIds = [], ignoredRegionIds = []) {
    const ignoredRegionIdSet = new Set(uniqueSortedIntegers(ignoredRegionIds));
    if (ignoredRegionIdSet.size === 0) return uniqueSortedIntegers(regionIds);
    return uniqueSortedIntegers(regionIds).filter((regionId) => !ignoredRegionIdSet.has(regionId));
}

function buildResourceKey(type, id) {
    return `${type}:${id}`;
}

async function loadAudienceZoneIdsByHardAssetId(db, hardAssetIds = []) {
    const normalizedHardAssetIds = uniqueSortedIntegers(hardAssetIds);
    const idsByHardAssetId = new Map();
    if (normalizedHardAssetIds.length === 0) return idsByHardAssetId;

    const rows = await db
        .select({
            hardAssetId: audienceZones.hardAssetId,
            audienceZoneId: audienceZones.id,
        })
        .from(audienceZones)
        .where(inArray(audienceZones.hardAssetId, normalizedHardAssetIds));

    for (const row of rows) {
        const hardAssetId = toPositiveInteger(row.hardAssetId);
        const audienceZoneId = toPositiveInteger(row.audienceZoneId);
        if (!hardAssetId || !audienceZoneId) continue;
        if (!idsByHardAssetId.has(hardAssetId)) {
            idsByHardAssetId.set(hardAssetId, []);
        }
        idsByHardAssetId.get(hardAssetId).push(audienceZoneId);
    }

    return idsByHardAssetId;
}

export function normalizeDiscoveryIndicatorResources(resources = []) {
    const seen = new Set();
    const normalized = [];

    for (const resource of Array.isArray(resources) ? resources : []) {
        const type = String(resource?.type || resource?.resourceType || '').trim().toLowerCase();
        const id = toPositiveInteger(resource?.id ?? resource?.resourceId);
        if (!RESOURCE_TYPES.has(type) || !id) continue;

        const key = buildResourceKey(type, id);
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push({ type, id });
    }

    return normalized;
}

export function buildDiscoveryLocationIndicators(resources = [], context = {}) {
    const audienceZoneIds = uniqueSortedIntegers(context.audienceZoneIds || []);
    const contextRegionIds = uniqueSortedIntegers(context.contextRegionIds || []);
    const homeRegionIds = uniqueSortedIntegers(context.homeRegionIds || []);
    const indicators = {};

    for (const resource of resources || []) {
        const type = String(resource?.type || '').trim().toLowerCase();
        const id = toPositiveInteger(resource?.id);
        if (!RESOURCE_TYPES.has(type) || !id) continue;

        const matchingRegionIds = uniqueSortedIntegers(resource.matchingRegionIds || []);
        const assignedAudienceZoneIds = uniqueSortedIntegers(resource.audienceZoneIds || []);
        const isAudienceZoneResource = resource.audienceMode === 'audience_zones';

        indicators[buildResourceKey(type, id)] = {
            withinAudienceZone: Boolean(
                isAudienceZoneResource
                && hasIntersection(assignedAudienceZoneIds, audienceZoneIds)
            ),
            withinHomeRegion: hasIntersection(matchingRegionIds, homeRegionIds),
            withinContextRegion: hasIntersection(matchingRegionIds, contextRegionIds),
        };
    }

    return indicators;
}

export async function resolveRegionIdsForPostal(db, rawPostalCode) {
    const postalCode = normalizePostalCode(rawPostalCode);
    if (!postalCode) return [];

    const rows = await db
        .select({ subregionId: subregionPostalCodes.subregionId })
        .from(subregionPostalCodes)
        .where(eq(subregionPostalCodes.postalCode, postalCode));

    return uniqueSortedIntegers(rows.map((row) => row.subregionId));
}

export async function buildDiscoveryIndicatorContext(db, user, options = {}) {
    const singaporeRegion = await loadSingaporeFallbackRegion(db);
    const ignoredRegionIds = singaporeRegion?.id ? [singaporeRegion.id] : [];
    const contextPostalCode = normalizePostalCode(options.contextPostalCode)
        || await resolveContextPostalCodeFromLocation(options.contextLocation, {
            env: options.env,
            fetchImpl: options.fetchImpl,
            cacheTtlMs: options.cacheTtlMs,
        });
    const sessionRegionIds = excludeRegionIds(getActorRegionIds(user), ignoredRegionIds);
    const homeRegionIds = sessionRegionIds.length > 0
        ? sessionRegionIds
        : excludeRegionIds(await resolveRegionIdsForPostal(db, user?.postalCode), ignoredRegionIds);
    const [homeAudienceZoneIds, contextAudienceZoneIds, contextRegionIds] = await Promise.all([
        resolveStandardAudienceZoneIds(db, user).then((ids) => [...ids]),
        resolveMatchedAudienceZoneIds(db, contextPostalCode).then((ids) => [...ids]),
        resolveRegionIdsForPostal(db, contextPostalCode)
            .then((regionIds) => excludeRegionIds(regionIds, ignoredRegionIds)),
    ]);

    return {
        audienceZoneIds: uniqueSortedIntegers([
            ...homeAudienceZoneIds,
            ...contextAudienceZoneIds,
        ]),
        contextRegionIds,
        homeRegionIds,
    };
}

async function attachRegionMetadataToHardAssets(db, assets = []) {
    const uniqueAssets = [...new Map(
        assets
            .filter(Boolean)
            .map((asset) => [Number(asset.id), asset])
    ).values()];
    if (uniqueAssets.length === 0) return [];

    const singaporeRegion = await loadSingaporeFallbackRegion(db);
    const postalCodes = [...new Set(
        uniqueAssets
            .map((asset) => normalizePostalCode(asset.postalCode))
            .filter(Boolean)
    )];
    const regionRows = postalCodes.length > 0
        ? await db.select({
            postalCode: subregionPostalCodes.postalCode,
            subregionId: subregionPostalCodes.subregionId,
        })
            .from(subregionPostalCodes)
            .where(inArray(subregionPostalCodes.postalCode, postalCodes))
        : [];

    return attachHardAssetRegionMatches(uniqueAssets, regionRows, {
        singaporeRegionId: singaporeRegion?.id,
    });
}

export async function loadDiscoveryIndicatorResourceMetadata(db, resources = []) {
    const refs = normalizeDiscoveryIndicatorResources(resources);
    if (refs.length === 0) return [];

    const hardIds = refs.filter((resource) => resource.type === 'hard').map((resource) => resource.id);
    const softIds = refs.filter((resource) => resource.type === 'soft').map((resource) => resource.id);
    const metadata = [];

    const hardRows = hardIds.length > 0
        ? await db.query.hardAssets.findMany({
            where: inArray(hardAssets.id, hardIds),
        })
        : [];
    const hardRowsWithRegions = await attachRegionMetadataToHardAssets(db, hardRows);
    const audienceZoneIdsByHardAssetId = await loadAudienceZoneIdsByHardAssetId(db, hardIds);

    for (const asset of hardRowsWithRegions) {
        const audienceZoneIds = uniqueSortedIntegers(audienceZoneIdsByHardAssetId.get(Number(asset.id)) || []);
        metadata.push({
            type: 'hard',
            id: asset.id,
            audienceMode: audienceZoneIds.length > 0 ? 'audience_zones' : 'public',
            audienceZoneIds,
            matchingRegionIds: asset.matchingRegionIds || [],
        });
    }

    const softRows = softIds.length > 0
        ? await db.query.softAssets.findMany({
            where: inArray(softAssets.id, softIds),
            with: {
                parent: {
                    columns: { id: true },
                    with: {
                        audienceZones: {
                            with: {
                                audienceZone: { columns: { id: true } },
                            },
                        },
                    },
                },
                audienceZones: {
                    with: {
                        audienceZone: { columns: { id: true } },
                    },
                },
                hostHardAsset: true,
                locations: {
                    with: {
                        hardAsset: true,
                    },
                },
                regionCoverages: {
                    columns: { subregionId: true },
                },
            },
        })
        : [];
    const linkedHardAssets = softRows.flatMap((asset) => [
        asset.hostHardAsset,
        ...(Array.isArray(asset.locations)
            ? asset.locations.map((location) => location?.hardAsset)
            : []),
    ]).filter(Boolean);
    const linkedHardAssetsWithRegions = await attachRegionMetadataToHardAssets(db, linkedHardAssets);
    const linkedRegionIdsByHardAssetId = new Map(
        linkedHardAssetsWithRegions.map((asset) => [Number(asset.id), asset.matchingRegionIds || []])
    );
    const linkedAudienceZoneIdsByHardAssetId = await loadAudienceZoneIdsByHardAssetId(
        db,
        linkedHardAssets.map((asset) => asset.id),
    );

    for (const asset of softRows) {
        const linkedAudienceZoneIds = [
            ...(linkedAudienceZoneIdsByHardAssetId.get(Number(asset.hostHardAsset?.id)) || []),
            ...(Array.isArray(asset.locations)
                ? asset.locations.flatMap((location) => (
                    linkedAudienceZoneIdsByHardAssetId.get(Number(location?.hardAsset?.id)) || []
                ))
                : []),
        ];
        const audienceZoneIds = uniqueSortedIntegers([
            ...getAssetAudienceZoneIds(asset),
            ...linkedAudienceZoneIds,
        ]);
        const linkedRegionIds = [
            ...(linkedRegionIdsByHardAssetId.get(Number(asset.hostHardAsset?.id)) || []),
            ...(Array.isArray(asset.locations)
                ? asset.locations.flatMap((location) => (
                    linkedRegionIdsByHardAssetId.get(Number(location?.hardAsset?.id)) || []
                ))
                : []),
            ...(Array.isArray(asset.regionCoverages)
                ? asset.regionCoverages.map((row) => row.subregionId)
                : []),
            asset.subregionId,
        ];

        metadata.push({
            type: 'soft',
            id: asset.id,
            audienceMode: audienceZoneIds.length > 0 ? 'audience_zones' : (asset.audienceMode || 'public'),
            audienceZoneIds,
            matchingRegionIds: uniqueSortedIntegers(linkedRegionIds),
        });
    }

    const metadataByKey = new Map(metadata.map((resource) => [buildResourceKey(resource.type, resource.id), resource]));
    return refs
        .map((resource) => metadataByKey.get(buildResourceKey(resource.type, resource.id)))
        .filter(Boolean);
}
