import test from 'node:test';
import assert from 'node:assert/strict';

import { importPlaces } from '../src/controllers/workbookController.js';
import { hardAssets, hardAssetTags, subregionPostalCodes, tags } from '../src/db/schema.js';

function normalizeValues(values) {
    return Array.isArray(values) ? values : [values];
}

function createBudgetDb(existingPlaces = []) {
    const placesByKey = new Map(existingPlaces.map((place) => [place.externalKey, { ...place }]));
    const tagRows = [];
    const hardTagMappings = [];
    const counters = {
        subregionPrefetches: 0,
        placePrefetches: 0,
        coreUpserts: 0,
        tagInserts: 0,
        tagSelects: 0,
        relationshipBatches: 0,
    };
    let nextPlaceId = existingPlaces.reduce((max, place) => Math.max(max, place.id), 0) + 1;
    let nextTagId = 1;

    function createStatement(kind, table = null) {
        return {
            kind,
            table,
            inputValues: [],
            executed: false,
            values(values) { this.inputValues = normalizeValues(values); return this; },
            from(nextTable) { this.table = nextTable; return this; },
            innerJoin() { return this; },
            where() { return this; },
            onConflictDoNothing() { return this; },
            onConflictDoUpdate() { return this; },
            async execute() {
                if (this.executed) return [];
                this.executed = true;

                if (this.kind === 'select' && this.table === subregionPostalCodes) {
                    counters.subregionPrefetches += 1;
                    return [{
                        postalCode: '640706',
                        subregion: { id: 7, name: 'Singapore', subregionCode: 'SIN' },
                    }];
                }
                if (this.kind === 'select' && this.table === tags) {
                    counters.tagSelects += 1;
                    return tagRows.map((tag) => ({ ...tag }));
                }
                if (this.kind === 'insert' && this.table === hardAssets) {
                    counters.coreUpserts += 1;
                    return this.inputValues.map((payload) => {
                        const existing = placesByKey.get(payload.externalKey);
                        const saved = existing
                            ? { ...existing, ...payload }
                            : { ...payload, id: nextPlaceId++ };
                        placesByKey.set(payload.externalKey, saved);
                        return { id: saved.id, externalKey: saved.externalKey };
                    });
                }
                if (this.kind === 'insert' && this.table === tags) {
                    counters.tagInserts += 1;
                    this.inputValues.forEach(({ name }) => {
                        if (!tagRows.some((tag) => tag.name === name)) {
                            tagRows.push({ id: nextTagId++, name });
                        }
                    });
                    return [];
                }
                if (this.kind === 'delete' && this.table === hardAssetTags) {
                    hardTagMappings.length = 0;
                    return [];
                }
                if (this.kind === 'insert' && this.table === hardAssetTags) {
                    hardTagMappings.push(...this.inputValues.map((mapping) => ({ ...mapping })));
                    return [];
                }
                return [];
            },
            returning() { return this.execute(); },
            then(resolve, reject) { return this.execute().then(resolve, reject); },
        };
    }

    const db = {
        query: {
            hardAssets: {
                async findMany() {
                    counters.placePrefetches += 1;
                    return [...placesByKey.values()].map((place) => ({ ...place }));
                },
            },
        },
        select() { return createStatement('select'); },
        insert(table) { return createStatement('insert', table); },
        delete(table) { return createStatement('delete', table); },
        async batch(statements) {
            counters.relationshipBatches += 1;
            for (const statement of statements) await statement.execute();
            return [];
        },
    };

    return { db, counters, hardTagMappings, placesByKey, tagRows };
}

function buildRows(count) {
    return Array.from({ length: count }, (_, index) => ({
        __rowNumber: index + 2,
        externalKey: `place-budget-${index}`,
        name: `Budget Place ${index}`,
        subCategory: 'Active Ageing Centre (AAC)',
        country: 'SG',
        postalCode: '640706',
        address: `706 Jurong West St 71, #01-${index + 1}, Singapore 640706`,
        lat: '1.34122919260209',
        lng: '103.694393602769',
        ownershipMode: 'system',
        tags: 'Active Ageing Centre, AAC',
        isHidden: 'TRUE',
    }));
}

function buildExistingPlaces(count) {
    return Array.from({ length: count }, (_, index) => ({
        id: 1000 + index,
        externalKey: `place-budget-${index}`,
        name: `Existing Budget Place ${index}`,
        partner: null,
        partnerId: null,
        createdByUserId: 1,
        subregionId: 7,
        isHidden: true,
    }));
}

async function runImport(existingPlaces) {
    const fixture = createBudgetDb(existingPlaces);
    const report = await importPlaces(
        fixture.db,
        { id: 1, role: 'super_admin', subregionIds: [] },
        buildRows(65),
        { partnerLookup: new Map() },
        {},
        { scheduleCacheRebuild() {} },
    );
    return { ...fixture, report };
}

function assertFixedBudgetAndTags(result) {
    assert.equal(result.report.totalRows, 65);
    assert.equal(result.report.failedCount, 0);
    assert.deepEqual(result.report.errors, []);
    assert.deepEqual(result.tagRows.map((tag) => tag.name).sort(), ['aac', 'active ageing centre']);
    assert.equal(result.hardTagMappings.length, 130);
    assert.equal(new Set(result.hardTagMappings.map((mapping) => mapping.hardAssetId)).size, 65);
    assert.deepEqual(result.counters, {
        subregionPrefetches: 1,
        placePrefetches: 1,
        coreUpserts: 1,
        tagInserts: 1,
        tagSelects: 1,
        relationshipBatches: 1,
    });
}

test('65 hidden Place creates persist tags on a fixed database round-trip budget', async () => {
    const result = await runImport([]);

    assert.equal(result.report.createdCount, 65);
    assert.equal(result.report.updatedCount, 0);
    assertFixedBudgetAndTags(result);
});

test('65 hidden Place updates persist tags on a fixed database round-trip budget', async () => {
    const result = await runImport(buildExistingPlaces(65));

    assert.equal(result.report.createdCount, 0);
    assert.equal(result.report.updatedCount, 65);
    assertFixedBudgetAndTags(result);
});

test('blank Place workbook tags clear existing mappings in the same batched path', async () => {
    const fixture = createBudgetDb(buildExistingPlaces(65));
    const actor = { id: 1, role: 'super_admin', subregionIds: [] };
    const references = { partnerLookup: new Map() };
    const options = { scheduleCacheRebuild() {} };

    await importPlaces(fixture.db, actor, buildRows(65), references, {}, options);
    assert.equal(fixture.hardTagMappings.length, 130);

    const blankTagRows = buildRows(65).map((row) => ({ ...row, tags: '' }));
    const report = await importPlaces(fixture.db, actor, blankTagRows, references, {}, options);

    assert.equal(report.updatedCount, 65);
    assert.equal(report.failedCount, 0);
    assert.equal(fixture.hardTagMappings.length, 0);
});
