import test from 'node:test';
import assert from 'node:assert/strict';

import { getWorkerReleaseLineErrors } from '../../scripts/validate-worker-release-line.mjs';

const RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567';

test('Worker release line accepts a clean main checkout matching origin/main', () => {
    const errors = getWorkerReleaseLineErrors({
        branch: 'main',
        head: RELEASE_SHA,
        originMain: RELEASE_SHA,
        trackedChanges: '',
    });

    assert.deepEqual(errors, []);
});

test('Worker release line rejects feature branches and stale or dirty releases', () => {
    const errors = getWorkerReleaseLineErrors({
        branch: 'codex/feature',
        head: RELEASE_SHA,
        originMain: 'abcdef0123456789abcdef0123456789abcdef01',
        trackedChanges: ' M server/src/index.js',
    });

    assert.equal(errors.length, 3);
    assert.match(errors[0], /must run from main/);
    assert.match(errors[1], /does not match/);
    assert.match(errors[2], /uncommitted changes/);
});
