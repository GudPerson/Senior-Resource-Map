import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/controllers/hardAssetsController.js', import.meta.url), 'utf8');

function sourceBetween(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

test('managed hard asset summary lists avoid per-page membership and governance enrichment', () => {
    const directSummaryBranch = sourceBetween(
        'if (\n            summaryOnly\n            && shouldUseDirectManagedResourcePagination',
        'const candidateAssets = await db.query.hardAssets.findMany',
    );
    const scopedSummaryBranch = sourceBetween(
        'if (summaryOnly) {',
        'const assets = pagedAssetIds.length > 0 ? await db.query.hardAssets.findMany',
    );

    for (const branch of [directSummaryBranch, scopedSummaryBranch]) {
        assert.doesNotMatch(branch, /loadMembershipSummariesForAssets/);
        assert.doesNotMatch(branch, /loadOrganizationContextsForResources/);
        assert.match(branch, /organizationLinks: \[\]/);
    }

    const detailBranch = sourceBetween(
        'export const getHardAssetById = async (c) => {',
        'export const createHardAsset = async (c) => {',
    );
    assert.match(detailBranch, /loadMembershipSummariesForAssets/);
    assert.match(detailBranch, /loadOrganizationContextsForResources/);
});
