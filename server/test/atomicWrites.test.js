import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildReplacementQueries,
    buildResourceWriteLockQuery,
    executeAtomicBatch,
} from '../src/utils/atomicWrites.js';

test('executeAtomicBatch delegates the complete write set to one database batch', async () => {
    const queries = [{ id: 1 }, { id: 2 }, null];
    const calls = [];
    const db = {
        async batch(received) {
            calls.push(received);
            return ['first', 'second'];
        },
    };

    const result = await executeAtomicBatch(db, queries, 'test update');

    assert.deepEqual(calls, [[queries[0], queries[1]]]);
    assert.deepEqual(result, ['first', 'second']);
});

test('executeAtomicBatch refuses a sequential fallback', async () => {
    await assert.rejects(
        executeAtomicBatch({}, [{ id: 1 }], 'resource update'),
        /requires database batch support/,
    );
});

test('buildReplacementQueries keeps delete and replacement insert in one prepared set', () => {
    const calls = [];
    const db = {
        delete(table) {
            return {
                where(whereClause) {
                    const query = { kind: 'delete', table, whereClause };
                    calls.push(query);
                    return query;
                },
            };
        },
        insert(table) {
            return {
                values(values) {
                    const query = { kind: 'insert', table, values };
                    calls.push(query);
                    return query;
                },
            };
        },
    };

    const queries = buildReplacementQueries(db, 'mapping_table', 'resource = 7', [{ resourceId: 7 }]);

    assert.deepEqual(queries, calls);
    assert.deepEqual(queries.map((query) => query.kind), ['delete', 'insert']);
});

test('resource write locks use distinct namespaces and validate identifiers', () => {
    const selections = [];
    const db = {
        select(selection) {
            selections.push(selection);
            return { selection };
        },
    };

    buildResourceWriteLockQuery(db, 'hardAsset', 7);
    buildResourceWriteLockQuery(db, 'softAsset', 7);
    assert.equal(selections.length, 2);
    assert.notDeepEqual(selections[0], selections[1]);
    assert.throws(() => buildResourceWriteLockQuery(db, 'unknown', 7), /Unsupported resource/);
    assert.throws(() => buildResourceWriteLockQuery(db, 'hardAsset', 0), /positive integer/);
});
