import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildHardAssetPostSaveStatus,
    formatHardAssetSaveError,
    hardAssetTranslationFieldsChanged,
    runHardAssetPostSaveTask,
    scheduleHardAssetPostSaveTask,
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

test('hard asset translation follow-up runs only for English text changes', () => {
    const existing = {
        name: 'Senior Corner',
        subCategory: 'Active Ageing Centre',
        address: 'Blk 1',
        hours: 'Mon-Fri',
        description: 'Exercises and talks.',
        logoUrl: 'https://example.test/old.png',
    };

    assert.equal(hardAssetTranslationFieldsChanged(existing, {
        ...existing,
        logoUrl: 'https://example.test/new.png',
    }), false);

    assert.equal(hardAssetTranslationFieldsChanged(existing, {
        logoUrl: 'https://example.test/new.png',
    }), false);

    assert.equal(hardAssetTranslationFieldsChanged(existing, {
        ...existing,
        description: 'Exercises, talks, and karaoke.',
    }), true);
});

test('scheduleHardAssetPostSaveTask queues follow-ups through waitUntil', async () => {
    let queuedPromise = null;
    const status = scheduleHardAssetPostSaveTask({
        executionCtx: {
            waitUntil(promise) {
                queuedPromise = promise;
            },
        },
    }, 'mapCache', async () => 'done');

    assert.equal(status.status, 'queued');
    assert.equal(status.taskName, 'mapCache');
    assert.ok(queuedPromise);
    assert.deepEqual(await queuedPromise, { ok: true, result: 'done' });
});
