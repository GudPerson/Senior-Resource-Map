import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';

import app from '../src/app.js';
import {
    flexibleImportRowsSchema,
    identifierListSchema,
    optionalTextSchema,
    positiveIntValueSchema,
    positiveIntListSchema,
    validateRequestBody,
} from '../src/utils/inputValidation.js';

test('validateRequestBody normalizes bounded fields and positive ids', () => {
    const schema = z.object({
        resourceId: positiveIntValueSchema('Resource id'),
        notes: optionalTextSchema(8),
    });

    const parsed = validateRequestBody({
        resourceId: '42',
        notes: 'Line one\r\nLine two that is long',
    }, schema);

    assert.deepEqual(parsed, {
        resourceId: 42,
        notes: 'Line one',
    });
});

test('validateRequestBody rejects malformed request shapes with a 400 status', () => {
    const schema = z.object({
        resourceId: positiveIntValueSchema('Resource id'),
    });

    assert.throws(
        () => validateRequestBody({ resourceId: { value: 42 } }, schema),
        (err) => err.status === 400 && /Resource id must be a positive number/.test(err.message),
    );
});

test('flexible import rows preserve spreadsheet-like scalar cells and remove control characters', () => {
    const schema = z.object({
        rows: flexibleImportRowsSchema('Boundary rows'),
    });

    const parsed = validateRequestBody({
        rows: [
            {
                'Postal Code': ' 680801\u0000 ',
                'Subregion ID': 12,
                active: true,
                blank: null,
            },
        ],
    }, schema);

    assert.deepEqual(parsed.rows, [
        {
            'Postal Code': '680801',
            'Subregion ID': 12,
            active: true,
            blank: null,
        },
    ]);
});

test('flexible import rows reject nested objects instead of passing malformed cells to importers', () => {
    const schema = z.object({
        rows: flexibleImportRowsSchema('Boundary rows'),
    });

    assert.throws(
        () => validateRequestBody({
            rows: [{ postalCode: { nested: '680801' } }],
        }, schema),
        (err) => err.status === 400 && /Boundary rows|Invalid input/.test(err.message),
    );
});

test('list validators normalize ids and reject duplicates early', () => {
    const schema = z.object({
        numericIds: positiveIntListSchema('Numeric IDs'),
        mixedIds: identifierListSchema('Subregion IDs'),
    });

    const parsed = validateRequestBody({
        numericIds: ['10', 11],
        mixedIds: [' CCK-1 ', 12],
    }, schema);

    assert.deepEqual(parsed, {
        numericIds: [10, 11],
        mixedIds: ['CCK-1', '12'],
    });

    assert.throws(
        () => validateRequestBody({ numericIds: [10, '10'], mixedIds: ['CCK-1'] }, schema),
        (err) => err.status === 400 && /Numeric IDs must not contain duplicates/.test(err.message),
    );
});

test('auth routes reject invalid credential payload types before database work', async () => {
    const response = await app.fetch(
        new Request('https://app.carearound.sg/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'https://app.carearound.sg',
            },
            body: JSON.stringify({
                email: 'person@example.com',
                password: { nested: 'not text' },
            }),
        }),
        { NODE_ENV: 'production' },
    );

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /Sign-in details is invalid/);
    assert.match(body.error, /Password must be text/);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.carearound.sg');
});

test('registration rejects non-text profile payloads before database work', async () => {
    const response = await app.fetch(
        new Request('https://app.carearound.sg/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'https://app.carearound.sg',
            },
            body: JSON.stringify({
                email: 'person@example.com',
                password: 'safe-password',
                name: ['not', 'text'],
            }),
        }),
        { NODE_ENV: 'production' },
    );

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /Registration details is invalid/);
    assert.match(body.error, /Name must be text/);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.carearound.sg');
});
