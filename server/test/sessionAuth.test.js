import test from 'node:test';
import assert from 'node:assert/strict';

import { Hono } from 'hono';

import { hydrateRequestUserFromDb } from '../src/middleware/auth.js';
import {
    buildSessionPayload,
    clearAuthCookie,
    createSessionToken,
    getSessionSecret,
    setAuthCookie,
    verifySessionToken,
} from '../src/utils/sessionAuth.js';

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

test('session payload can carry partner staff access without changing the user role', () => {
    const staffUser = buildSessionPayload({
        id: 80,
        username: 'staff',
        email: 'staff@example.com',
        role: 'standard',
        name: 'Staff Member',
        postalCode: '160024',
        subregionIds: [4],
        partnerStaffAccess: [{
            organizationId: 3,
            legacyPartnerUserId: 20,
            organizationName: 'Care Partner',
            staffRole: 'editor',
            subregionIds: [4],
        }],
    });

    assert.equal(staffUser.role, 'standard');
    assert.deepEqual(staffUser.partnerStaffAccess, [{
        organizationId: 3,
        legacyPartnerUserId: 20,
        organizationName: 'Care Partner',
        staffRole: 'editor',
        subregionIds: [4],
    }]);
});

test('signed session claims exclude profile data and live access lists', async () => {
    const context = { env: { NODE_ENV: 'development', JWT_SECRET: 'session-claims-test-secret' } };
    const token = await createSessionToken({
        id: 80,
        username: 'staff',
        email: 'staff@example.com',
        role: 'standard',
        name: 'Staff Member',
        phone: '+6500000000',
        postalCode: '160024',
        dateOfBirth: '1950-01-01',
        subregionIds: [4],
        hardAssetStaffAccess: [{ hardAssetId: 12, staffRole: 'staff' }],
    }, context, {
        extraClaims: {
            organizationAccess: [{ organizationId: 3, role: 'staff' }],
        },
    });

    const claims = await verifySessionToken(token, context);
    assert.equal(claims.id, 80);
    assert.equal(typeof claims.exp, 'number');
    for (const field of [
        'username',
        'email',
        'role',
        'name',
        'phone',
        'postalCode',
        'dateOfBirth',
        'subregionIds',
        'hardAssetStaffAccess',
        'organizationAccess',
    ]) {
        assert.equal(Object.hasOwn(claims, field), false, `${field} must not be signed into the session token`);
    }
});

test('user-view session claims retain only minimal impersonation context', async () => {
    const context = { env: { NODE_ENV: 'development', JWT_SECRET: 'user-view-claims-test-secret' } };
    const token = await createSessionToken({ id: 91 }, context, {
        extraClaims: {
            isImpersonating: true,
            impersonatedBy: {
                id: 7,
                username: 'super-admin',
                email: 'admin@example.com',
                name: 'Admin Name',
                role: 'super_admin',
            },
        },
    });

    const claims = await verifySessionToken(token, context);
    assert.equal(claims.id, 91);
    assert.equal(claims.isImpersonating, true);
    assert.deepEqual(claims.impersonatedBy, { id: 7, name: 'Admin Name' });
});

test('production sessions require an explicit JWT secret', () => {
    assert.throws(
        () => getSessionSecret({ env: { NODE_ENV: 'production' } }),
        /JWT_SECRET is required in production/
    );
    assert.equal(
        getSessionSecret({ env: { NODE_ENV: 'production', JWT_SECRET: ' configured-secret ' } }),
        'configured-secret'
    );
});

test('development sessions keep the local fallback secret', () => {
    assert.equal(getSessionSecret({ env: { NODE_ENV: 'development' } }), 'seniorcare-secret-key');
});

test('request authentication hydrates live role instead of trusting stale token claims', async () => {
    const hydrated = await hydrateRequestUserFromDb({
        id: 5,
        username: 'stale-admin',
        email: 'stale@example.test',
        role: 'super_admin',
        name: 'Stale Admin',
        subregionIds: [],
    }, {
        db: {
            query: {
                users: {
                    findFirst: async () => ({
                        id: 5,
                        username: 'stale-admin',
                        email: 'stale@example.test',
                        role: 'standard',
                        name: 'Stale Admin',
                        postalCode: '680153',
                    }),
                },
                userSubregions: {
                    findMany: async () => [{ subregionId: 12 }],
                },
            },
        },
        loadPartnerStaffAccess: async () => [],
        loadHardAssetStaffAccess: async () => [],
        loadSoftAssetStaffAccess: async () => [],
        loadOrganizationAccess: async () => [],
    });

    assert.equal(hydrated.role, 'standard');
    assert.deepEqual(hydrated.subregionIds, [12]);
});
