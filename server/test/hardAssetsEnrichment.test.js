import assert from 'node:assert/strict';
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
            { JWT_SECRET: 'test-secret' },
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
            { JWT_SECRET: 'test-secret' },
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
            { JWT_SECRET: 'test-secret', GOOGLE_MAPS_API_KEY: 'test-google-key' },
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
