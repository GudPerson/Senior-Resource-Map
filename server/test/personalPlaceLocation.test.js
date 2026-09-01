import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { resolvePersonalPlaceLocation } from '../src/utils/personalPlaceLocation.js';

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

test('addressed personal places use the exact OneMap address, postal code, and coordinates', async () => {
    const resolved = await resolvePersonalPlaceLocation({
        locationMode: 'addressed',
        address: 'user-entered address',
        postalCode: '600210',
        lat: 1.1,
        lng: 103.1,
    }, async () => jsonResponse({
        results: [{
            POSTAL: '600210',
            ADDRESS: '210 JURONG EAST STREET 21 SINGAPORE 600210',
            LATITUDE: '1.3380314',
            LONGITUDE: '103.7417251',
        }],
    }));

    assert.deepEqual(resolved, {
        locationMode: 'addressed',
        address: '210 JURONG EAST STREET 21 SINGAPORE 600210',
        postalCode: '600210',
        lat: 1.3380314,
        lng: 103.7417251,
    });
});

test('addressed personal places reject missing or malformed postal codes before OneMap is called', async () => {
    let oneMapCalled = false;

    await assert.rejects(
        () => resolvePersonalPlaceLocation({
            locationMode: 'addressed',
            address: 'Jurong East',
            postalCode: '60021',
            lat: 1.3,
            lng: 103.7,
        }, async () => {
            oneMapCalled = true;
            return jsonResponse({ results: [] });
        }),
        (error) => error.status === 400 && /six-digit Singapore postal code/.test(error.message),
    );

    assert.equal(oneMapCalled, false);
});

test('addressed personal places reject OneMap results for a different postal code', async () => {
    await assert.rejects(
        () => resolvePersonalPlaceLocation({
            locationMode: 'addressed',
            address: 'Jurong East',
            postalCode: '600210',
            lat: 1.3,
            lng: 103.7,
        }, async () => jsonResponse({
            results: [{
                POSTAL: '600211',
                ADDRESS: 'A DIFFERENT ADDRESS SINGAPORE 600211',
                LATITUDE: '1.4',
                LONGITUDE: '103.8',
            }],
        })),
        (error) => error.status === 400 && /could not be verified/.test(error.message),
    );
});

test('addressed personal places fail closed when OneMap is unavailable', async () => {
    await assert.rejects(
        () => resolvePersonalPlaceLocation({
            locationMode: 'addressed',
            address: 'Jurong East',
            postalCode: '600210',
            lat: 1.3,
            lng: 103.7,
        }, async () => jsonResponse({ error: 'unavailable' }, 503)),
        (error) => error.status === 503 && /temporarily unavailable/.test(error.message),
    );
});

test('explicit map-only personal places preserve coordinates and never call OneMap', async () => {
    let oneMapCalled = false;
    const resolved = await resolvePersonalPlaceLocation({
        locationMode: 'map_only',
        address: '',
        postalCode: '',
        lat: 1.337,
        lng: 103.743,
    }, async () => {
        oneMapCalled = true;
        return jsonResponse({ results: [] });
    });

    assert.deepEqual(resolved, {
        locationMode: 'map_only',
        address: '',
        postalCode: '',
        lat: 1.337,
        lng: 103.743,
    });
    assert.equal(oneMapCalled, false);
});

test('map-only personal places cannot carry an address or postal code', async () => {
    await assert.rejects(
        () => resolvePersonalPlaceLocation({
            locationMode: 'map_only',
            address: 'Unverified address',
            postalCode: '',
            lat: 1.337,
            lng: 103.743,
        }),
        (error) => error.status === 400 && /cannot include an address or postal code/.test(error.message),
    );
});

test('legacy blank personal-place payloads remain compatible as map-only points', async () => {
    const resolved = await resolvePersonalPlaceLocation({
        address: '',
        postalCode: '',
        lat: 1.337,
        lng: 103.743,
    });

    assert.equal(resolved.locationMode, 'map_only');
});

test('all Personal Place API entry points apply the shared location validator', () => {
    const personalPlacesSource = fs.readFileSync(
        new URL('../src/controllers/personalPlacesController.js', import.meta.url),
        'utf8',
    );
    const myMapsSource = fs.readFileSync(
        new URL('../src/controllers/myMapsController.js', import.meta.url),
        'utf8',
    );

    assert.match(personalPlacesSource, /postPersonalPlace[\s\S]*resolvePersonalPlaceLocation\(body\)/);
    assert.match(personalPlacesSource, /patchPersonalPlace[\s\S]*resolvePersonalPlaceLocation\(body\)/);
    assert.match(myMapsSource, /postMyMapPersonalPlace[\s\S]*resolvePersonalPlaceLocation\(body\)/);
    assert.match(myMapsSource, /patchMyMapPersonalPlace[\s\S]*resolvePersonalPlaceLocation\(body\)/);
});
