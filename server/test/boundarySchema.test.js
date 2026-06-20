import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ensureBoundarySchema,
    ensureUserPreferenceColumns,
    resetBoundarySchemaBootstrapForTests,
    shouldRunRuntimeSchemaBootstrap,
} from '../src/utils/boundarySchema.js';

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

test('runtime schema bootstrap can run the Group-only schema gate in production', async () => {
    resetBoundarySchemaBootstrapForTests();
    let calls = 0;
    const db = {
        execute: async () => {
            calls += 1;
        },
    };

    assert.equal(
        shouldRunRuntimeSchemaBootstrap({
            NODE_ENV: 'production',
            ALLOW_RUNTIME_SCHEMA_BOOTSTRAP: 'group-only',
        }),
        true
    );

    await ensureBoundarySchema(db, {
        NODE_ENV: 'production',
        ALLOW_RUNTIME_SCHEMA_BOOTSTRAP: 'group-only',
    });

    assert.equal(calls, 7);
    resetBoundarySchemaBootstrapForTests();
});

test('user preference column bootstrap is skipped in production by default', async () => {
    resetBoundarySchemaBootstrapForTests();
    let calls = 0;
    const db = {
        execute: async () => {
            calls += 1;
        },
    };

    await ensureUserPreferenceColumns(db, { NODE_ENV: 'production' });

    assert.equal(calls, 0);
    resetBoundarySchemaBootstrapForTests();
});

test('user preference column bootstrap still runs outside production', async () => {
    resetBoundarySchemaBootstrapForTests();
    let calls = 0;
    const db = {
        execute: async () => {
            calls += 1;
        },
    };

    await ensureUserPreferenceColumns(db, { NODE_ENV: 'development' });

    assert.equal(calls, 3);
    resetBoundarySchemaBootstrapForTests();
});
