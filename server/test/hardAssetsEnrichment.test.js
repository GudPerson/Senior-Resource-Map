import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { sign } from 'hono/jwt';

import app from '../src/app.js';

function htmlResponse(html, url = 'https://fycs.org/active-ageing-centres/') {
    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            'X-Test-Resolved-Url': url,
        },
    });
}

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function imageResponse(contentType = 'image/png') {
    return new Response('', {
        status: 200,
        headers: { 'Content-Type': contentType },
    });
}

function testEnv(overrides = {}) {
    return {
        JWT_SECRET: 'test-secret',
        AUTH_TEST_LIVE_SESSION_USER_RESOLVER: async (user) => user,
        ...overrides,
    };
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

test('manual hard asset enrichment falls back to official directory details', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (input) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url === 'https://fycs.org/active-ageing-centres/') {
            return htmlResponse(`
                <html>
                    <head>
                        <meta name="description" content="Fei Yue Community Service promotes social engagement and well-being of seniors through Active Ageing Centres and programmes.">
                    </head>
                    <body>
                        <p><strong>Fei Yue Active Ageing Centre (Senja)</strong><br />
                        Blk 634B Senja Road #02-227<br />
                        Singapore 672634<br />
                        Tel: 6351 9555<br />
                        Fax: 6462 0265<br />
                        Centre Head: Mr Francis Lee<br />
                        Operating Hours: Monday to Friday, 9.30am to 6pm</p>
                    </body>
                </html>
            `);
        }

        if (url === 'https://fycs.org/favicon.ico') {
            return new Response('', {
                status: 200,
                headers: { 'Content-Type': 'image/x-icon' },
            });
        }

        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    try {
        const token = await sign({
            id: 1,
            username: 'admin',
            email: 'admin@example.test',
            role: 'super_admin',
            name: 'Admin',
            postalCode: '',
            subregionIds: [],
            exp: Math.floor(Date.now() / 1000) + 3600,
        }, 'test-secret', 'HS256');

        const response = await app.fetch(
            new Request('http://local/api/hard-assets/import/enrich-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': token,
                },
                body: JSON.stringify({
                    name: 'Fei Yue Active Ageing Centre (Senja)',
                    address: 'Singapore 672634',
                    postalCode: '672634',
                    subCategory: 'Active Ageing Centre (AAC)',
                }),
            }),
            testEnv(),
            { waitUntil() {} },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.address, 'Blk 634B Senja Road #02-227, Singapore 672634');
        assert.equal(payload.phone, '6351 9555');
        assert.equal(payload.hours, 'Monday to Friday, 9.30am to 6pm');
        assert.equal(payload.website, 'https://fycs.org/active-ageing-centres/');
        assert.match(payload.description, /social engagement/i);
        assert.deepEqual(payload.services, ['active ageing', 'senior activities', 'community programmes']);
    } finally {
        global.fetch = originalFetch;
    }
});

test('manual hard asset enrichment uses static official directory entries when live fetch is unavailable', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (input) => {
        const url = typeof input === 'string' ? input : input.url;
        throw new Error(`Unexpected live fetch in static directory test: ${url}`);
    };

    try {
        const token = await sign({
            id: 1,
            username: 'admin',
            email: 'admin@example.test',
            role: 'super_admin',
            name: 'Admin',
            postalCode: '',
            subregionIds: [],
            exp: Math.floor(Date.now() / 1000) + 3600,
        }, 'test-secret', 'HS256');

        const response = await app.fetch(
            new Request('http://local/api/hard-assets/import/enrich-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': token,
                },
                body: JSON.stringify({
                    name: 'Fei Yue Active Ageing Centre (Sunshine Court)',
                    address: 'Singapore 683476',
                    postalCode: '683476',
                    subCategory: 'Active Ageing Centre (AAC)',
                }),
            }),
            testEnv(),
            { waitUntil() {} },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.address, 'Blk 476C Choa Chu Kang Avenue 5 #01-43, Singapore 683476');
        assert.equal(payload.phone, '6334 0180');
        assert.equal(payload.hours, 'Monday to Friday, 9.30am to 6pm');
        assert.equal(payload.website, 'https://fycs.org/active-ageing-centres/');
        assert.match(payload.description, /social engagement/i);
        assert.deepEqual(payload.services, ['active ageing', 'senior activities', 'community programmes']);
    } finally {
        global.fetch = originalFetch;
    }
});

test('manual hard asset enrichment continues to grounded search when first AI pass only returns tags', async () => {
    const originalFetch = global.fetch;
    const serviceAccountJson = createVertexServiceAccountJson();
    let groundedFallbackCalls = 0;

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
            const prompt = body.contents?.[0]?.parts?.[0]?.text || '';
            assert.equal(body.generationConfig?.responseSchema, undefined);
            assert.equal(body.generationConfig?.responseMimeType, undefined);

            if (prompt.includes('Places to enrich:')) {
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
                                                    services: ['active ageing', 'senior activities'],
                                                    confidence: 0.62,
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

            if (prompt.includes('Postal anchor:')) {
                groundedFallbackCalls += 1;
                return jsonResponse({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: JSON.stringify({
                                            candidates: [
                                                {
                                                    name: 'Precious Active Ageing Centre (Sunshine Gardens)',
                                                    address: 'Blk 488B Choa Chu Kang Ave 5 #01-145, Singapore 682488',
                                                    postalCode: '682488',
                                                    website: 'https://www.preciousaac.com/',
                                                    phone: '+65 6912 7800',
                                                    hours: 'Monday to Friday, 8:30 AM to 6:00 PM',
                                                    description: 'Active ageing centre supporting seniors in Choa Chu Kang with social, wellness, and community activities.',
                                                    logoUrl: 'https://www.preciousaac.com/logo.png',
                                                    suggestedTags: ['active ageing', 'senior activities', 'community support'],
                                                    sourceUrl: 'https://www.preciousaac.com/sunshine-gardens',
                                                    sourceTitle: 'Precious Active Ageing Centre Sunshine Gardens',
                                                    sourceSnippet: 'Sunshine Gardens branch details and contact information.',
                                                    confidence: 0.89,
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
        }

        if (url === 'https://www.preciousaac.com/') {
            return htmlResponse(`
                <html>
                    <head>
                        <meta name="description" content="Precious Active Ageing Centre keeps seniors active and connected.">
                    </head>
                    <body>Precious Active Ageing Centre</body>
                </html>
            `, 'https://www.preciousaac.com/');
        }

        if (url === 'https://www.preciousaac.com/sunshine-gardens') {
            return htmlResponse(`
                <html>
                    <head>
                        <meta name="description" content="Precious Active Ageing Centre at Sunshine Gardens keeps seniors active and connected.">
                    </head>
                    <body>
                        <a href="https://www.facebook.com/preciousactiveageing">Facebook</a>
                    </body>
                </html>
            `, 'https://www.preciousaac.com/sunshine-gardens');
        }

        if (url === 'https://www.preciousaac.com/logo.png' || url === 'https://www.preciousaac.com/favicon.ico') {
            return new Response('', {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            });
        }

        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    try {
        const token = await sign({
            id: 1,
            username: 'admin',
            email: 'admin@example.test',
            role: 'super_admin',
            name: 'Admin',
            postalCode: '',
            subregionIds: [],
            exp: Math.floor(Date.now() / 1000) + 3600,
        }, 'test-secret', 'HS256');

        const response = await app.fetch(
            new Request('http://local/api/hard-assets/import/enrich-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': token,
                },
                body: JSON.stringify({
                    name: 'Precious Active Ageing Centre (Sunshine Gardens)',
                    address: 'Singapore 682488',
                    postalCode: '682488',
                    subCategory: 'Active Ageing Centre (AAC)',
                }),
            }),
            testEnv({
                VERTEX_AI_PROJECT_ID: 'carearound-enrichment-test',
                VERTEX_AI_SERVICE_ACCOUNT_JSON: serviceAccountJson,
            }),
            { waitUntil() {} },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(groundedFallbackCalls, 1);
        assert.equal(payload.website, 'https://www.preciousaac.com/');
        assert.equal(payload.phone, '+65 6912 7800');
        assert.equal(payload.hours, 'Monday to Friday, 8:30 AM to 6:00 PM');
        assert.match(payload.description, /supporting seniors/i);
        assert.equal(payload.logoUrl, 'https://www.preciousaac.com/logo.png');
        assert.equal(payload.socialLinks.facebook, 'https://www.facebook.com/preciousactiveageing');
        assert.deepEqual(payload.services, ['active ageing', 'senior activities', 'community support']);
    } finally {
        global.fetch = originalFetch;
    }
});

test('manual hard asset enrichment stabilizes All Saints Silver Lifestyle Club details and logo', async () => {
    const originalFetch = global.fetch;
    const serviceAccountJson = createVertexServiceAccountJson();

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
            const prompt = body.contents?.[0]?.parts?.[0]?.text || '';

            if (prompt.includes('Places to enrich:')) {
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
                                                    phone: '6351 1470',
                                                    services: ['active ageing', 'senior activities'],
                                                    logoUrl: 'https://www.allsaintshome.org.sg/wp-content/uploads/2024/12/nursing-home-5.png',
                                                    sourceUrl: 'https://www.allsaintshome.org.sg/our-services-centres/',
                                                    sourceTitle: 'Our Services & Centres - All Saints Home',
                                                    confidence: 0.61,
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

            if (prompt.includes('Postal anchor:')) {
                return jsonResponse({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: JSON.stringify({ candidates: [] }),
                                    },
                                ],
                            },
                        },
                    ],
                });
            }
        }

        if (url === 'https://www.allsaintshome.org.sg/our-services-centres/') {
            return htmlResponse(`
                <html>
                    <head>
                        <meta name="description" content="All Saints Silver Lifestyle Clubs provide active ageing, day care, community rehabilitation, and nursing support for seniors.">
                        <meta property="og:image" content="https://www.allsaintshome.org.sg/wp-content/uploads/2024/12/nursing-home-5.png">
                    </head>
                    <body>
                        <a href="https://www.allsaintshome.org.sg/">
                            <img width="398" height="97" src="https://www.allsaintshome.org.sg/wp-content/uploads/2024/10/WeCARE-All-saints-home.png" class="attachment-full size-full" alt="">
                        </a>
                    </body>
                </html>
            `, 'https://www.allsaintshome.org.sg/our-services-centres/');
        }

        if (
            url === 'https://www.allsaintshome.org.sg/wp-content/uploads/2024/10/WeCARE-All-saints-home.png'
            || url === 'https://www.allsaintshome.org.sg/wp-content/uploads/2024/12/nursing-home-5.png'
            || url === 'https://www.allsaintshome.org.sg/favicon.ico'
        ) {
            return imageResponse('image/png');
        }

        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    try {
        const token = await sign({
            id: 1,
            username: 'admin',
            email: 'admin@example.test',
            role: 'super_admin',
            name: 'Admin',
            postalCode: '',
            subregionIds: [],
            exp: Math.floor(Date.now() / 1000) + 3600,
        }, 'test-secret', 'HS256');

        const response = await app.fetch(
            new Request('http://local/api/hard-assets/import/enrich-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': token,
                },
                body: JSON.stringify({
                    name: 'All Saints Silver Lifestyle Club @ Yishun Fern Grove',
                    address: 'Singapore 760674',
                    postalCode: '760674',
                    subCategory: 'Active Ageing Centre (AAC)',
                }),
            }),
            testEnv({
                VERTEX_AI_PROJECT_ID: 'carearound-enrichment-test',
                VERTEX_AI_SERVICE_ACCOUNT_JSON: serviceAccountJson,
            }),
            { waitUntil() {} },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.address, 'Blk 674 Yishun Ave 4 #01-11, Singapore 760674');
        assert.equal(payload.website, 'https://www.allsaintshome.org.sg/our-services-centres/');
        assert.equal(payload.phone, '6351 1470');
        assert.match(payload.description, /active ageing/i);
        assert.equal(payload.logoUrl, 'https://www.allsaintshome.org.sg/wp-content/uploads/2024/10/WeCARE-All-saints-home.png');
        assert.equal(payload.services.includes('community rehabilitation'), true);
    } finally {
        global.fetch = originalFetch;
    }
});

test('manual hard asset enrichment stabilizes SASCO@Khatib details when AI returns partial fields', async () => {
    const originalFetch = global.fetch;
    const serviceAccountJson = createVertexServiceAccountJson();

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
            const prompt = body.contents?.[0]?.parts?.[0]?.text || '';

            if (prompt.includes('Places to enrich:')) {
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
                                                    phone: '+65 9834 9450',
                                                    hours: 'Mon - Fri: 8.30am - 5.30pm',
                                                    services: ['active ageing', 'senior care'],
                                                    logoUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
                                                    socialLinks: {
                                                        facebook: 'https://www.facebook.com/SSCH.SG/',
                                                    },
                                                    confidence: 0.6,
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

            if (prompt.includes('Postal anchor:')) {
                return jsonResponse({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: JSON.stringify({ candidates: [] }),
                                    },
                                ],
                            },
                        },
                    ],
                });
            }
        }

        if (url === 'https://www.sasco.sg/contact/') {
            return htmlResponse(`
                <html>
                    <head>
                        <meta name="description" content="SASCO is dedicated to enriching lives through community-focused services in elderly care.">
                    </head>
                    <body>
                        <img class="site-logo" src="https://www.sasco.sg/wp-content/uploads/2025/04/SASCO-Site-Logo.png" alt="SASCO logo">
                    </body>
                </html>
            `, 'https://www.sasco.sg/contact/');
        }

        if (url === 'https://sasco.org.sg/active-ageing-centre-care/') {
            return htmlResponse(`
                <html>
                    <head>
                        <meta name="description" content="SASCO Active Ageing Centre Care combines senior care and active ageing support.">
                    </head>
                    <body>
                        <img class="site-logo" src="data:image/svg+xml;base64,PHN2Zy8+" data-src="https://sasco.org.sg/wp-content/uploads/2022/04/SSCH-Official-Logo-Small.png" alt="SASCO logo">
                    </body>
                </html>
            `, 'https://sasco.org.sg/active-ageing-centre-care/');
        }

        if (
            url === 'https://www.sasco.sg/wp-content/uploads/2025/04/SASCO-Site-Logo.png'
            || url === 'https://sasco.org.sg/wp-content/uploads/2022/04/SSCH-Official-Logo-Small.png'
            || url === 'https://sasco.org.sg/favicon.ico'
            || url === 'https://www.sasco.sg/favicon.ico'
        ) {
            return imageResponse('image/png');
        }

        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    try {
        const token = await sign({
            id: 1,
            username: 'admin',
            email: 'admin@example.test',
            role: 'super_admin',
            name: 'Admin',
            postalCode: '',
            subregionIds: [],
            exp: Math.floor(Date.now() / 1000) + 3600,
        }, 'test-secret', 'HS256');

        const response = await app.fetch(
            new Request('http://local/api/hard-assets/import/enrich-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': token,
                },
                body: JSON.stringify({
                    name: 'SASCO@Khatib',
                    address: 'Singapore 760813',
                    postalCode: '760813',
                    subCategory: 'Active Ageing Centre (AAC)',
                }),
            }),
            testEnv({
                VERTEX_AI_PROJECT_ID: 'carearound-enrichment-test',
                VERTEX_AI_SERVICE_ACCOUNT_JSON: serviceAccountJson,
            }),
            { waitUntil() {} },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.address, 'Blk 813 Yishun Ring Road #01-01, Singapore 760813');
        assert.equal(payload.website, 'https://sasco.org.sg/active-ageing-centre-care/');
        assert.equal(payload.phone, '+65 9834 9450');
        assert.match(payload.description, /community-focused services/i);
        assert.equal(payload.logoUrl, 'https://www.sasco.sg/wp-content/uploads/2025/04/SASCO-Site-Logo.png');
        assert.equal(payload.socialLinks.facebook, 'https://www.facebook.com/SSCH.SG/');
        assert.equal(payload.services.includes('elderly care'), true);
    } finally {
        global.fetch = originalFetch;
    }
});

test('manual hard asset enrichment falls back to Google Places for any matching place', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url === 'https://places.googleapis.com/v1/places:searchText') {
            return new Response(JSON.stringify({
                places: [
                    {
                        id: 'google-place-evercare',
                        name: 'places/google-place-evercare',
                        displayName: { text: 'Evercare Medical Clinic' },
                        formattedAddress: '123 Test Avenue #01-01, Singapore 680123',
                        postalAddress: { postalCode: '680123', regionCode: 'SG' },
                        nationalPhoneNumber: '6123 4567',
                        regularOpeningHours: {
                            weekdayDescriptions: ['Monday: 9:00 AM - 6:00 PM'],
                        },
                        websiteUri: 'https://evercare.example/',
                        googleMapsUri: 'https://maps.google.com/?cid=evercare',
                        primaryType: 'medical_clinic',
                        editorialSummary: { text: 'Primary care clinic supporting residents with medical consultations.' },
                    },
                ],
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (url === 'https://places.googleapis.com/v1/places/google-place-evercare') {
            return new Response(JSON.stringify({
                id: 'google-place-evercare',
                name: 'places/google-place-evercare',
                displayName: { text: 'Evercare Medical Clinic' },
                formattedAddress: '123 Test Avenue #01-01, Singapore 680123',
                postalAddress: { postalCode: '680123', regionCode: 'SG' },
                nationalPhoneNumber: '6123 4567',
                regularOpeningHours: {
                    weekdayDescriptions: ['Monday: 9:00 AM - 6:00 PM'],
                },
                websiteUri: 'https://evercare.example/',
                googleMapsUri: 'https://maps.google.com/?cid=evercare',
                primaryType: 'medical_clinic',
                editorialSummary: { text: 'Primary care clinic supporting residents with medical consultations.' },
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (url === 'https://evercare.example/') {
            return htmlResponse(`
                <html>
                    <head>
                        <meta name="description" content="Evercare provides primary care services.">
                    </head>
                    <body>
                        <img class="site-logo" src="/logo.png" alt="Evercare logo">
                    </body>
                </html>
            `, 'https://evercare.example/');
        }

        if (url === 'https://evercare.example/logo.png') {
            return new Response('', {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            });
        }

        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    try {
        const token = await sign({
            id: 1,
            username: 'admin',
            email: 'admin@example.test',
            role: 'super_admin',
            name: 'Admin',
            postalCode: '',
            subregionIds: [],
            exp: Math.floor(Date.now() / 1000) + 3600,
        }, 'test-secret', 'HS256');

        const response = await app.fetch(
            new Request('http://local/api/hard-assets/import/enrich-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': token,
                },
                body: JSON.stringify({
                    name: 'Evercare Medical Clinic',
                    address: 'Singapore 680123',
                    postalCode: '680123',
                    subCategory: 'Clinic',
                }),
            }),
            testEnv({ GOOGLE_MAPS_API_KEY: 'test-google-key' }),
            { waitUntil() {} },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.address, '123 Test Avenue #01-01, Singapore 680123');
        assert.equal(payload.phone, '6123 4567');
        assert.equal(payload.hours, 'Monday: 9:00 AM - 6:00 PM');
        assert.equal(payload.website, 'https://evercare.example/');
        assert.match(payload.description, /Primary care clinic/i);
        assert.equal(payload.logoUrl, 'https://evercare.example/logo.png');
        assert.equal(payload.services.includes('healthcare'), true);
    } finally {
        global.fetch = originalFetch;
    }
});

test('manual hard asset enrichment does not use Google Maps preview images as logos', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (input) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url === 'https://places.googleapis.com/v1/places:searchText') {
            return jsonResponse({
                places: [
                    {
                        id: 'google-place-precious',
                        name: 'places/google-place-precious',
                        displayName: { text: 'Precious Active Ageing Centre (Sunshine Gardens)' },
                        formattedAddress: 'Blk 488B Choa Chu Kang Ave 5 #01-145, Singapore 682488',
                        postalAddress: { postalCode: '682488', regionCode: 'SG' },
                        googleMapsUri: 'https://maps.google.com/?cid=precious',
                        primaryType: 'health',
                    },
                ],
            });
        }

        if (url === 'https://places.googleapis.com/v1/places/google-place-precious') {
            return jsonResponse({
                id: 'google-place-precious',
                name: 'places/google-place-precious',
                displayName: { text: 'Precious Active Ageing Centre (Sunshine Gardens)' },
                formattedAddress: 'Blk 488B Choa Chu Kang Ave 5 #01-145, Singapore 682488',
                postalAddress: { postalCode: '682488', regionCode: 'SG' },
                googleMapsUri: 'https://maps.google.com/?cid=precious',
                primaryType: 'health',
            });
        }

        if (url === 'https://maps.google.com/?cid=precious') {
            return htmlResponse(`
                <html>
                    <head>
                        <meta property="og:image" content="https://maps.google.com/maps/api/staticmap?center=1,103&key=not-a-carearound-logo">
                    </head>
                    <body>Map preview</body>
                </html>
            `, 'https://maps.google.com/?cid=precious');
        }

        if (url.startsWith('https://maps.google.com/maps/api/staticmap')) {
            return new Response('', {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            });
        }

        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    try {
        const token = await sign({
            id: 1,
            username: 'admin',
            email: 'admin@example.test',
            role: 'super_admin',
            name: 'Admin',
            postalCode: '',
            subregionIds: [],
            exp: Math.floor(Date.now() / 1000) + 3600,
        }, 'test-secret', 'HS256');

        const response = await app.fetch(
            new Request('http://local/api/hard-assets/import/enrich-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': token,
                },
                body: JSON.stringify({
                    name: 'Precious Active Ageing Centre (Sunshine Gardens)',
                    address: 'Singapore 682488',
                    postalCode: '682488',
                    subCategory: 'Active Ageing Centre (AAC)',
                }),
            }),
            testEnv({ GOOGLE_MAPS_API_KEY: 'test-google-key' }),
            { waitUntil() {} },
        );
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.address, 'Blk 488B Choa Chu Kang Ave 5 #01-145, Singapore 682488');
        assert.equal(payload.logoUrl, '');
    } finally {
        global.fetch = originalFetch;
    }
});
