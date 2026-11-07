import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db/schema.js';
import { normalizeRegionalDiscoveryConfig, validateRegionalDiscoveryConfig, loadRegionalDiscoveryDocument } from '../src/utils/regionalDiscoveryConfig.js';

const config = () => ({ schemaVersion: 1, mode: 'regional-discovery', includedSubregionIds: [91001], regionExtent: [103.6, 1.15, 104.1, 1.5], entries: [{ resourceType: 'hard', resourceId: 101, mapPlacement: 'published-locations', distanceSource: 'published-locations', emailMode: 'original', phoneMode: 'home-sr' }] });

test('compact_works_without_regional_tables', async () => {
    const pg = new PGlite();
    const legacyNewTableQueries = [];
    const db = drizzle(pg, { schema, logger: { logQuery(query) { if (/regional|enquiry_contact/.test(query)) legacyNewTableQueries.push(query); } } });
    try {
        const compact = normalizeRegionalDiscoveryConfig(null);
        assert.equal(compact.mode, 'compact');
        assert.deepEqual(await validateRegionalDiscoveryConfig(db, { id: 1 }, { id: 9, userId: 1 }, compact), compact);
        const { readFile } = await import('node:fs/promises');
        const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
        for (const { tag } of journal.entries) {
            if (tag === '0011_regional_discovery') break;
            await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
        }
        await pg.exec(`INSERT INTO users(id,username,email,password_hash,name) VALUES(1,'legacy','legacy@example.invalid','fixture','Fictional');
          INSERT INTO my_maps(id,user_id,name,is_shared,share_token,embed_enabled,embed_allowed_origins) VALUES(9,1,'Fictional compact',true,'fictional-compact-token',true,'["https://example.invalid"]');
          INSERT INTO my_map_share_snapshots(map_id,share_token,snapshot) VALUES(9,'fictional-compact-token','{"id":9,"name":"Fictional compact","assets":[],"places":[],"pins":[],"summary":{"resourceCount":0},"share":{}}');`);
        const { getEmbeddedMapDirectory } = await import('../src/controllers/sharedMapsController.js');
        const directory = await getEmbeddedMapDirectory(db, 'fictional-compact-token');
        assert.equal(directory.name, 'Fictional compact');
        assert.deepEqual(directory.places, []);
        assert.equal(legacyNewTableQueries.length, 0);
        assert.equal((await loadRegionalDiscoveryDocument(db, 9)).revision, 0);
    } finally { await pg.close(); }
});

test('rejects_config_limits_unknown_fields_duplicates_and_invalid_extent', () => {
    for (const mutate of [
        c => { c.entries = Array.from({ length: 501 }, (_, i) => ({ ...c.entries[0], resourceId: i + 1 })); },
        c => { c.includedSubregionIds = []; },
        c => { c.includedSubregionIds = Array.from({ length: 86 }, (_, i) => i + 1); },
        c => { c.includedSubregionIds = [91001, 91001]; },
        c => { c.entries.push({ ...c.entries[0] }); },
        c => { c.regionExtent = [104, 2, 103, 1]; },
        c => { c.entries[0].recipient = 'arbitrary@example.invalid'; },
        c => { c.entries[0].emailMode = 'replace-anywhere'; },
        c => { c.regionExtent[0] = NaN; },
        c => { c.extra = 'x'.repeat(65536); },
    ]) {
        const value = config(); mutate(value);
        assert.throws(() => normalizeRegionalDiscoveryConfig(value), { status: 400 });
    }
    const value = config();
    const normalized = normalizeRegionalDiscoveryConfig(value);
    normalized.entries[0].emailMode = 'hidden';
    assert.equal(value.entries[0].emailMode, 'original');
});

test('validates_owned_map_membership_real_sr_and_live_publishability', async () => {
    const pg = new PGlite();
    const db = drizzle(pg, { schema });
    try {
        const { readFile } = await import('node:fs/promises');
        const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
        for (const { tag } of journal.entries) await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
        await pg.exec(`INSERT INTO users(id,username,email,password_hash,name) VALUES(1,'fictional','fictional@example.invalid','fixture','Fictional');
          INSERT INTO my_maps(id,user_id,name) VALUES(9,1,'Fictional map');
          INSERT INTO subregions(id,subregion_code,name) VALUES(91001,'S1','Fictional S1'),(91999,'SIN','Fictional national');
          INSERT INTO hard_assets(id,name,sub_category,lat,lng,address) VALUES(101,'Fictional service','Community Support',1.3,103.8,'Fictional');
          INSERT INTO my_map_assets(map_id,resource_type,resource_id) VALUES(9,'hard',101);`);
        const map = { id: 9, userId: 1 };
        assert.equal((await validateRegionalDiscoveryConfig(db, { id: 1 }, map, config())).entries.length, 1);
        await assert.rejects(validateRegionalDiscoveryConfig(db, { id: 2 }, map, config()), { status: 403 });
        const missing = config(); missing.entries[0].resourceId = 999;
        await assert.rejects(validateRegionalDiscoveryConfig(db, { id: 1 }, map, missing), { status: 400 });
        const national = config(); national.includedSubregionIds = [91999];
        await assert.rejects(validateRegionalDiscoveryConfig(db, { id: 1 }, map, national), { status: 400 });
        await pg.exec(`INSERT INTO soft_assets(id,name,sub_category) VALUES(201,'Fictional home-based service','Services');
          INSERT INTO my_map_assets(map_id,resource_type,resource_id) VALUES(9,'soft',201);`);
        const unplotted = config(); unplotted.entries = [{ ...unplotted.entries[0], resourceType: 'soft', resourceId: 201, mapPlacement: 'unplotted', distanceSource: 'none' }];
        assert.equal((await validateRegionalDiscoveryConfig(db, { id: 1 }, map, unplotted)).entries[0].mapPlacement, 'unplotted');
        await pg.exec(`UPDATE my_map_assets SET snapshot='{"version":2,"places":[],"mapLocationScope":{"version":1,"placeIds":[99999]}}' WHERE resource_id=101`);
        const scopedBefore = (await pg.query("SELECT snapshot FROM my_map_assets WHERE resource_id=101")).rows;
        assert.equal((await validateRegionalDiscoveryConfig(db, { id: 1 }, map, config())).entries[0].mapPlacement, 'published-locations');
        assert.deepEqual((await pg.query("SELECT snapshot FROM my_map_assets WHERE resource_id=101")).rows, scopedBefore);
        await pg.exec('UPDATE hard_assets SET is_hidden=true WHERE id=101');
        await assert.rejects(validateRegionalDiscoveryConfig(db, { id: 1 }, map, config()), { status: 400 });
        await pg.exec('UPDATE hard_assets SET is_hidden=false,is_deleted=true WHERE id=101');
        await assert.rejects(validateRegionalDiscoveryConfig(db, { id: 1 }, map, config()), { status: 400 });
    } finally { await pg.close(); }
});

test('shared_contact_values_preserve_exact_safe_channel_actions', async () => {
    const { buildRegionalContactHref } = await import('../../shared/regionalDiscoveryContactValues.js');
    assert.equal(buildRegionalContactHref('email', 'Sample+Enquiry@Example.invalid'), 'mailto:Sample%2BEnquiry@Example.invalid');
    assert.equal(buildRegionalContactHref('email', "sample#tag@example.invalid"), 'mailto:sample%23tag@example.invalid');
    assert.equal(buildRegionalContactHref('phone', '+65 (6000)-0001'), 'tel:+6560000001');
    for (const [field, value] of [['email','a..b@example.invalid'],['email','x@example..invalid'],['email','a@example.invalid?to=x@example.invalid'],['email',null],['phone','++6560000001'],['phone','123?body=private'],['fax','123']]) assert.equal(buildRegionalContactHref(field,value),null);
});
