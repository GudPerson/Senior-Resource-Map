// Full application rehearsal on disposable PostgreSQL. No environment files,
// production identities, auth overrides, or external database connections.
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import app from '../../src/app.js';
import { createNeonPostgresFixture } from './neonPostgresFixture.mjs';

export const pilotPassword = 'Fictional-Pilot-2026!';

export async function createGovernedPilotFixture(t) {
    const { pg, env } = await createNeonPostgresFixture(t);
    Object.assign(env, { NODE_ENV: 'development', JWT_SECRET: randomUUID(), GOVERNED_PILOT_ENABLED: 'true' });
    const cache = new Map();
    env.MAP_CACHE = {
        async get(key, type) { const value = cache.get(key) ?? null; return type === 'json' && value ? JSON.parse(value) : value; },
        async put(key, value) { cache.set(key, value); },
        async delete(key) { cache.delete(key); },
    };
    const background = [];
    const execution = { waitUntil(promise) { background.push(promise); }, passThroughOnException() {} };
    t.after(async () => { await Promise.allSettled(background); });
    const hash = await bcrypt.hash(pilotPassword, 4);
    for (const [username, role] of [['pilot-admin', 'super_admin'], ['pilot-recovery', 'super_admin'], ['pilot-public', 'standard']]) {
        await pg.query(`INSERT INTO users (username,email,password_hash,name,role,postal_code)
            VALUES ($1,$2,$3,$4,$5,'680001')`, [username, `${username}@carearound.test`, hash, `Fictional ${username}`, role]);
    }
    async function request(path, { method = 'GET', body, cookie = '', expected = 200, ip = '192.0.2.10' } = {}) {
        const headers = { host: 'localhost:5183', origin: 'http://localhost:5183', 'cf-connecting-ip': ip };
        if (body !== undefined) headers['content-type'] = 'application/json';
        if (cookie) headers.cookie = cookie;
        const response = await app.request(`http://localhost:5183/api${path}`, {
            method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        }, env, execution);
        const data = await response.json();
        assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
        return { data, response };
    }
    async function login(email, { expected = 200, partner = true, ip } = {}) {
        const result = await request('/auth/login', { method: 'POST', expected, ip,
            body: { email, password: pilotPassword, isPartnerLogin: partner } });
        return { ...result, cookie: result.response.headers.get('set-cookie')?.split(';')[0] || '' };
    }
    const admin = await login('pilot-admin@carearound.test');
    const recovery = await login('pilot-recovery@carearound.test');
    const publicUser = await login('pilot-public@carearound.test', { partner: false });
    const id = async (query, params = []) => (await pg.query(query, params)).rows[0].id;
    const groupId = await id(`INSERT INTO governance_groups (group_type,name) VALUES ('region','Fictional Pilot Region') RETURNING id`);
    const partners = [];
    for (const [index, key] of ['a', 'b'].entries()) {
        const domain = `pilot-${key}.example`;
        const submitted = await request('/organization-onboarding/requests', { method: 'POST', expected: 202,
            body: { organizationName: `Fictional Partner ${key.toUpperCase()}`, emailDomain: domain,
                websiteUrl: `https://${domain}`, applicantName: `Fictional Applicant ${key.toUpperCase()}`,
                applicantEmail: `admin@${domain}`, logoUrl: `https://${domain}/approved-logo.png`,
                bannerUrl: `https://${domain}/approved-banner.png`, termsAccepted: true, digitalAssetUseGranted: true } });
        assert.equal(submitted.response.headers.get('set-cookie'), null);
        const approved = await request(`/organization-onboarding/requests/${submitted.data.request.id}/approve`, {
            method: 'POST', cookie: admin.cookie, body: {},
        });
        const orgId = approved.data.result.organizationId;
        const joined = await request('/organization-onboarding/join', { method: 'POST', expected: 202,
            body: { email: `admin@${domain}`, name: `Fictional Admin ${key.toUpperCase()}`, password: pilotPassword, termsAccepted: true } });
        assert.equal(joined.response.headers.get('set-cookie'), null);
        await login(`admin@${domain}`, { expected: 401 });
        const accepted = await request(`/organization-onboarding/join-requests/${joined.data.request.id}/approve`, {
            method: 'POST', cookie: admin.cookie, body: { accessRole: 'admin' },
        });
        const userId = accepted.data.result.createdUserId;
        // Fixture-only role/resource setup, modelling the existing governance
        // administration. Onboarding and sign-in above use actual HTTP routes.
        await pg.query(`UPDATE users SET postal_code='680001' WHERE id=$1`, [userId]);
        const resourceId = await id(`INSERT INTO hard_assets (name,sub_category,lat,lng,address,country,description,website,logo_url,banner_url)
            VALUES ($1,'Active Ageing Centres',$2,$3,$4,'SG','Fictional resource for pilot rehearsal',
                'https://unapproved.example/source','https://unapproved.example/logo.png','https://unapproved.example/banner.png') RETURNING id`,
        [`Fictional Resource ${key.toUpperCase()}`, 1.38 + index * 0.01, 103.75 + index * 0.01, `${index + 1} Fictional Road`]);
        await pg.query(`INSERT INTO organization_resource_links (organization_id,resource_type,resource_id,link_status,agreement_coverage_status)
            VALUES ($1,'hard',$2,'active','covered')`, [orgId, resourceId]);
        await pg.query(`INSERT INTO governance_group_organizations (group_id,organization_id) VALUES ($1,$2)`, [groupId, orgId]);
        await pg.query(`INSERT INTO governance_group_resource_links (group_id,resource_type,resource_id) VALUES ($1,'hard',$2)`, [groupId, resourceId]);
        partners.push({ orgId, userId, resourceId, email: `admin@${domain}`, ...(await login(`admin@${domain}`)) });
    }
    return { app, pg, env, execution, request, login, admin, recovery, publicUser, groupId, partners };
}
