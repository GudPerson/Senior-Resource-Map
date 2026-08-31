import test from 'node:test';
import assert from 'node:assert/strict';
import { drizzle } from 'drizzle-orm/neon-http';

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
            return {
                from(source) {
                    return { selection, source };
                },
            };
        },
    };

    buildResourceWriteLockQuery(db, 'hardAsset', 7);
    buildResourceWriteLockQuery(db, 'softAsset', 7);
    assert.equal(selections.length, 2);
    assert.notDeepEqual(selections[0], selections[1]);
    assert.throws(() => buildResourceWriteLockQuery(db, 'unknown', 7), /Unsupported resource/);
    assert.throws(() => buildResourceWriteLockQuery(db, 'hardAsset', 0), /positive integer/);
});

test('resource write locks execute through the Neon HTTP batch driver', async () => {
    const calls = [];
    const neonClient = (query, params, options) => {
        calls.push({ query, params, options });
        return Promise.resolve({ rows: [[null]] });
    };
    neonClient.transaction = async (queries) => Promise.all(queries);
    const db = drizzle(neonClient);

    const query = buildResourceWriteLockQuery(db, 'hardAsset', 7);
    const result = await executeAtomicBatch(db, [query], 'resource lock test');

    assert.deepEqual(calls.map(({ query: sqlText, params }) => ({ sqlText, params })), [{
        sqlText: 'select pg_advisory_xact_lock($1, $2) from (select 1) as resource_write_lock',
        params: [43101, 7],
    }]);
    assert.deepEqual(result, [[{ locked: null }]]);
});
