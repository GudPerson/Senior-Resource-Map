import test from 'node:test';
import assert from 'node:assert/strict';

import {
    extractGoogleReverseGeocodePostalCode,
    normalizeContextLocation,
    resolveContextPostalCodeFromLocation,
} from '../src/utils/discoveryLocationContext.js';

function jsonResponse(body, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            return body;
        },
    };
}

test('normalizeContextLocation keeps only Singapore-range coordinates', () => {
    assert.deepEqual(normalizeContextLocation({ lat: '1.3791', lng: '103.7449' }), {
        lat: 1.3791,
        lng: 103.7449,
    });
    assert.equal(normalizeContextLocation({ lat: 2.1, lng: 103.7449 }), null);
    assert.equal(normalizeContextLocation({ lat: 1.3791, lng: 102.1 }), null);
    assert.equal(normalizeContextLocation({ lat: 'bad', lng: '103.7449' }), null);
});

test('extractGoogleReverseGeocodePostalCode returns the first Singapore postal code only', () => {
    const postalCode = extractGoogleReverseGeocodePostalCode({
        results: [
            {
                address_components: [
                    { long_name: 'Malaysia', short_name: 'MY', types: ['country'] },
                    { long_name: '79000', types: ['postal_code'] },
                ],
            },
            {
                address_components: [
                    { long_name: 'Singapore', short_name: 'SG', types: ['country'] },
                    { long_name: '681809', types: ['postal_code'] },
                ],
            },
        ],
    });

    assert.equal(postalCode, '681809');
});

test('resolveContextPostalCodeFromLocation reverse geocodes coordinates without returning address data', async () => {
    const requestedUrls = [];
    const postalCode = await resolveContextPostalCodeFromLocation(
        { lat: 1.3791, lng: 103.7449 },
        {
            env: { GOOGLE_MAPS_API_KEY: 'test-key' },
            cacheTtlMs: 0,
            fetchImpl: async (url) => {
                requestedUrls.push(String(url));
                return jsonResponse({
                    status: 'OK',
                    results: [{
                        address_components: [
                            { long_name: 'Singapore', short_name: 'SG', types: ['country'] },
                            { long_name: '681809', types: ['postal_code'] },
                        ],
                    }],
                });
            },
        },
    );

    assert.equal(postalCode, '681809');
    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0], /maps\.googleapis\.com\/maps\/api\/geocode\/json/);
    assert.match(requestedUrls[0], /latlng=1\.379100%2C103\.744900/);
    assert.match(requestedUrls[0], /region=sg/);
});
