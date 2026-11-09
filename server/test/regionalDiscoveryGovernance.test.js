import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { before, after, beforeEach } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db/schema.js';
import { createRegionalDiscoveryGovernanceRoutes } from '../src/routes/regionalDiscoveryGovernance.js';

let pg, db;
const base = '/subregions/91001/contacts';
const approval = { revision: 0, status: 'approved', value: 'sample+enquiry@example.invalid', provenance: 'Fictional steward review only' };
let actor = { id: 1, role: 'super_admin' };
let beforePublication;
before(async () => {
    pg = new PGlite(); db = drizzle(pg, { schema });
    // Real SQL queries in a real transaction; the shim provides the Neon batch interface.
    db.batch = async queries => {
        await pg.exec('BEGIN');
        try { const results = []; for (const query of queries) results.push(await query); await pg.exec('COMMIT'); return results; }
        catch (error) { await pg.exec('ROLLBACK'); throw error; }
    };
    const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
    for (const { tag } of journal.entries) await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
    await pg.exec(`INSERT INTO users(id,username,email,password_hash,name,role) VALUES(1,'admin','admin@example.invalid','fixture','Fictional Admin','super_admin'),(2,'curator','curator@example.invalid','fixture','Fictional Curator','standard');
      INSERT INTO subregions(id,subregion_code,name) VALUES(91001,'S1','Fictional S1');
      INSERT INTO hard_assets(id,name,sub_category,lat,lng,address,contact_email) VALUES(101,'Fictional service','Community Support',1.3,103.8,'Fictional','sample+enquiry@example.invalid');
      INSERT INTO partner_organizations(id,name) VALUES(1,'Fictional organisation');
      INSERT INTO resource_publication_permissions(organization_id,resource_type,resource_id,status) VALUES(1,'hard',101,'claim_pending');`);
    beforePublication = (await pg.query('SELECT * FROM resource_publication_permissions')).rows;
});
after(async () => { await pg?.close(); });
beforeEach(async () => { actor = { id: 1, role: 'super_admin' }; await pg.exec("DELETE FROM subregion_enquiry_contact_fields; DELETE FROM regional_embed_email_grants; DELETE FROM sensitive_audit_logs; UPDATE hard_assets SET contact_email='sample+enquiry@example.invalid' WHERE id=101"); });
function app() { return createRegionalDiscoveryGovernanceRoutes({ getDatabase: () => db, authenticate: async (c, next) => { if (!actor) return c.json({error:'Unauthorized'},401); c.set('user',actor); return next(); } }); }
async function request(path, body) { return app().request(path, body === undefined ? {} : { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) }); }

test('rejects_stale_revision', async () => {
    assert.equal((await request(`${base}/email`, approval)).status, 200);
    const stale = await request(`${base}/email`, { ...approval, value:'changed@example.invalid' });
    assert.equal(stale.status, 409);
    const response = await request(`${base}/email`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).value, 'sample+enquiry@example.invalid');
    assert.equal((await pg.query('SELECT count(*)::int AS count FROM sensitive_audit_logs')).rows[0].count, 1);
});
test('curator_cannot_approve', async () => {
    for (const role of ['standard','regional_admin','partner','guest']) {
        actor = { id:2,role,subregionIds:[91001] };
        const curatorApproval = await request(`${base}/email`, approval);
        assert.equal(curatorApproval.status, 403);
        assert.equal((await request(`${base}/email`)).status, 403);
    }
    actor = null;
    assert.equal((await request(`${base}/email`, approval)).status, 401);
    assert.equal((await pg.query('SELECT count(*)::int AS count FROM sensitive_audit_logs')).rows[0].count, 0);
});
test('field_withdrawal_is_independent_and_audited_without_recipient_leak', async () => {
    await request(`${base}/email`, approval);
    assert.equal((await request(`${base}/phone`, { ...approval, value:'+65 6000 0001' })).status, 200);
    const withdrawn = await request(`${base}/email`, {revision:1,status:'withdrawn',provenance:'Fictional withdrawal',withdrawalReason:'Fictional destination retired'});
    assert.equal(withdrawn.status, 200);
    const body = await withdrawn.json();
    assert.equal(body.revision, 2); assert.equal(body.status, 'withdrawn');
    assert.equal(Object.hasOwn(body,'value'), false); assert.equal(Object.hasOwn(body,'href'), false);
    const phone = await (await request(`${base}/phone`)).json();
    assert.equal(phone.value, '+6560000001'); assert.equal(phone.href,'tel:+6560000001');
    const row = (await pg.query('SELECT * FROM subregion_enquiry_contact_fields WHERE field=\'email\'')).rows[0];
    assert.equal(row.value, null); assert.equal(row.value_hash,null); assert.equal(row.withdrawn_by_user_id,1);
    const audit = (await pg.query('SELECT * FROM sensitive_audit_logs ORDER BY id')).rows;
    assert.equal(audit.length,3); assert.equal(audit[2].action_type,'regional_contact_withdrawn');
    assert.equal(JSON.stringify(audit).includes('sample+enquiry'),false);
    assert.deepEqual((await pg.query('SELECT * FROM resource_publication_permissions')).rows,beforePublication);
});
test('original_email_grant_binds_current_canonical_email_and_withdraws', async () => {
    const path = '/resources/hard/101/email-grant';
    assert.equal((await request(path,{...approval,value:undefined,approvedOriginalEmail:'other@example.invalid'})).status,400);
    const response = await request(path,{...approval,value:undefined,approvedOriginalEmail:'sample+enquiry@example.invalid'});
    assert.equal(response.status,200);
    const row = (await pg.query('SELECT * FROM regional_embed_email_grants')).rows[0];
    assert.equal(row.approved_original_email,'sample+enquiry@example.invalid'); assert.match(row.value_hash,/^[0-9a-f]{64}$/);
    assert.equal((await request(path,{revision:1,status:'withdrawn',provenance:'Fictional review',withdrawalReason:'Permission withdrawn'})).status,200);
    const result = await (await request(path)).json(); assert.equal(Object.hasOwn(result,'approvedOriginalEmail'),false);
    assert.deepEqual((await pg.query('SELECT * FROM resource_publication_permissions')).rows,beforePublication);
});
test('rejects_arbitrary_recipients_invalid_fields_and_missing_withdrawal_provenance', async () => {
    for (const value of ['a..b@example.invalid','a@example..invalid','a@example.invalid?to=other@example.invalid','a\r\nb@example.invalid','not email']) assert.equal((await request(`${base}/email`,{...approval,value})).status,400);
    for (const value of ['+65 6000 0001?body=private','123abc','++6560000001']) assert.equal((await request(`${base}/phone`,{...approval,value})).status,400);
    assert.equal((await request(`${base}/fax`,approval)).status,400);
    assert.equal((await request(`${base}/email`,{...approval,arbitraryRecipient:'x@example.invalid'})).status,400);
    assert.equal((await request(`${base}/email`,{revision:0,status:'withdrawn',provenance:'Fictional'})).status,400);
    assert.equal((await request('/subregions/99999/contacts/email',approval)).status,404);
    assert.equal((await request('/resources/hard/99999/email-grant',{...approval,value:undefined,approvedOriginalEmail:'sample@example.invalid'})).status,404);
});
test('audit_failure_rolls_back_approval', async () => {
    await pg.exec('ALTER TABLE sensitive_audit_logs ADD CONSTRAINT reject_fixture_audit CHECK (false)');
    try {
        assert.equal((await request(`${base}/email`,approval)).status,503);
        assert.equal((await pg.query('SELECT count(*)::int AS count FROM subregion_enquiry_contact_fields')).rows[0].count,0);
    } finally { await pg.exec('ALTER TABLE sensitive_audit_logs DROP CONSTRAINT reject_fixture_audit'); }
});

test('atomic_guard_rejects_revision_changed_after_preflight', async () => {
    assert.equal((await request(`${base}/email`,approval)).status,200);
    const batch = db.batch;
    db.batch = async queries => {
        db.batch = batch;
        await pg.exec("UPDATE subregion_enquiry_contact_fields SET revision=2 WHERE field='email'");
        return batch(queries);
    };
    try {
        const raced = await request(`${base}/email`, { ...approval, revision:1, value:'changed@example.invalid' });
        assert.equal(raced.status,409);
        const result = await (await request(`${base}/email`)).json();
        assert.equal(result.revision,2); assert.equal(result.value,'sample+enquiry@example.invalid');
        assert.equal((await pg.query('SELECT count(*)::int AS count FROM sensitive_audit_logs')).rows[0].count,1);
    } finally { db.batch = batch; }
});

test('absent_governance_store_fails_closed_without_creating_schema', async () => {
    await pg.exec('ALTER TABLE regional_embed_email_grants RENAME TO fixture_unavailable_email_grants');
    try {
        const response = await request('/resources/hard/101/email-grant');
        assert.equal(response.status,503);
        assert.equal(response.headers.get('cache-control'),'no-store');
        assert.equal((await request('/resources/hard/101/email-grant',{...approval,value:undefined,approvedOriginalEmail:'sample+enquiry@example.invalid'})).status,503);
        assert.equal((await pg.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_name='regional_embed_email_grants'")).rows[0].count,0);
    } finally { await pg.exec('ALTER TABLE fixture_unavailable_email_grants RENAME TO regional_embed_email_grants'); }
});


test('preserves_email_case_and_binds_exact_case_in_original_grant', async () => {
    const value = 'Mixed.Case+Enquiry@Example.invalid';
    const response = await request(`${base}/email`, { ...approval, value });
    assert.equal(response.status,200);
    const contact = await response.json();
    assert.equal(contact.value,value);
    assert.equal(contact.href,'mailto:Mixed.Case%2BEnquiry@Example.invalid');
    const { createHash } = await import('node:crypto');
    const expectedHash = createHash('sha256').update(value).digest('hex');
    const row = (await pg.query('SELECT value_hash FROM subregion_enquiry_contact_fields')).rows[0];
    assert.equal(row.value_hash,expectedHash);
    await pg.query('UPDATE hard_assets SET contact_email=$1 WHERE id=101',[value]);
    const path = '/resources/hard/101/email-grant';
    assert.equal((await request(path,{...approval,value:undefined,approvedOriginalEmail:value.toLowerCase()})).status,400);
    assert.equal((await request(path,{...approval,value:undefined,approvedOriginalEmail:value})).status,200);
    const grant = await (await request(path)).json();
    assert.equal(grant.approvedOriginalEmail,value);
    assert.equal((await pg.query('SELECT value_hash FROM regional_embed_email_grants')).rows[0].value_hash,expectedHash);
});

for (const kind of ['registry', 'original-grant']) {
    for (const state of ['approved', 'withdrawn']) {
        test(`account_deletion_preserves_${kind}_${state}_decision_and_audit`, async () => {
            await pg.exec(`INSERT INTO users(id,username,email,password_hash,name,role)
                VALUES(3,'former-admin','former-admin@example.invalid','fixture','Fictional Former Admin','super_admin')
                ON CONFLICT (id) DO NOTHING`);
            actor = { id:3, role:'super_admin' };
            const path = kind === 'registry' ? `${base}/email` : '/resources/hard/101/email-grant';
            const table = kind === 'registry' ? 'subregion_enquiry_contact_fields' : 'regional_embed_email_grants';
            const body = kind === 'registry' ? approval : { revision:0, status:'approved', approvedOriginalEmail:'sample+enquiry@example.invalid', provenance:'Fictional provider approval' };
            assert.equal((await request(path,body)).status,200);
            if (state === 'withdrawn') assert.equal((await request(path,{ revision:1, status:'withdrawn', provenance:'Fictional withdrawal', withdrawalReason:'Fictional destination retired' })).status,200);
            const decisionBefore = (await pg.query(`SELECT * FROM ${table}`)).rows;
            const auditBefore = (await pg.query('SELECT id,action_type,metadata FROM sensitive_audit_logs ORDER BY id')).rows;
            await pg.exec('DELETE FROM users WHERE id=3');
            assert.deepEqual((await pg.query(`SELECT * FROM ${table}`)).rows,decisionBefore);
            assert.equal(decisionBefore[0].approved_by_user_id,3);
            if (state === 'withdrawn') assert.equal(decisionBefore[0].withdrawn_by_user_id,3);
            assert.deepEqual((await pg.query('SELECT id,action_type,metadata FROM sensitive_audit_logs ORDER BY id')).rows,auditBefore);
            assert.equal((await pg.query('SELECT count(*)::int AS count FROM sensitive_audit_logs WHERE actor_user_id IS NULL')).rows[0].count,state === 'approved' ? 1 : 2);
            const { hydrateRequestUserFromDb } = await import('../src/middleware/auth.js');
            await assert.rejects(hydrateRequestUserFromDb({id:3,role:'super_admin'},{db}),/Session user no longer exists/);
            actor = { id:1, role:'super_admin' };
            const retained = await (await request(path)).json();
            assert.equal(retained.status,state);
            assert.equal(retained.approvedByUserId,3);
            assert.equal(retained.revision,state === 'approved' ? 1 : 2);
            if (state === 'withdrawn') assert.equal(retained.withdrawnByUserId,3);
            assert.deepEqual((await pg.query('SELECT * FROM resource_publication_permissions')).rows,beforePublication);
        });
    }
}
