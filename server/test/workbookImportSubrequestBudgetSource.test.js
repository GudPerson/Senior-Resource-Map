import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/controllers/workbookController.js', import.meta.url), 'utf8');

function sourceBetween(startMarker, endMarker) {
    return sourceBetweenText(source, startMarker, endMarker);
}

function sourceBetweenText(text, startMarker, endMarker) {
    const start = text.indexOf(startMarker);
    const end = text.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return text.slice(start, end);
}

test('Places workbook import keeps database prefetches and cache refreshes bounded', () => {
    const constants = sourceBetween('const WORKBOOK_CELL_MAX_CHARS', 'const filteredWorkbookFilterSchema');
    const placesImport = sourceBetween('async function importPlaces', 'export function buildWorkbookSchedulePlan');
    const importWorkbookData = source.slice(source.indexOf('export async function importWorkbookData'));
    const importerDispatcher = sourceBetweenText(importWorkbookData, "if (resourceType === 'places')", "} else if (resourceType === 'standalone-offerings')");
    const importReferences = sourceBetween('async function buildImportReferences', 'function buildReferenceRows');
    const placesReferenceBranch = sourceBetweenText(importReferences, "if (resourceType === 'places')", "if (resourceType === 'standalone-offerings'");

    assert.match(constants, /PLACE_IMPORT_PREFETCH_BATCH_SIZE = 1000/);
    assert.match(constants, /PLACE_IMPORT_UPSERT_BATCH_SIZE = 250/);
    assert.doesNotMatch(placesImport, /PREFETCH_BATCH_SIZE = 20/);
    assert.doesNotMatch(placesImport, /UPSERT_BATCH_SIZE = 100/);
    assert.match(placesImport, /PLACE_IMPORT_PREFETCH_BATCH_SIZE/);
    assert.match(placesImport, /PLACE_IMPORT_UPSERT_BATCH_SIZE/);
    assert.match(placesImport, /normalizePostalCode\(row\.postalCode\) \|\| normalizeText\(row\.postalCode\)/);
    assert.match(placesImport, /knownLocation/);
    assert.match(placesImport, /geocodeLocationMap/);
    assert.match(placesImport, /geocodeLocationMap\.set\(postalCode, coords\)/);
    assert.match(placesImport, /scheduleCacheRebuild/);
    assert.match(placesImport, /rebuildPlaceImportMapCaches/);
    assert.match(importerDispatcher, /scheduleWorkbookPostImportTask/);
    assert.match(importerDispatcher, /places-map-cache/);
    assert.match(importReferences, /resourceType === 'places'/);
    assert.match(importReferences, /needsPartners/);
    assert.match(placesReferenceBranch, /loadPartnerLookup/);
    assert.doesNotMatch(placesReferenceBranch, /loadSubregionLookup|loadAudienceZoneLookup/);
});

test('Standalone Offerings workbook import bulk-prefetches and bulk-syncs row relationships', () => {
    const constants = sourceBetween('const WORKBOOK_CELL_MAX_CHARS', 'const filteredWorkbookFilterSchema');
    const offeringsImport = sourceBetween('async function importStandaloneOfferings', 'async function importTemplates');
    const rowValidationLoop = sourceBetweenText(offeringsImport, 'for (const row of rows)', 'const successfulRows =');
    const importWorkbookData = source.slice(source.indexOf('export async function importWorkbookData'));
    const importerDispatcher = sourceBetweenText(importWorkbookData, "} else if (resourceType === 'standalone-offerings')", "} else if (resourceType === 'templates')");

    assert.match(constants, /OFFERING_IMPORT_PREFETCH_BATCH_SIZE = 1000/);
    assert.match(constants, /OFFERING_IMPORT_WRITE_BATCH_SIZE = 100/);
    assert.match(offeringsImport, /allLocationExternalKeys/);
    assert.match(offeringsImport, /existingAssetMap/);
    assert.match(offeringsImport, /loadAudienceZonesByIds/);
    assert.match(offeringsImport, /db\.batch\(updateStatements\)/);
    assert.match(offeringsImport, /db\.insert\(softAssets\)\s*\.values\(payloadChunk\)/);
    assert.match(offeringsImport, /db\.delete\(softAssetTags\)\.where\(inArray\(softAssetTags\.softAssetId, successfulAssetIds\)\)/);
    assert.match(offeringsImport, /db\.delete\(softAssetAudienceZones\)\.where\(inArray\(softAssetAudienceZones\.softAssetId, successfulAssetIds\)\)/);
    assert.match(offeringsImport, /db\.delete\(softAssetLocations\)\.where\(inArray\(softAssetLocations\.softAssetId, successfulAssetIds\)\)/);
    assert.doesNotMatch(rowValidationLoop, /await loadHardAssetByExternalKeys/);
    assert.doesNotMatch(rowValidationLoop, /db\.query\.softAssets\.findFirst/);
    assert.doesNotMatch(rowValidationLoop, /await syncAssetTags/);
    assert.doesNotMatch(rowValidationLoop, /await syncSoftAssetAudienceZones/);
    assert.match(importerDispatcher, /scheduleWorkbookPostImportTask/);
    assert.match(importerDispatcher, /standalone-offerings-map-cache/);
});
