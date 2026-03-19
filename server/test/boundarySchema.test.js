import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRunRuntimeSchemaBootstrap } from '../src/utils/boundarySchema.js';

test('runtime schema bootstrap is disabled by default in production', () => {
    assert.equal(
        shouldRunRuntimeSchemaBootstrap({ NODE_ENV: 'production' }),
        false
    );
});

test('runtime schema bootstrap stays enabled outside production', () => {
    assert.equal(
        shouldRunRuntimeSchemaBootstrap({ NODE_ENV: 'development' }),
        true
    );
});

test('runtime schema bootstrap can be explicitly enabled in production', () => {
    assert.equal(
        shouldRunRuntimeSchemaBootstrap({
            NODE_ENV: 'production',
            ALLOW_RUNTIME_SCHEMA_BOOTSTRAP: 'true',
        }),
        true
    );
});
