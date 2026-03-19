import test from 'node:test';
import assert from 'node:assert/strict';

import { Hono } from 'hono';

import { buildSessionPayload, clearAuthCookie, setAuthCookie } from '../src/utils/sessionAuth.js';

test('production session cookie is cross-site compatible', async () => {
    const app = new Hono();
    app.get('/set', (c) => {
        setAuthCookie(c, 'test-token');
        return c.json({ ok: true });
    });

    const response = await app.fetch(new Request('http://local/set'), { NODE_ENV: 'production' }, { waitUntil() {} });
    const cookie = response.headers.get('set-cookie') || '';

    assert.match(cookie, /sc_token=test-token/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=None/i);
    assert.match(cookie, /Path=\//i);
});

test('development session cookie stays lax for localhost', async () => {
    const app = new Hono();
    app.get('/set', (c) => {
        setAuthCookie(c, 'test-token');
        return c.json({ ok: true });
    });

    const response = await app.fetch(new Request('http://local/set'), { NODE_ENV: 'development' }, { waitUntil() {} });
    const cookie = response.headers.get('set-cookie') || '';

    assert.match(cookie, /SameSite=Lax/i);
    assert.doesNotMatch(cookie, /Secure/i);
});

test('clearing production session cookie preserves cross-site attributes', async () => {
    const app = new Hono();
    app.get('/clear', (c) => {
        clearAuthCookie(c);
        return c.json({ ok: true });
    });

    const response = await app.fetch(new Request('http://local/clear'), { NODE_ENV: 'production' }, { waitUntil() {} });
    const cookie = response.headers.get('set-cookie') || '';

    assert.match(cookie, /sc_token=/);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=None/i);
    assert.match(cookie, /Max-Age=0/i);
});

test('session payload flags standard users without postal codes for completion', () => {
    const standardWithoutPostal = buildSessionPayload({
        id: 1,
        username: 'jane',
        email: 'jane@example.com',
        role: 'standard',
        name: 'Jane',
        postalCode: '',
        subregionIds: [],
    });
    const standardWithPostal = buildSessionPayload({
        id: 2,
        username: 'john',
        email: 'john@example.com',
        role: 'standard',
        name: 'John',
        postalCode: '680153',
        subregionIds: [3],
    });
    const partnerWithoutPostal = buildSessionPayload({
        id: 3,
        username: 'partner',
        email: 'partner@example.com',
        role: 'partner',
        name: 'Partner',
        postalCode: '',
        subregionIds: [4],
    });

    assert.equal(standardWithoutPostal.needsPostalCode, true);
    assert.equal(standardWithPostal.needsPostalCode, false);
    assert.equal(partnerWithoutPostal.needsPostalCode, false);
});
