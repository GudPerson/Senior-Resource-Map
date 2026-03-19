import { count } from 'drizzle-orm';

import { getDb } from '../src/db/index.js';
import {
    audienceZonePostalCodes,
    audienceZones,
    hardAssets,
    softAssetLocations,
    softAssetParents,
    softAssets,
    tags,
    userFavorites,
} from '../src/db/schema.js';
import { ensureBoundarySchema } from '../src/utils/boundarySchema.js';
import { buildCleanSlatePlan, CLEAN_SLATE_TABLES, parseCleanSlateFlags, summarizeCleanSlatePlan } from '../src/utils/cleanSlate.js';

function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

function printHeader(title) {
    console.log(`\n${title}`);
    console.log('-'.repeat(title.length));
}

async function countTableRows(db, table) {
    const [row] = await db.select({ count: count() }).from(table);
    return Number(row?.count ?? 0);
}

async function collectTableCounts(db) {
    const counts = {};
    for (const config of CLEAN_SLATE_TABLES) {
        counts[config.key] = await countTableRows(db, config.table);
    }
    return counts;
}

async function collectAssetState(db) {
    const [hardRows, parentRows, softRows, locationRows, favoriteRows] = await Promise.all([
        db.query.hardAssets.findMany({
            columns: { id: true, isDeleted: true, subregionId: true, partnerId: true },
        }),
        db.query.softAssetParents.findMany({
            columns: { id: true, isDeleted: true, bucket: true, partnerId: true },
        }),
        db.query.softAssets.findMany({
            columns: {
                id: true,
                isDeleted: true,
                assetMode: true,
                parentSoftAssetId: true,
                hostHardAssetId: true,
                bucket: true,
                subregionId: true,
                partnerId: true,
            },
        }),
        db.select().from(softAssetLocations),
        db.select().from(userFavorites),
    ]);

    return { hardRows, parentRows, softRows, locationRows, favoriteRows };
}

function buildAuditSummary({ hardRows, parentRows, softRows, locationRows, favoriteRows }) {
    const activeHardRows = hardRows.filter((row) => !row.isDeleted);
    const activeParentRows = parentRows.filter((row) => !row.isDeleted);
    const activeSoftRows = softRows.filter((row) => !row.isDeleted);
    const activeHardIds = new Set(activeHardRows.map((row) => row.id));
    const activeParentIds = new Set(activeParentRows.map((row) => row.id));
    const activeSoftIds = new Set(activeSoftRows.map((row) => row.id));
    const hardById = new Map(hardRows.map((row) => [row.id, row]));
    const softById = new Map(softRows.map((row) => [row.id, row]));

    const locationCountBySoftId = new Map();
    for (const row of locationRows) {
        locationCountBySoftId.set(row.softAssetId, (locationCountBySoftId.get(row.softAssetId) || 0) + 1);
    }

    const activeChildRows = activeSoftRows.filter((row) => row.assetMode === 'child');
    const activeStandaloneRows = activeSoftRows.filter((row) => row.assetMode !== 'child');

    const orphanFavorites = favoriteRows.filter((favorite) => {
        if (favorite.resourceType === 'hard') return !activeHardIds.has(favorite.resourceId);
        if (favorite.resourceType === 'soft') return !activeSoftIds.has(favorite.resourceId);
        return true;
    });

    const childMissingParent = activeChildRows.filter((row) => !activeParentIds.has(row.parentSoftAssetId));
    const childMissingHost = activeChildRows.filter((row) => !activeHardIds.has(row.hostHardAssetId));
    const childWithLegacyLocations = activeChildRows.filter((row) => (locationCountBySoftId.get(row.id) || 0) > 0);
    const childSubregionMismatch = activeChildRows.filter((row) => {
        const host = hardById.get(row.hostHardAssetId);
        return host && host.subregionId !== row.subregionId;
    });

    const standaloneWithHostLink = activeStandaloneRows.filter((row) => row.hostHardAssetId !== null);
    const standaloneWithParentLink = activeStandaloneRows.filter((row) => row.parentSoftAssetId !== null);
    const standaloneMultiHost = activeStandaloneRows.filter((row) => (locationCountBySoftId.get(row.id) || 0) > 1);
    const standaloneWithoutLocations = activeStandaloneRows.filter((row) => (locationCountBySoftId.get(row.id) || 0) === 0);

    const locationsTouchingDeletedHard = locationRows.filter((row) => hardById.get(row.hardAssetId)?.isDeleted);
    const locationsTouchingDeletedSoft = locationRows.filter((row) => softById.get(row.softAssetId)?.isDeleted);
    const softMissingBucket = activeSoftRows.filter((row) => isBlank(row.bucket));
    const parentMissingBucket = activeParentRows.filter((row) => isBlank(row.bucket));
    const parentWithoutChildren = activeParentRows.filter((row) => {
        return !activeChildRows.some((child) => child.parentSoftAssetId === row.id);
    });

    return {
        active: {
            hardAssets: activeHardRows.length,
            softAssetParents: activeParentRows.length,
            softAssets: activeSoftRows.length,
            standaloneSoftAssets: activeStandaloneRows.length,
            childSoftAssets: activeChildRows.length,
        },
        deleted: {
            hardAssets: hardRows.length - activeHardRows.length,
            softAssetParents: parentRows.length - activeParentRows.length,
            softAssets: softRows.length - activeSoftRows.length,
        },
        integrity: {
            orphanFavorites: orphanFavorites.length,
            childMissingParent: childMissingParent.length,
            childMissingHost: childMissingHost.length,
            childWithLegacyLocations: childWithLegacyLocations.length,
            childSubregionMismatch: childSubregionMismatch.length,
            standaloneWithHostLink: standaloneWithHostLink.length,
            standaloneWithParentLink: standaloneWithParentLink.length,
            standaloneMultiHost: standaloneMultiHost.length,
            standaloneWithoutLocations: standaloneWithoutLocations.length,
            locationsTouchingDeletedHard: locationsTouchingDeletedHard.length,
            locationsTouchingDeletedSoft: locationsTouchingDeletedSoft.length,
            softMissingBucket: softMissingBucket.length,
            parentMissingBucket: parentMissingBucket.length,
            parentWithoutChildren: parentWithoutChildren.length,
        },
        samples: {
            orphanFavorites: orphanFavorites.slice(0, 10),
            childMissingParent: childMissingParent.slice(0, 10),
            childMissingHost: childMissingHost.slice(0, 10),
            childWithLegacyLocations: childWithLegacyLocations.slice(0, 10),
            childSubregionMismatch: childSubregionMismatch.slice(0, 10),
            standaloneMultiHost: standaloneMultiHost.slice(0, 10),
            standaloneWithoutLocations: standaloneWithoutLocations.slice(0, 10),
            locationsTouchingDeletedHard: locationsTouchingDeletedHard.slice(0, 10),
            locationsTouchingDeletedSoft: locationsTouchingDeletedSoft.slice(0, 10),
            parentWithoutChildren: parentWithoutChildren.slice(0, 10),
        },
    };
}

async function main() {
    const flags = parseCleanSlateFlags();
    const plan = buildCleanSlatePlan(flags);
    const db = getDb(process.env);
    await ensureBoundarySchema(db);

    const [tableCounts, assetState, audienceZoneCount, audienceZonePostalCount, tagCount] = await Promise.all([
        collectTableCounts(db),
        collectAssetState(db),
        countTableRows(db, audienceZones),
        countTableRows(db, audienceZonePostalCodes),
        countTableRows(db, tags),
    ]);

    const summary = buildAuditSummary(assetState);
    const payload = {
        generatedAt: new Date().toISOString(),
        plan: summarizeCleanSlatePlan(plan),
        tableCounts,
        summary,
        context: {
            audienceZones: audienceZoneCount,
            audienceZonePostalCodes: audienceZonePostalCount,
            tags: tagCount,
        },
    };

    if (flags.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
    }

    printHeader('Clean-Slate Audit');
    console.log(`Generated at: ${payload.generatedAt}`);

    printHeader('Planned Reset Scope');
    console.table([
        { action: 'reset', tables: plan.reset.map((entry) => entry.label).join(', ') },
        { action: 'preserve', tables: plan.preserve.map((entry) => entry.label).join(', ') },
    ]);

    printHeader('Table Counts');
    console.table(
        CLEAN_SLATE_TABLES.map((entry) => ({
            table: entry.label,
            rows: tableCounts[entry.key] ?? 0,
        }))
    );

    printHeader('Architecture Summary');
    console.table([
        { metric: 'active hard assets', value: summary.active.hardAssets },
        { metric: 'active templates', value: summary.active.softAssetParents },
        { metric: 'active soft assets', value: summary.active.softAssets },
        { metric: 'active standalone soft assets', value: summary.active.standaloneSoftAssets },
        { metric: 'active child soft assets', value: summary.active.childSoftAssets },
        { metric: 'deleted hard assets', value: summary.deleted.hardAssets },
        { metric: 'deleted templates', value: summary.deleted.softAssetParents },
        { metric: 'deleted soft assets', value: summary.deleted.softAssets },
    ]);

    printHeader('Integrity Checks');
    console.table([
        { check: 'orphan favorites', count: summary.integrity.orphanFavorites },
        { check: 'child offerings missing parent', count: summary.integrity.childMissingParent },
        { check: 'child offerings missing host', count: summary.integrity.childMissingHost },
        { check: 'child offerings using legacy location links', count: summary.integrity.childWithLegacyLocations },
        { check: 'child offerings with host/subregion mismatch', count: summary.integrity.childSubregionMismatch },
        { check: 'standalone offerings with host link set', count: summary.integrity.standaloneWithHostLink },
        { check: 'standalone offerings with parent link set', count: summary.integrity.standaloneWithParentLink },
        { check: 'legacy multi-host standalone offerings', count: summary.integrity.standaloneMultiHost },
        { check: 'standalone offerings without locations', count: summary.integrity.standaloneWithoutLocations },
        { check: 'location links touching deleted hard assets', count: summary.integrity.locationsTouchingDeletedHard },
        { check: 'location links touching deleted soft assets', count: summary.integrity.locationsTouchingDeletedSoft },
        { check: 'active soft assets missing bucket', count: summary.integrity.softMissingBucket },
        { check: 'active templates missing bucket', count: summary.integrity.parentMissingBucket },
        { check: 'templates without active children', count: summary.integrity.parentWithoutChildren },
    ]);

    const sampleEntries = Object.entries(summary.samples).filter(([, sample]) => sample.length > 0);
    for (const [key, sample] of sampleEntries) {
        printHeader(`Sample: ${key}`);
        console.table(sample);
    }

    console.log('\nDry-run only. When you are satisfied with the scope, run:');
    console.log('node --env-file=server/.env server/scripts/reset_clean_slate.js --apply');
    console.log('\nOptional flags: --include-audience-zones --include-partner-boundaries --include-subregion-postcodes --include-subcategories');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
