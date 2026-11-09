import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test, { before, beforeEach, after } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db/schema.js';

// Dynamic import lets RED name the missing behavior instead of aborting at import time.
const contactsModule = await import('../src/utils/regionalDiscoveryContacts.js').catch(error => {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('regionalDiscoveryContacts.js')) throw error;
    return {};
});
const load = (...args) => {
    assert.equal(typeof contactsModule.loadRegionalDiscoveryContactApprovals, 'function', 'contact approval loader is implemented');
    return contactsModule.loadRegionalDiscoveryContactApprovals(...args);
};
const resolve = (...args) => {
    assert.equal(typeof contactsModule.resolveRegionalDiscoveryContacts, 'function', 'independent contact resolver is implemented');
    return contactsModule.resolveRegionalDiscoveryContacts(...args);
};
const hash = value => createHash('sha256').update(value).digest('hex');
const email = 'Provider.Enquiry@Example.test';
const refs = [{ resourceType: 'hard', resourceId: 92001 }, { resourceType: 'soft', resourceId: 94001 }];
const entry = { ...refs[0], status: 'available', contactPhone: '+65 (6000) 0001', subregionId: 91002 };
const original = { originalContacts: { email: { value: email, valueHash: hash(email) } } };
const replace = { emailMode: 'home-sr', phoneMode: 'home-sr' };
let pg, db;

before(async () => {
    pg = new PGlite(); db = drizzle(pg, { schema });
    const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
    for (const { tag } of journal.entries) await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
    // Wholly fictional ordinary-kind SRs, destinations, resources and publication authority.
    await pg.exec(`
      INSERT INTO users(id,username,email,password_hash,name) VALUES(1,'fixture','fixture@example.test','fixture','Fictional reviewer');
      INSERT INTO subregions(id,subregion_code,name) VALUES(91001,'S1','Fictional S1'),(91002,'S2','Fictional S2'),(91999,'SIN','Fictional national sentinel');
      INSERT INTO hard_assets(id,name,lat,lng,address,subregion_id,contact_email) VALUES(92001,'Fictional S2 service',1.3,103.8,'Fictional',91002,'${email}');
      INSERT INTO soft_assets(id,name,contact_email) VALUES(94001,'Fictional offering','soft@example.test');
      INSERT INTO partner_organizations(id,name,governance_status) VALUES(1,'Fictional organisation','active');
      INSERT INTO organization_agreements(id,organization_id,agreement_reference,status,expires_at,allowed_uses,approved_at)
        VALUES(1,1,'FICTIONAL-TERMS','active','2099-01-01T00:00:00Z','{"publicListing":true,"externalSharing":true}',now());
      INSERT INTO organization_resource_links(organization_id,resource_type,resource_id,link_status) VALUES(1,'hard',92001,'active');
      INSERT INTO resource_publication_permissions(organization_id,agreement_id,resource_type,resource_id,status,approved_fields,allowed_uses,terms_version,requested_by_user_id,reviewed_by_user_id,approved_at)
        VALUES(1,1,'hard',92001,'publishing_approved','["logoUrl"]','{"embeds":true,"sharedMaps":true}','fictional-v1',1,1,now());
    `);
});
after(async () => { await pg?.close(); });
beforeEach(async () => {
    await pg.exec(`
      DELETE FROM subregion_enquiry_contact_fields; DELETE FROM regional_embed_email_grants;
      UPDATE hard_assets SET contact_email='${email}' WHERE id=92001;
      UPDATE partner_organizations SET governance_status='active';
      UPDATE organization_resource_links SET link_status='active',unlinked_at=NULL;
      UPDATE organization_agreements SET status='active',revoked_at=NULL,effective_at=NULL,expires_at='2099-01-01T00:00:00Z',allowed_uses='{"publicListing":true,"externalSharing":true}',approved_at=now();
      UPDATE resource_publication_permissions SET status='publishing_approved',withdrawn_at=NULL,approved_at=now(),terms_version='fictional-v1',allowed_uses='{"embeds":true,"sharedMaps":true}';
    `);
    await db.insert(schema.regionalEmbedEmailGrants).values({ resourceType:'hard', resourceId:92001, status:'approved', approvedOriginalEmail:email, valueHash:hash(email), provenance:'Fictional review', approvedByUserId:99001, approvedAt:new Date() });
    await db.insert(schema.subregionEnquiryContactFields).values([
        [91001,'email','s1@example.test'], [91001,'phone','+6560000011'],
        [91002,'email','s2@example.test'], [91002,'phone','+6560000022'],
        [91999,'email','national@example.test'],
    ].map(([subregionId,field,value]) => ({subregionId,field,value,valueHash:hash(value),status:'approved',provenance:'Fictional steward review',approvedByUserId:99001,approvedAt:new Date()})));
});
async function context(homeSubregionId = 91001) {
    return { ...await load(db, refs, {subregionIds: homeSubregionId ? [homeSubregionId] : []}), homeSubregionId };
}
function unavailable(contact, status) {
    assert.equal(contact.status, status);
    for (const field of ['label','value','href']) assert.equal(field in contact, false, `${status} omits ${field}`);
}
function available(contact, value, href, appliesTo) {
    assert.deepEqual(contact, {status:'available',appliesTo,label:appliesTo === 'service' ? (href.startsWith('mailto:') ? 'Service email' : 'Service phone') : (href.startsWith('mailto:') ? 'ICCP enquiry email for this location' : 'ICCP enquiry phone for this location'),value,href});
}

test('other_sr_provider_uses_home_sr_recipient', async () => {
    const contact = resolve(entry, replace, await context());
    assert.equal(contact.email.value, 's1@example.test');
    available(contact.email,'s1@example.test','mailto:s1@example.test','entered-location');
    available(contact.phone,'+6560000011','tel:+6560000011','entered-location');
    const changed = resolve(entry, replace, await context(91002));
    assert.equal(changed.email.value,'s2@example.test');
    assert.equal(changed.phone.value,'+6560000022');
});
test('independent_fields_fail_closed', async () => {
    await pg.exec("UPDATE subregion_enquiry_contact_fields SET status='withdrawn',value=NULL,value_hash=NULL,withdrawn_by_user_id=99002,withdrawn_at=now(),withdrawal_reason='Fictional withdrawal' WHERE subregion_id=91001 AND field='email'");
    const contact = resolve(entry, replace, await context());
    assert.equal(contact.email.status,'temporarily-unavailable');
    assert.equal('value' in contact.email,false);
    unavailable(contact.email,'temporarily-unavailable');
    assert.equal(contact.phone.status,'available');
    await pg.exec("DELETE FROM subregion_enquiry_contact_fields WHERE subregion_id=91001 AND field='phone'");
    unavailable(resolve(entry,replace,await context()).phone,'temporarily-unavailable');
});
test('withdrawn_phone_does_not_suppress_approved_email', async () => {
    await pg.exec("UPDATE subregion_enquiry_contact_fields SET status='withdrawn',value=NULL,value_hash=NULL,withdrawn_by_user_id=99002,withdrawn_at=now(),withdrawal_reason='Fictional withdrawal' WHERE subregion_id=91001 AND field='phone'");
    const contact = resolve(entry,replace,await context());
    assert.equal(contact.email.value,'s1@example.test');
    unavailable(contact.phone,'temporarily-unavailable');
});
test('replacement_does_not_require_original_email_grant', async () => {
    await pg.exec('DELETE FROM regional_embed_email_grants; DELETE FROM resource_publication_permissions');
    const contact = resolve(entry,replace,await context());
    assert.equal(contact.email.value,'s1@example.test');
    assert.equal(contact.phone.status,'available');
    unavailable(resolve(entry,original,await context()).email,'temporarily-unavailable');
    // Restore the existing permission fixture for subsequent independent tests.
    await pg.exec(`INSERT INTO resource_publication_permissions(organization_id,agreement_id,resource_type,resource_id,status,approved_fields,allowed_uses,terms_version,requested_by_user_id,reviewed_by_user_id,approved_at)
      VALUES(1,1,'hard',92001,'publishing_approved','["logoUrl"]','{"embeds":true,"sharedMaps":true}','fictional-v1',1,1,now())`);
});
test('original_defaults_require_frozen_exact_email_but_keep_basic_public_phone', async () => {
    const contact = resolve(entry,original,await context(null));
    available(contact.email,email,'mailto:Provider.Enquiry@Example.test','service');
    available(contact.phone,'+65 (6000) 0001','tel:+6560000001','service');
    unavailable(resolve(entry,{},await context()).email,'temporarily-unavailable');
    for (const frozen of [{value:email}, {value:email,valueHash:hash('wrong')}, {value:email.toLowerCase(),valueHash:hash(email.toLowerCase())}]) {
        unavailable(resolve(entry,{originalContacts:{email:frozen}},await context()).email,'temporarily-unavailable');
    }
    assert.equal(resolve(entry,{},await context()).phone.status,'available');
    const hidden = resolve(entry,{emailMode:'hidden',phoneMode:'hidden'},await context());
    unavailable(hidden.email,'hidden'); unavailable(hidden.phone,'hidden');
    for (const badMode of ['replace',null,'Original']) unavailable(resolve(entry,{emailMode:badMode},await context()).email,'temporarily-unavailable');
});
test('unresolved_postal_zero_and_other_sr_registry_never_fall_back', async () => {
    for (const homeSubregionId of [undefined,null,0,'91001',-1]) {
        const contact = resolve(entry,replace,{...await context(),homeSubregionId});
        unavailable(contact.email,'needs-postal'); unavailable(contact.phone,'needs-postal');
    }
    await pg.exec('DELETE FROM subregion_enquiry_contact_fields WHERE subregion_id=91001');
    const missing = resolve(entry,replace,await context());
    unavailable(missing.email,'temporarily-unavailable'); unavailable(missing.phone,'temporarily-unavailable');
    unavailable(resolve(entry,replace,await context(91999)).email,'temporarily-unavailable');
});
test('original_email_source_change_case_and_reapproval_require_republication', async () => {
    const changed = email.toLowerCase();
    await pg.query('UPDATE hard_assets SET contact_email=$1 WHERE id=92001',[changed]);
    unavailable(resolve(entry,original,await context()).email,'temporarily-unavailable');
    await pg.query('UPDATE regional_embed_email_grants SET approved_original_email=$1,value_hash=$2',[changed,hash(changed)]);
    unavailable(resolve(entry,original,await context()).email,'temporarily-unavailable');
    const republished = { originalContacts:{email:{value:changed,valueHash:hash(changed)}} };
    assert.equal(resolve(entry,republished,await context()).email.value,changed);
    await pg.query('UPDATE hard_assets SET contact_email=$1 WHERE id=92001',[`  ${changed}  `]);
    assert.equal(resolve(entry,republished,await context()).email.value,changed);
});
test('stale_hashes_and_invalid_destinations_suppress_only_the_affected_field', async () => {
    await pg.query('UPDATE regional_embed_email_grants SET value_hash=$1',[hash('stale')]);
    unavailable(resolve(entry,original,await context()).email,'temporarily-unavailable');
    assert.equal(resolve(entry,original,await context()).phone.status,'available');
    for (const value of ['javascript:alert(1)','x@example.test?body=private','x\r\ny@example.test']) {
        await pg.query("UPDATE subregion_enquiry_contact_fields SET value=$1,value_hash=$2 WHERE subregion_id=91001 AND field='email'",[value,hash(value)]);
        unavailable(resolve(entry,replace,await context()).email,'temporarily-unavailable');
        assert.equal(resolve(entry,replace,await context()).phone.status,'available');
    }
    await pg.query("UPDATE subregion_enquiry_contact_fields SET value_hash=$1 WHERE subregion_id=91001 AND field='phone'",[hash('stale')]);
    unavailable(resolve(entry,replace,await context()).phone,'temporarily-unavailable');
    for (const contactPhone of ['tel:123','123?body=private','123abc','++123','12']) unavailable(resolve({...entry,contactPhone},original,await context()).phone,'temporarily-unavailable');
});
test('live_permission_organization_link_and_agreement_gates_remain_additional', async () => {
    const mutations = [
        ["UPDATE organization_agreements SET expires_at=now()-interval '1 hour'","UPDATE organization_agreements SET expires_at='2099-01-01T00:00:00Z'"],
        ["UPDATE organization_agreements SET effective_at=now()+interval '1 hour'","UPDATE organization_agreements SET effective_at=NULL"],
        ["UPDATE organization_agreements SET revoked_at=now()","UPDATE organization_agreements SET revoked_at=NULL"],
        ["UPDATE organization_agreements SET allowed_uses='{\"publicListing\":true,\"externalSharing\":false}'","UPDATE organization_agreements SET allowed_uses='{\"publicListing\":true,\"externalSharing\":true}'"],
        ["UPDATE partner_organizations SET governance_status='suspended'","UPDATE partner_organizations SET governance_status='active'"],
        ["UPDATE organization_resource_links SET link_status='unlinked',unlinked_at=now()","UPDATE organization_resource_links SET link_status='active',unlinked_at=NULL"],
        ["UPDATE resource_publication_permissions SET allowed_uses='{\"sharedMaps\":true,\"embeds\":false}'","UPDATE resource_publication_permissions SET allowed_uses='{\"sharedMaps\":true,\"embeds\":true}'"],
        ["UPDATE resource_publication_permissions SET status='owner_verified'","UPDATE resource_publication_permissions SET status='publishing_approved'"],
    ];
    for (const [deny,restore] of mutations) {
        await pg.exec(deny);
        const result = resolve(entry,original,await context());
        unavailable(result.email,'temporarily-unavailable');
        assert.equal(result.phone.status,'available');
        assert.equal(resolve(entry,replace,await context()).email.value,'s1@example.test');
        await pg.exec(restore);
    }
    assert.equal(resolve(entry,original,await context()).email.status,'available');
});
test('grant_withdrawal_live_resource_status_and_missing_originals_fail_closed', async () => {
    await pg.exec("UPDATE regional_embed_email_grants SET status='withdrawn',approved_original_email=NULL,value_hash=NULL,withdrawn_by_user_id=99002,withdrawn_at=now(),withdrawal_reason='Fictional withdrawal'");
    unavailable(resolve(entry,original,await context()).email,'temporarily-unavailable');
    for (const status of ['unavailable',undefined]) {
        const result = resolve({...entry,status},replace,await context());
        unavailable(result.email,'temporarily-unavailable'); unavailable(result.phone,'temporarily-unavailable');
    }
    unavailable(resolve({...entry,contactPhone:null},original,await context()).phone,'temporarily-unavailable');
    // An unrelated resource cannot borrow this provider's frozen contact or grant.
    unavailable(resolve({...entry,resourceType:'soft',resourceId:94001},original,await context()).email,'temporarily-unavailable');
});
test('historical_actors_and_exact_uri_output_never_insert_personal_message_content', async () => {
    // Actor 99001 intentionally has no live users row; C5 retains historical authority.
    const metadata = await context();
    const contact = resolve(entry,{...replace,body:'Private personal context',recipient:'other@example.test'},metadata);
    assert.equal(contact.email.href,'mailto:s1@example.test');
    assert.equal(contact.phone.href,'tel:+6560000011');
    assert.equal(resolve(entry,original,metadata).email.status,'available');
    assert.equal(JSON.stringify(contact).includes('Private'),false);
    assert.equal(JSON.stringify(contact).includes('99001'),false);
});
test('empty_global_field_set_can_authorize_only_regional_email_and_soft_refs_remain_exact', async () => {
    await pg.exec(`UPDATE resource_publication_permissions SET approved_fields='[]';
      INSERT INTO organization_resource_links(organization_id,resource_type,resource_id,link_status) VALUES(1,'soft',94001,'active');
      INSERT INTO resource_publication_permissions(organization_id,agreement_id,resource_type,resource_id,status,approved_fields,allowed_uses,terms_version,requested_by_user_id,reviewed_by_user_id,approved_at)
        VALUES(1,1,'soft',94001,'publishing_approved','[]','{"embeds":true}','fictional-v1',1,1,now());`);
    await db.insert(schema.regionalEmbedEmailGrants).values({ resourceType:'soft',resourceId:94001,status:'approved',approvedOriginalEmail:'soft@example.test',valueHash:hash('soft@example.test'),provenance:'Fictional review',approvedByUserId:99001,approvedAt:new Date() });
    try {
        const metadata = await context();
        assert.equal(resolve(entry,original,metadata).email.value,email);
        const soft = {...refs[1],status:'available',contactPhone:'60000002'};
        const softIntent = {originalContacts:{email:{value:'soft@example.test',valueHash:hash('soft@example.test')}}};
        assert.equal(resolve(soft,softIntent,metadata).email.value,'soft@example.test');
        unavailable(resolve(soft,original,metadata).email,'temporarily-unavailable');
    } finally {
        await pg.exec("DELETE FROM resource_publication_permissions WHERE resource_type='soft'; DELETE FROM organization_resource_links WHERE resource_type='soft'; UPDATE resource_publication_permissions SET approved_fields='[\"logoUrl\"]'");
    }
});
test('loader_bounds_refs_and_missing_stores_fail_closed_without_runtime_ddl', async () => {
    assert.deepEqual(await load({},[]),{approvedFields:new Map(),enquiryContacts:new Map()});
    await assert.rejects(() => load(db,Array.from({length:501},(_,index)=>({resourceType:'hard',resourceId:index+1}))),/500/);
    await assert.rejects(() => load(db,[{resourceType:'hard',resourceId:0}]),/reference/i);
    await assert.rejects(() => load(db,refs,{subregionIds:[0]}),/subregion/i);
    await assert.rejects(() => load(db,refs,{subregionIds:Array.from({length:86},(_,index)=>index+1)}),/85/);
    await pg.exec('ALTER TABLE regional_embed_email_grants RENAME TO fixture_missing_grants');
    try {
        await assert.rejects(() => load(db,refs));
        assert.equal((await pg.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name='regional_embed_email_grants'")).rows[0].n,0);
    } finally { await pg.exec('ALTER TABLE fixture_missing_grants RENAME TO regional_embed_email_grants'); }
    const queries = [];
    const loggedDb = drizzle(pg,{schema,logger:{logQuery(query) { queries.push(query); }}});
    const withoutRegistry = await load(loggedDb,refs);
    assert.equal(withoutRegistry.enquiryContacts.size,0);
    assert.equal(queries.some(query=>query.includes('subregion_enquiry_contact_fields')),false);
    queries.length = 0;
    const limited = await load(loggedDb,[refs[0],refs[0]],{subregionIds:[91001,91001]});
    assert.equal(limited.approvedFields.size,1);
    assert.deepEqual([...limited.enquiryContacts.keys()],[91001]);
});
