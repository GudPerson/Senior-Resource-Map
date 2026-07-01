import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as XLSX from '@e965/xlsx';

import { parseWorkbookRows } from '../src/controllers/workbookController.js';

const source = readFileSync(new URL('../src/controllers/workbookController.js', import.meta.url), 'utf8');

function sourceBetween(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

function assertSourceContainsAll(block, markers, label) {
    for (const marker of markers) {
        assert.match(block, marker, `${label} should include ${marker}`);
    }
}

function mockUpload(name, buffer) {
    return {
        name,
        size: buffer.length,
        async arrayBuffer() {
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        },
    };
}

test('Group workbook schema uses profile plus membership keys without location columns', () => {
    const groupsConfig = sourceBetween("'groups': {", "'template-rollouts': {");

    assertSourceContainsAll(groupsConfig, [
        /\['externalKey', true/,
        /\['name', true/,
        /\['audienceMode', true/,
        /\['targetSubregionCodes', false/,
        /\['memberPlaceExternalKeys', false/,
        /\['memberOfferingExternalKeys', false/,
        /\['website', false/,
        /\['contactEmail', false/,
        /\['facebookUrl', false/,
    ], 'Groups workbook config');

    assert.doesNotMatch(groupsConfig, /locationExternalKeys|hostExternalKey|templateExternalKey|bucket/);
});

test('Group workbook export serializes members from direct Group membership rows', () => {
    const groupsExport = sourceBetween('async function exportRowsForGroups', 'async function exportRowsForRollouts');

    assertSourceContainsAll(groupsExport, [
        /eq\(softAssets\.assetMode, 'group'\)/,
        /memberPlaceExternalKeys: serializeGroupMemberExternalKeys\(asset\.groupMembers, 'hard'\)/,
        /memberOfferingExternalKeys: serializeGroupMemberExternalKeys\(asset\.groupMembers, 'soft'\)/,
        /targetSubregionCodes: encodeGroupCoverageCodes\(asset\.coverageRegionIds, subregionMap\)/,
        /facebookUrl: serializeSocialLink\(asset\.socialLinks, 'facebook'\)/,
    ], 'Groups export');
});

test('Group workbook import upserts group profile and replaces direct members only', () => {
    const groupsImport = sourceBetween('async function importGroups', 'async function importTemplateRollouts');
    const groupMemberResolver = sourceBetween('async function resolveGroupMemberRowsFromWorkbook', 'function rowError');
    const importDispatcher = sourceBetween("if (resourceType === 'places')", 'await recordExportAudit');

    assertSourceContainsAll(groupsImport, [
        /assetMode: 'group'/,
        /normalizeGroupAudienceModeForWorkbook\(row\.audienceMode\)/,
        /resolveGroupMemberRowsFromWorkbook\(db, row, assetId, actor\)/,
        /softAssetGroupMembers/,
    ], 'Groups import');
    assertSourceContainsAll(groupMemberResolver, [
        /memberPlaceExternalKeys/,
        /memberOfferingExternalKeys/,
        /isPublicGroupMemberEntry/,
    ], 'Groups member resolver');
    assert.match(importDispatcher, /resourceType === 'groups'/);
    assert.doesNotMatch(groupsImport, /softAssetLocations/);
});

test('Group workbook parser accepts profile and membership headers', async () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
        [
            'externalKey *',
            'name *',
            'audienceMode *',
            'targetSubregionCodes',
            'memberPlaceExternalKeys',
            'memberOfferingExternalKeys',
        ],
        ['group-west', 'West care picks', 'public', '', 'place-a, place-b', 'offer-a'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    const file = mockUpload('groups.xlsx', XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

    const rows = await parseWorkbookRows(file, 'groups');

    assert.equal(rows.length, 1);
    assert.equal(rows[0].externalKey, 'group-west');
    assert.equal(rows[0].memberPlaceExternalKeys, 'place-a, place-b');
    assert.equal(rows[0].memberOfferingExternalKeys, 'offer-a');
});
