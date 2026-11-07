import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { verifyRegionalDiscoverySchema } from '../src/utils/regionalDiscoverySchema.js';

test('migration_is_additive_and_schema_verifier_detects_missing_tables_constraints_and_columns', async () => {
    const pg = new PGlite();
    const db = drizzle(pg);
    try {
        await assert.rejects(verifyRegionalDiscoverySchema(db));
        const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
        for (const { tag } of journal.entries) {
            if (tag === '0011_regional_discovery') break;
            await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
        }
        await pg.exec(`INSERT INTO users(id,username,email,password_hash,name) VALUES(1,'fixture','fixture@example.invalid','fixture','Fictional');
          INSERT INTO my_maps(id,user_id,name) VALUES(9,1,'Fictional');
          INSERT INTO subregions(id,subregion_code,name) VALUES(91001,'S1','Fictional S1');
          INSERT INTO partner_organizations(id,name) VALUES(1,'Fictional organisation');
          INSERT INTO resource_publication_permissions(organization_id,resource_type,resource_id,status) VALUES(1,'hard',101,'claim_pending');`);
        const publicationBefore = (await pg.query('SELECT * FROM resource_publication_permissions')).rows;
        const mapBefore = (await pg.query('SELECT * FROM my_maps')).rows;
        await pg.exec(await readFile(new URL('../drizzle/0011_regional_discovery.sql', import.meta.url), 'utf8'));
        const result = await verifyRegionalDiscoverySchema(db);
        assert.equal(result.tables.length, 3);
        assert.deepEqual((await pg.query('SELECT * FROM resource_publication_permissions')).rows, publicationBefore);
        assert.deepEqual((await pg.query('SELECT * FROM my_maps')).rows, mapBefore);
        for (const table of result.tables) assert.equal((await pg.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 0);
        await pg.exec(`INSERT INTO my_map_regional_discovery_documents(map_id,config,revision) VALUES(9,'{"schemaVersion":1,"mode":"compact","includedSubregionIds":[],"regionExtent":[103,1,104,2],"entries":[]}',1)`);
        await assert.rejects(pg.exec('UPDATE my_map_regional_discovery_documents SET revision=0'));
        await assert.rejects(pg.exec("UPDATE my_map_regional_discovery_documents SET config='[]'"));
        await assert.rejects(pg.exec(`UPDATE my_map_regional_discovery_documents SET config='{"schemaVersion":null,"mode":"compact","includedSubregionIds":[],"regionExtent":[103,1,104,2],"entries":[]}'`));
        await assert.rejects(pg.exec(`UPDATE my_map_regional_discovery_documents SET config='{"schemaVersion":1,"mode":null,"includedSubregionIds":[],"regionExtent":[103,1,104,2],"entries":[]}'`));
        await pg.exec('ALTER TABLE my_map_regional_discovery_documents ALTER COLUMN revision TYPE bigint');
        await assert.rejects(verifyRegionalDiscoverySchema(db));
        await pg.exec('ALTER TABLE my_map_regional_discovery_documents ALTER COLUMN revision TYPE integer');
        await assert.rejects(pg.exec("INSERT INTO subregion_enquiry_contact_fields(subregion_id,field,status,provenance,revision) VALUES(91001,'fax','approved','fictional',1)"));
        await assert.rejects(pg.exec("INSERT INTO regional_embed_email_grants(resource_type,resource_id,status,provenance,revision) VALUES('hard',101,'approved','fictional',1)"));
        // Historical positive actor identities deliberately outlive live accounts.
        for (const [table, identityColumns, identityValues, valueColumn, constraint] of [
            ['subregion_enquiry_contact_fields','subregion_id,field',"91001,'email'",'value','regional_contact_state_check'],
            ['regional_embed_email_grants','resource_type,resource_id',"'hard',101",'approved_original_email','regional_email_grant_state_check'],
        ]) {
            await pg.exec(`INSERT INTO ${table}(${identityColumns},status,${valueColumn},value_hash,provenance,revision,approved_by_user_id,approved_at)
                VALUES(${identityValues},'approved','fixture@example.invalid',repeat('a',64),'Fictional historical approval',1,91010,now())`);
            for (const actorId of [0,-7]) await assert.rejects(pg.exec(`UPDATE ${table} SET approved_by_user_id=${actorId}`),error => error.code === '23514' && error.constraint === constraint);
            await pg.exec(`UPDATE ${table} SET status='withdrawn',${valueColumn}=NULL,value_hash=NULL,withdrawn_by_user_id=91011,withdrawn_at=now(),withdrawal_reason='Fictional withdrawal'`);
            for (const actorId of [0,-7]) {
                await assert.rejects(pg.exec(`UPDATE ${table} SET withdrawn_by_user_id=${actorId}`),error => error.code === '23514' && error.constraint === constraint);
                await assert.rejects(pg.exec(`UPDATE ${table} SET approved_by_user_id=${actorId}`),error => error.code === '23514' && error.constraint === constraint);
            }
        }
        await pg.exec('ALTER TABLE regional_embed_email_grants DROP CONSTRAINT regional_email_grant_state_check');
        await assert.rejects(verifyRegionalDiscoverySchema(db));
        await pg.exec('ALTER TABLE subregion_enquiry_contact_fields DROP COLUMN provenance CASCADE');
        await assert.rejects(verifyRegionalDiscoverySchema(db));
        await pg.exec('DELETE FROM my_maps WHERE id=9');
        assert.equal((await pg.query('SELECT count(*)::int AS count FROM my_map_regional_discovery_documents')).rows[0].count, 0);
    } finally { await pg.close(); }
});
