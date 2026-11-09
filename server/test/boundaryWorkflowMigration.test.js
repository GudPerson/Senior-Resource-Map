import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoundaryPostgres } from './helpers/boundaryPostgres.js';

test('frozen job rows stage unique membership without publishing zones or library copies', async t => {
    const {pg}=await createBoundaryPostgres(t);
    const tables = (await pg.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(r=>r.tablename);
    for (const table of ['boundary_library_items','boundary_map_requests','boundary_zone_jobs','boundary_zone_job_rows','boundary_zone_staged_postals','boundary_zone_commit_requests']) {
        assert.ok(tables.includes(table),'missing '+table);
    }
    const hash='a'.repeat(64);
    const insertJob = () => pg.query(`INSERT INTO boundary_zone_jobs(owner_id,request_id,payload_hash,snapshot_sha256,manifest_sha256,manifest_identity)
        VALUES (11,'batch',$1,$1,$1,'{}') RETURNING id`,[hash]);
    const job=(await insertJob()).rows[0].id;
    await assert.rejects(insertJob(),{code:'23505'});
    await pg.query(`INSERT INTO boundary_zone_job_rows(job_id,row_key,position,name,zone_code,hard_asset_id,source,drawing,area,snapshot_sha256,point_count)
        VALUES ($1,'row',0,'North','MiXeD',21,'{}','{}','{}',$2,3)`,[job,hash]);
    const stage = () => pg.query("INSERT INTO boundary_zone_staged_postals(job_id,row_key,postal_code) VALUES($1,'row','001234')",[job]);
    await stage();
    await assert.rejects(pg.query("INSERT INTO boundary_zone_staged_postals(job_id,row_key,postal_code) VALUES($1,'row','A23456')",[job]),{code:'23514'});
    await assert.rejects(stage(),{code:'23505'});
    await assert.rejects(pg.query("INSERT INTO boundary_zone_staged_postals(job_id,row_key,postal_code) VALUES($1,'missing','009999')",[job]),{code:'23503'});
    await pg.query("UPDATE boundary_zone_jobs SET state='ready', revision=revision+1 WHERE id=$1",[job]);
    for(const table of ['boundary_library_items','audience_zones','boundary_zone_commit_requests']) {
        assert.equal((await pg.query('SELECT count(*)::int AS n FROM '+table)).rows[0].n,0);
    }
    const commit=(ownerId,key)=>pg.query(`INSERT INTO boundary_zone_commit_requests
        (owner_id,request_id,job_id,expected_revision,payload_hash,snapshot_sha256) VALUES ($1,$2,$3,2,$4,$4)`,
        [ownerId,key,job,hash]);
    await assert.rejects(commit(12,'commit'),{code:'23503'});
    await commit(11,'commit');
    await assert.rejects(commit(11,'commit'),{code:'23505'});
    await assert.rejects(commit(11,'other-commit'),{code:'23505'});
});
