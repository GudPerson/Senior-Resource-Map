import test from 'node:test';
import assert from 'node:assert/strict';

import { hardAssetTags, softAssetTags, tags as tagsTable } from '../src/db/schema.js';
import { syncAssetTags } from '../src/utils/tags.js';

function createFakeTagDb(initialTags = []) {
    const tagRows = [...initialTags];
    const hardMappings = [];
    const softMappings = [];
    const calls = [];
    let nextTagId = tagRows.reduce((max, tag) => Math.max(max, Number(tag.id) || 0), 0) + 1;

    return {
        calls,
        hardMappings,
        softMappings,
        db: {
            delete(table) {
                calls.push({ kind: 'delete', table });
                return {
                    where: async () => undefined,
                };
            },
            select() {
                return {
                    from(table) {
                        return {
                            where: async () => {
                                calls.push({ kind: 'select', table });
                                return table === tagsTable ? [...tagRows] : [];
                            },
                        };
                    },
                };
            },
            insert(table) {
                return {
                    values(valuesInput) {
                        const values = Array.isArray(valuesInput) ? valuesInput : [valuesInput];
                        calls.push({ kind: 'insert', table, count: values.length });

                        if (table === tagsTable) {
                            values.forEach((value) => {
                                if (!tagRows.some((tag) => tag.name === value.name)) {
                                    tagRows.push({ id: nextTagId, name: value.name });
                                    nextTagId += 1;
                                }
                            });
                            return {
                                onConflictDoNothing: async () => undefined,
                            };
                        }

                        if (table === hardAssetTags) {
                            hardMappings.push(...values);
                        } else if (table === softAssetTags) {
                            softMappings.push(...values);
                        }
                        return Promise.resolve(values);
                    },
                };
            },
        },
    };
}

test('syncAssetTags batches tag lookup and mapping inserts', async () => {
    const fake = createFakeTagDb([{ id: 1, name: 'senior' }]);

    await syncAssetTags(fake.db, 42, 'hard', ['Senior', 'caregiver', 'senior', '']);

    assert.equal(fake.calls.filter((call) => call.kind === 'select').length, 2);
    assert.deepEqual(fake.calls
        .filter((call) => call.kind === 'insert' && call.table === hardAssetTags)
        .map((call) => call.count), [2]);
    assert.deepEqual(fake.hardMappings, [
        { hardAssetId: 42, tagId: 1 },
        { hardAssetId: 42, tagId: 2 },
    ]);
});
