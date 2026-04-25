import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import { enrichPlaceCandidatesWithVertex } from '../src/utils/vertexGroundedPlaceSearch.js';

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
        client_email: 'carearound-enrichment-test@example.iam.gserviceaccount.com',
        private_key: privateKey,
    });
}

test('enrichPlaceCandidatesWithVertex preserves address, contact, hours, description, and tags', async () => {
    const originalFetch = global.fetch;
    const serviceAccountJson = createVertexServiceAccountJson();
    let sawStructuredEnrichmentRequest = false;

    global.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url === 'https://oauth2.googleapis.com/token') {
            return jsonResponse({
                access_token: 'vertex-access-token',
                expires_in: 3600,
            });
        }

        if (url.includes(':generateContent')) {
            const body = JSON.parse(init.body);
            sawStructuredEnrichmentRequest = Boolean(body.generationConfig?.responseSchema?.properties?.enriched);

            return jsonResponse({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: JSON.stringify({
                                        enriched: [
                                            {
                                                index: 0,
                                                address: 'Blk 634B Senja Road #02-227, Singapore 672634',
                                                postalCode: '672634',
                                                website: 'https://fycs.example/active-ageing-centres',
                                                phone: '6351 9555',
                                                hours: 'Monday to Friday, 9.30am to 6pm',
                                                description: 'Active ageing programmes and community support for seniors.',
                                                services: ['active ageing', 'senior activities'],
                                                logoUrl: 'https://fycs.example/logo.png',
                                                sourceUrl: 'https://fycs.example/active-ageing-centres',
                                                sourceTitle: 'Fei Yue Active Ageing Centres',
                                                confidence: 0.91,
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
        const result = await enrichPlaceCandidatesWithVertex({
            env: {
                VERTEX_AI_PROJECT_ID: 'carearound-enrichment-test',
                VERTEX_AI_SERVICE_ACCOUNT_JSON: serviceAccountJson,
            },
            candidates: [
                {
                    name: 'Fei Yue Active Ageing Centre (Senja)',
                    address: 'Singapore 672634',
                    postalCode: '672634',
                    subCategory: 'Active Ageing Centre (AAC)',
                },
            ],
            keywordQuery: 'Fei Yue Active Ageing Centre (Senja)',
        });

        const enrichment = result.get('_idx:0');

        assert.equal(sawStructuredEnrichmentRequest, true);
        assert.equal(enrichment.address, 'Blk 634B Senja Road #02-227, Singapore 672634');
        assert.equal(enrichment.phone, '6351 9555');
        assert.equal(enrichment.hours, 'Monday to Friday, 9.30am to 6pm');
        assert.equal(enrichment.website, 'https://fycs.example/active-ageing-centres');
        assert.equal(enrichment.description, 'Active ageing programmes and community support for seniors.');
        assert.deepEqual(enrichment.services, ['active ageing', 'senior activities']);
    } finally {
        global.fetch = originalFetch;
    }
});
