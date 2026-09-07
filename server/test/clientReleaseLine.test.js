import test from 'node:test';
import assert from 'node:assert/strict';

import { getClientReleaseLineErrors } from '../../scripts/validate-client-release-line.mjs';

const RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567';

test('Pages release line accepts a clean main checkout matching origin/main', () => {
    const errors = getClientReleaseLineErrors({
        branch: 'main',
        head: RELEASE_SHA,
        originMain: RELEASE_SHA,
        changes: '',
    });

    assert.deepEqual(errors, []);
});

test('Pages release line rejects feature branches and stale or dirty releases', () => {
    const errors = getClientReleaseLineErrors({
        branch: 'codex/feature',
        head: RELEASE_SHA,
        originMain: 'abcdef0123456789abcdef0123456789abcdef01',
        changes: '?? local-release-file.txt',
    });

    assert.equal(errors.length, 3);
    assert.match(errors[0], /must run from main/);
    assert.match(errors[1], /does not match/);
    assert.match(errors[2], /tracked or untracked/);
});
