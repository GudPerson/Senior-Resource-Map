import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import { searchGooglePlaceCandidatesByPostal } from '../src/utils/googlePlaceImport.js';

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

function createVertexServiceAccountJson() {
    const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return JSON.stringify({
        client_email: 'carearound-test@example.iam.gserviceaccount.com',
        private_key: privateKey,
    });
}

test('postal search falls back to OneMap when Google cannot resolve the postal anchor', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url === 'https://places.googleapis.com/v1/places:searchText') {
            const body = JSON.parse(init.body);
            const query = body.textQuery;

            if (query === '681811') {
                return jsonResponse({ places: [] });
            }

            if (/active ageing centre/i.test(query)) {
                return jsonResponse({
                    places: [
                        {
                            id: 'google-place-1',
                            displayName: { text: 'Precious Active Ageing Centre' },
                            formattedAddress: '1 Anchor Road, Singapore 681811',
                            postalAddress: { postalCode: '681811' },
                            location: { latitude: 1.3881, longitude: 103.7451 },
                            googleMapsUri: 'https://maps.google.com/?cid=1',
                            primaryType: 'senior_citizen_center',
                        },
                    ],
                });
            }

            return jsonResponse({ places: [] });
        }

        if (url.startsWith('https://www.onemap.gov.sg/api/common/elastic/search')) {
            return jsonResponse({
                results: [
                    {
                        ADDRESS: '1 Anchor Road Singapore 681811',
                        LATITUDE: '1.3880',
                        LONGITUDE: '103.7450',
                        POSTAL: '681811',
                    },
                ],
            });
        }

        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    try {
        const result = await searchGooglePlaceCandidatesByPostal(
            { GOOGLE_MAPS_API_KEY: 'test-google-key' },
            '681811',
            ['Active Ageing Centre'],
            '',
            { radiusKm: 1, preferredResultCount: 4 },
        );

        assert.equal(result.resolvedPostal.source, 'onemap');
        assert.equal(result.fallbackUsed, false);
        assert.equal(result.exactCandidates.length, 1);
        assert.equal(result.exactCandidates[0].candidateSource, 'google_places');
        assert.match(result.warnings.join(' '), /OneMap/i);
    } finally {
        global.fetch = originalFetch;
    }
});

test('postal search uses Vertex web fallback when Google returns zero place candidates', async () => {
    const originalFetch = global.fetch;
    const serviceAccountJson = createVertexServiceAccountJson();
    let sawGroundedVertexRequest = false;

    global.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url === 'https://places.googleapis.com/v1/places:searchText') {
            return jsonResponse({ places: [] });
        }

        if (url.startsWith('https://www.onemap.gov.sg/api/common/elastic/search')) {
            const searchVal = new URL(url).searchParams.get('searchVal');
            if (searchVal === '681811') {
                return jsonResponse({
                    results: [
                        {
                            ADDRESS: '1 Anchor Road Singapore 681811',
                            LATITUDE: '1.3880',
                            LONGITUDE: '103.7450',
                            POSTAL: '681811',
                        },
                    ],
                });
            }

            return jsonResponse({
                results: [
                    {
                        ADDRESS: '123 Anchor Road Singapore 681811',
                        LATITUDE: '1.3882',
                        LONGITUDE: '103.7452',
                        POSTAL: '681811',
                    },
                ],
            });
        }

        if (url === 'https://oauth2.googleapis.com/token') {
            return jsonResponse({
                access_token: 'vertex-access-token',
                expires_in: 3600,
            });
        }

        if (url.includes(':generateContent')) {
            sawGroundedVertexRequest = true;
            const body = JSON.parse(init.body);
            assert.deepEqual(body.tools, [{ googleSearch: {} }]);

            return jsonResponse({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: JSON.stringify({
                                        warnings: ['Used grounded web fallback results.'],
                                        candidates: [
                                            {
                                                name: 'RiverLife Active Ageing Centre',
                                                address: '123 Anchor Road, Singapore 681811',
                                                postalCode: '681811',
                                                website: 'https://riverlife.example/aac',
                                                phone: '61234567',
                                                description: 'Community programmes and wellness support for seniors.',
                                                logoUrl: 'https://riverlife.example/logo.png',
                                                subCategorySuggestion: 'Active Ageing Centre',
                                                suggestedTags: ['seniors', 'wellness'],
                                                sourceUrl: 'https://riverlife.example/aac',
                                                sourceTitle: 'RiverLife Active Ageing Centre',
                                                sourceSnippet: 'Programmes, exercise, and befriending support for seniors.',
                                                confidence: 0.82,
                                            },
                                        ],
                                    }),
                                },
                            ],
                        },
                    },
                ],
            });
        }

        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    try {
        const result = await searchGooglePlaceCandidatesByPostal(
            {
                GOOGLE_MAPS_API_KEY: 'test-google-key',
                VERTEX_AI_PROJECT_ID: 'carearound-test',
                VERTEX_AI_SERVICE_ACCOUNT_JSON: serviceAccountJson,
            },
            '681811',
            ['Active Ageing Centre'],
            'active ageing centre',
            { radiusKm: 1, preferredResultCount: 4 },
        );

        assert.equal(sawGroundedVertexRequest, true);
        assert.equal(result.resolvedPostal.source, 'onemap');
        assert.equal(result.fallbackUsed, true);
        assert.equal(result.exactCandidates.length, 1);
        assert.equal(result.exactCandidates[0].candidateSource, 'web_fallback');
        assert.equal(result.exactCandidates[0].sourceUrl, 'https://riverlife.example/aac');
        assert.equal(result.exactCandidates[0].draftSeed.name, 'RiverLife Active Ageing Centre');
        assert.match(result.fallbackWarnings.join(' '), /grounded web fallback/i);
    } finally {
        global.fetch = originalFetch;
    }
});
