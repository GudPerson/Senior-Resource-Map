import test from 'node:test';
import assert from 'node:assert/strict';

import {
    compareSchema,
    normalizePgArray,
    normalizePgIdentifier,
    normalizeSchemaType,
} from '../scripts/audit_schema_alignment.mjs';

test('schema alignment normalizes Drizzle and PostgreSQL type names', () => {
    assert.equal(normalizeSchemaType('serial'), 'integer');
    assert.equal(normalizeSchemaType('varchar(128)'), 'character varying(128)');
    assert.equal(normalizeSchemaType('timestamp'), 'timestamp without time zone');
    assert.equal(normalizeSchemaType('numeric(10, 7)'), 'numeric(10,7)');
    assert.deepEqual(normalizePgArray('{standard,guest}'), ['standard', 'guest']);
    assert.equal(normalizePgIdentifier('a'.repeat(70)), 'a'.repeat(63));
});

test('schema alignment reports structural drift without row or credential data', () => {
    const expected = {
        tables: [{
            name: 'users',
            columns: [
                { name: 'id', type: 'integer', notNull: true },
                { name: 'email', type: 'character varying(255)', notNull: true },
            ],
            indexes: ['users_email_normalized_unique'],
            constraints: ['users_pkey'],
        }],
        enums: [{ name: 'role', values: ['standard', 'guest'] }],
    };
    const actual = {
        tables: [{
            name: 'users',
            columns: [
                { name: 'id', type: 'integer', notNull: true },
                { name: 'email', type: 'text', notNull: false },
                { name: 'legacy_flag', type: 'boolean', notNull: false },
            ],
            indexes: [],
            constraints: ['users_pkey'],
        }],
        enums: [{ name: 'role', values: ['standard'] }],
    };

    const result = compareSchema(expected, actual);

    assert.equal(result.status, 'drift_detected');
    assert.equal(result.issueCount, 5);
    assert.deepEqual(result.drift.extraColumns, ['users.legacy_flag']);
    assert.deepEqual(result.drift.missingIndexes, ['users.users_email_normalized_unique']);
    assert.deepEqual(result.drift.typeMismatches, [{
        column: 'users.email',
        expected: 'character varying(255)',
        actual: 'text',
    }]);
    assert.deepEqual(result.drift.nullabilityMismatches, [{
        column: 'users.email',
        expectedNotNull: true,
        actualNotNull: false,
    }]);
    assert.deepEqual(result.drift.enumValueMismatches, [{
        name: 'role',
        expected: ['standard', 'guest'],
        actual: ['standard'],
    }]);
});

test('schema alignment accepts a matching metadata projection', () => {
    const projection = {
        tables: [{
            name: 'users',
            columns: [{ name: 'id', type: 'integer', notNull: true }],
            indexes: [],
            constraints: ['users_pkey'],
        }],
        enums: [],
    };

    const result = compareSchema(projection, projection);

    assert.equal(result.status, 'aligned');
    assert.equal(result.issueCount, 0);
});
