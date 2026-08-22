import test from 'node:test';
import assert from 'node:assert/strict';

import { importStandaloneOfferings } from '../src/controllers/workbookController.js';
import { softAssets } from '../src/db/schema.js';

function createStatement() {
    return {
        set() { return this; },
        values(values) { this.inputValues = values; return this; },
        where() { return this; },
        onConflictDoNothing() { return this; },
    };
}

function buildExistingOffering(index) {
    return {
        id: 1000 + index,
        externalKey: `offering-budget-${index}`,
        assetMode: 'standalone',
        partner: null,
        partnerId: null,
        createdByUserId: 1,
        subregionId: 7,
        schedule: null,
        isHidden: true,
        isMemberOnly: false,
        audienceMode: 'public',
        calendarRevision: 0,
        calendarEntries: [],
        scheduleNotes: null,
    };
}

function createBudgetDb(existingOfferings) {
    const counters = {
        hardAssetPrefetches: 0,
        offeringPrefetches: 0,
        coreInserts: 0,
        batches: 0,
    };

    const db = {
        query: {
            hardAssets: {
                async findMany() {
                    counters.hardAssetPrefetches += 1;
                    return [{
                        id: 77,
                        externalKey: 'place-budget-host',
                        name: 'Budget Host',
                        subregionId: 7,
                        partner: null,
                    }];
                },
            },
            softAssets: {
                async findMany() {
                    counters.offeringPrefetches += 1;
                    return existingOfferings;
                },
            },
        },
        update() { return createStatement(); },
        delete() { return createStatement(); },
        insert(table) {
            const statement = createStatement();
            if (table === softAssets) {
                statement.returning = async function returning() {
                    counters.coreInserts += 1;
                    return this.inputValues.map((payload, index) => ({
                        id: 2000 + index,
                        externalKey: payload.externalKey,
                    }));
                };
            }
            return statement;
        },
        async batch() {
            counters.batches += 1;
            return [];
        },
    };

    return { db, counters };
}

function buildRows(count) {
    return Array.from({ length: count }, (_, index) => ({
        __rowNumber: index + 2,
        externalKey: `offering-budget-${index}`,
        name: `Budget Offering ${index}`,
        bucket: 'Services',
        subCategory: 'Centre-based Nursing',
        ownershipMode: 'system',
        locationExternalKeys: 'place-budget-host',
        audienceMode: 'public',
        isHidden: 'TRUE',
    }));
}

test('65 hidden Standalone Offering updates stay on a fixed database round-trip budget', async () => {
    const existingOfferings = Array.from({ length: 65 }, (_, index) => buildExistingOffering(index));
    const { db, counters } = createBudgetDb(existingOfferings);

    const report = await importStandaloneOfferings(
        db,
        { id: 1, role: 'super_admin', subregionIds: [] },
        buildRows(65),
        {
            partnerLookup: new Map(),
            subregionLookup: new Map(),
            audienceZoneLookup: new Map(),
        },
        {},
    );

    assert.equal(report.totalRows, 65);
    assert.equal(report.updatedCount, 65);
    assert.equal(report.createdCount, 0);
    assert.equal(report.failedCount, 0);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(counters, {
        hardAssetPrefetches: 1,
        offeringPrefetches: 1,
        coreInserts: 0,
        batches: 2,
    });
});

test('65 hidden Standalone Offering creates stay on a fixed database round-trip budget', async () => {
    const { db, counters } = createBudgetDb([]);

    const report = await importStandaloneOfferings(
        db,
        { id: 1, role: 'super_admin', subregionIds: [] },
        buildRows(65),
        {
            partnerLookup: new Map(),
            subregionLookup: new Map(),
            audienceZoneLookup: new Map(),
        },
        {},
    );

    assert.equal(report.totalRows, 65);
    assert.equal(report.createdCount, 65);
    assert.equal(report.updatedCount, 0);
    assert.equal(report.failedCount, 0);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(counters, {
        hardAssetPrefetches: 1,
        offeringPrefetches: 1,
        coreInserts: 1,
        batches: 1,
    });
});
