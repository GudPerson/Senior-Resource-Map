import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildHardAssetPostSaveStatus,
    formatHardAssetSaveError,
    runHardAssetPostSaveTask,
} from '../src/controllers/hardAssetsController.js';

test('formatHardAssetSaveError hides Worker subrequest implementation details', () => {
    const message = formatHardAssetSaveError(new Error(
        'Too many subrequests by single Worker invocation. To configure this limit, refer to https://developers.cloudflare.com/workers/wrangler/configuration/#limits',
    ));

    assert.equal(message, 'We could not finish saving this asset right now. Please try again in a moment.');
    assert.doesNotMatch(message, /subrequests/i);
    assert.doesNotMatch(message, /cloudflare/i);
});

test('runHardAssetPostSaveTask converts background failures into partial status', async () => {
    const originalError = console.error;
    console.error = () => undefined;
    let issue;
    try {
        issue = await runHardAssetPostSaveTask('mapCache', async () => {
            throw new Error('Too many subrequests by single Worker invocation.');
        });
    } finally {
        console.error = originalError;
    }

    assert.equal(issue.ok, false);
    assert.equal(issue.taskName, 'mapCache');

    const status = buildHardAssetPostSaveStatus([issue]);
    assert.deepEqual(status, {
        status: 'partial',
        issues: ['mapCache'],
        message: 'Your main changes were saved, but some background updates may take a moment to refresh.',
    });
});
