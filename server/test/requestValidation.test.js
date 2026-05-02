import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';

import app from '../src/app.js';
import {
    optionalTextSchema,
    positiveIntValueSchema,
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
