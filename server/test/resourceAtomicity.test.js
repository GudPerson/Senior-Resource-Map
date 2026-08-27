import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const hardControllerUrl = new URL('../src/controllers/hardAssetsController.js', import.meta.url);
const softControllerUrl = new URL('../src/controllers/softAssetsController.js', import.meta.url);

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

test('Place updates commit the resource and tag replacement in one atomic batch', async () => {
    const source = await readFile(hardControllerUrl, 'utf8');
    const updateSource = sourceBetween(
        source,
        'export const updateHardAsset = async (c) => {',
        'export const deleteHardAsset = async (c) => {',
    );

    assert.match(updateSource, /buildResourceWriteLockQuery\(db, 'hardAsset', id\)/);
    assert.match(updateSource, /buildAssetTagReplacementQueries\(db, id, 'hard', tagIds\)/);
    assert.match(updateSource, /executeAtomicBatch\(db, coreWriteQueries, 'hard asset update'\)/);
    assert.doesNotMatch(updateSource, /runHardAssetPostSaveTask\('tags'/);
});

test('Offering updates batch the primary row, schedule version and replace-style relations', async () => {
    const source = await readFile(softControllerUrl, 'utf8');
    const updateSource = sourceBetween(
        source,
        'export const updateSoftAsset = async (c) => {',
        'export const resetSoftAssetOverrides = async (c) => {',
    );

    assert.match(updateSource, /buildResourceWriteLockQuery\(db, 'softAsset', id\)/);
    assert.match(updateSource, /db\.insert\(offeringScheduleVersions\)\.values\(versionRows\)/);
    assert.match(updateSource, /softAssetLocations/);
    assert.match(updateSource, /buildAssetTagReplacementQueries\(db, id, 'soft', tagIds\)/);
    assert.match(updateSource, /softAssetAudienceZones/);
    assert.match(updateSource, /softAssetRegionCoverages/);
    assert.match(updateSource, /executeAtomicBatch\(db, coreWriteQueries, 'Offering update'\)/);
    assert.doesNotMatch(updateSource, /onConflictDoNothing\(\)[\s\S]*versionRows/);
});

test('Group primary data, tags and target Regions use one atomic batch', async () => {
    const source = await readFile(softControllerUrl, 'utf8');
    const groupSource = sourceBetween(
        source,
        'async function updateGroupSoftAsset(c, db, user, existing, body) {',
        'function normalizeGroupMemberPayload(body = {}) {',
    );

    assert.match(groupSource, /buildResourceWriteLockQuery\(db, 'softAsset', existing\.id\)/);
    assert.match(groupSource, /buildAssetTagReplacementQueries\(db, existing\.id, 'soft', tagIds\)/);
    assert.match(groupSource, /softAssetRegionCoverages/);
    assert.match(groupSource, /executeAtomicBatch\(db,[\s\S]*'Group update'\)/);
});
