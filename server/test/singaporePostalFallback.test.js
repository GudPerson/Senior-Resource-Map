import assert from 'node:assert/strict';
import test from 'node:test';

import {
    actorCanUseSingaporeFallbackRegion,
    resolveSingaporePostalFallback,
    validateSingaporePostalCodeWithOneMap,
} from '../src/utils/singaporePostalFallback.js';

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function createFallbackDb({ singaporeRegion = { id: 186, name: 'Singapore', subregionCode: 'SIN' } } = {}) {
    const inserted = [];

    return {
        inserted,
        select() {
            return {
                from() {
                    return {
                        where: async () => [singaporeRegion],
                    };
                },
            };
        },
        insert() {
            return {
                values(value) {
                    inserted.push(value);
                    return {
                        onConflictDoNothing: async () => undefined,
                    };
                },
            };
        },
    };
}

test('OneMap validation accepts an exact Singapore postal match and returns coordinates', async () => {
    const result = await validateSingaporePostalCodeWithOneMap('822211', async () => jsonResponse({
        results: [{
            POSTAL: '822211',
            ADDRESS: '211B PUNGGOL WALK PUNGGOL RIPPLES SINGAPORE 822211',
            LATITUDE: '1.40116989540271',
            LONGITUDE: '103.899920878173',
        }],
    }));

    assert.equal(result.valid, true);
    assert.equal(result.postalCode, '822211');
    assert.equal(result.address, '211B PUNGGOL WALK PUNGGOL RIPPLES SINGAPORE 822211');
    assert.equal(result.lat, 1.40116989540271);
    assert.equal(result.lng, 103.899920878173);
});

test('OneMap validation rejects a response that does not contain the requested postal code', async () => {
    const result = await validateSingaporePostalCodeWithOneMap('822211', async () => jsonResponse({
        results: [{
            POSTAL: '821264',
            ADDRESS: '264A PUNGGOL WAY PUNGGOL EMERALD SINGAPORE 821264',
            LATITUDE: '1.40597704114999',
            LONGITUDE: '103.898544055197',
        }],
    }));

    assert.deepEqual(result, {
        valid: false,
        postalCode: '822211',
        reason: 'not_found',
    });
});

test('Singapore fallback is available only to Super Admins or actors scoped to SG', () => {
    assert.equal(actorCanUseSingaporeFallbackRegion({ role: 'super_admin', subregionIds: [] }, 186), true);
    assert.equal(actorCanUseSingaporeFallbackRegion({ role: 'regional_admin', subregionIds: [186] }, 186), true);
    assert.equal(actorCanUseSingaporeFallbackRegion({ role: 'regional_admin', subregionIds: [12] }, 186), false);
});

test('Singapore fallback caches a valid postal code into the Singapore Region', async () => {
    const db = createFallbackDb();
    const result = await resolveSingaporePostalFallback(db, '543279', { role: 'super_admin', subregionIds: [] }, {
        fetchImpl: async () => jsonResponse({
            results: [{
                POSTAL: '543279',
                ADDRESS: '279C SENGKANG EAST AVENUE COMPASSVALE ANCILLA SINGAPORE 543279',
                LATITUDE: '1.38572932197005',
                LONGITUDE: '103.892595434586',
            }],
        }),
    });

    assert.equal(result.subregion.id, 186);
    assert.equal(result.fallbackUsed, true);
    assert.deepEqual(db.inserted, [{ subregionId: 186, postalCode: '543279' }]);
    assert.deepEqual(result.oneMapLocation, {
        lat: 1.38572932197005,
        lng: 103.892595434586,
        address: '279C SENGKANG EAST AVENUE COMPASSVALE ANCILLA SINGAPORE 543279',
    });
});

test('Singapore fallback does not validate or cache for actors outside SG scope', async () => {
    const db = createFallbackDb();
    let oneMapCalled = false;
    const result = await resolveSingaporePostalFallback(db, '543279', { role: 'regional_admin', subregionIds: [12] }, {
        fetchImpl: async () => {
            oneMapCalled = true;
            return jsonResponse({ results: [] });
        },
    });

    assert.equal(result, null);
    assert.equal(oneMapCalled, false);
    assert.deepEqual(db.inserted, []);
});
