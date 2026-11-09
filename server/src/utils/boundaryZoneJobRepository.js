// All multi-table changes are a single parameterized PostgreSQL statement.
// There is no queue or long-lived database connection between client advances.
import { boundaryHash, assertBoundaryReplay, BoundaryRequestError } from './boundaryRequests.js';
import { snapshotSavedBoundary } from './boundaryLibraryRepository.js';
import { assertManageableBoundaryPlace } from './boundaryWorkflowRepository.js';
export const FREEZE_LIMITS = Object.freeze({ bodyBytes: 65536, storedPoints: 20000, projectionUnits: 100000, sourceBytes: 2 * 1024 * 1024, physicalBytes: 4 * 1024 * 1024, mapDocuments: 4, rows: 256 });
const error = (status, code, message) => new BoundaryRequestError(status, code, message);
const budgetError = () => error(413, 'BOUNDARY_FREEZE_BUDGET', 'Select fewer boundaries in this preparation.');
const denied = () => error(403, 'BOUNDARY_ZONE_ACCESS_REQUIRED', 'Zone management access is required for every assigned Place.');
const stale = () => error(409, 'BOUNDARY_SOURCE_STALE', 'Refresh your saved boundaries and select the current revision.');
const conflict = () => error(409, 'BOUNDARY_JOB_CONFLICT', 'Refresh the job to see its current progress.');
const codeConflict = () => error(409, 'BOUNDARY_ZONE_CODE_CONFLICT', 'A selected zone code is already in use.');
const missing = () => error(404, 'BOUNDARY_JOB_NOT_FOUND', 'Job not found.');
const revFree = "(lease_until IS NULL OR lease_until <= now())";
const json = JSON.stringify;
const dtoColumns = 'row_key,name,zone_code,hard_asset_id,state,postal_count,zone_id,library_item_id,error_code';
const responseRow = r => ({ rowKey: r.row_key, name: r.name, zoneCode: r.zone_code, hardAssetId: r.hard_asset_id, status: r.state,
    postalCount: r.postal_count, zoneId: r.zone_id, libraryId: r.library_item_id, errorCode: r.error_code });
// Require all selected Places, locking each actual authority row as well as the user and Place.
// The same predicate gates initial publication, acquiring work, and each materialization.
const allowedPlaces = `SELECT p.id FROM hard_assets p JOIN users u ON u.id=$1
    WHERE p.id IN (SELECT id FROM places) AND p.is_deleted IS NOT TRUE AND (
    u.role='super_admin' OR (u.role='regional_admin' AND EXISTS (SELECT 1 FROM user_subregions s
    WHERE s.user_id=u.id AND s.subregion_id=p.subregion_id FOR SHARE))
    OR (u.role NOT IN ('guest','regional_admin') AND EXISTS (SELECT 1 FROM hard_asset_staff_memberships s
    WHERE s.user_id=u.id AND s.hard_asset_id=p.id AND lower(trim(s.staff_role))='owner' AND s.revoked_at IS NULL FOR SHARE)))
    FOR SHARE OF p,u`;
const authGate = 'NOT EXISTS (SELECT id FROM places EXCEPT SELECT id FROM allowed)';
const jobPlaces = `places AS (SELECT DISTINCT hard_asset_id AS id FROM boundary_zone_job_rows WHERE job_id=$2),
    allowed AS MATERIALIZED (${allowedPlaces})`;
// Measure stored values without expanding or rendering JSON. Fence the following
// geometry query to these exact row versions, including for retired library items.
async function measurePhysicalSources(query, owner, unique) {
    const mapIds = [...new Set(unique.filter(entry => entry.source.mapId).map(entry => entry.source.mapId))];
    const libraryIds = [...new Set(unique.filter(entry => entry.source.libraryId).map(entry => entry.source.libraryId))];
    if (mapIds.length > FREEZE_LIMITS.mapDocuments) throw budgetError();
    const physical = await query(`SELECT 'map' AS kind, d.map_id AS id, d.revision, d.xmin::text AS version,
            pg_column_size(d.annotations) AS bytes
        FROM my_map_print_annotation_documents d JOIN my_maps m ON m.id=d.map_id
        WHERE m.user_id=$1 AND d.map_id=ANY($2::int[])
        UNION ALL SELECT 'library', l.id, l.revision, l.xmin::text, pg_column_size(l.drawing)+pg_column_size(l.area)+pg_column_size(l.name)
        FROM boundary_library_items l WHERE l.owner_id=$1 AND l.id=ANY($3::int[]) AND l.retired_at IS NULL`,
    [owner, mapIds, libraryIds]);
    const byId = new Map(physical.map(record => [record.kind + record.id, record]));
    for (const entry of unique) {
        const source = entry.source;
        const identity = source.mapId ? 'map' + source.mapId : 'library' + source.libraryId;
        const record = byId.get(identity);
        if (!record || source.revision !== record.revision) throw stale();
        entry.version = record.version;
    }
    if (physical.reduce((total, record) => total + record.bytes, 0) > FREEZE_LIMITS.physicalBytes) throw budgetError();
}

async function resolveSources(query, actor, rows) {
    const bySource = new Map();
    const rowSources = rows.map(({ source }) => {
        const key = source.mapId ? `map:${source.mapId}:${source.revision}:${source.annotationId}`
            : `library:${source.libraryId}:${source.revision}`;
        if (!bySource.has(key)) bySource.set(key, { position: bySource.size, source, uses: 0 });
        const entry = bySource.get(key);
        entry.uses++;
        return entry;
    });
    const unique = [...bySource.values()];
    await measurePhysicalSources(query, actor.id, unique);

    // Expand each admitted map once. Size each distinct selected value once and
    // multiply by its number of assignment rows before sending any geometry.
    const records = await query(`WITH input AS MATERIALIZED (
            SELECT * FROM jsonb_to_recordset($2::jsonb) i(position int,source jsonb,version text,uses int)
        ), maps AS MATERIALIZED (
            SELECT d.map_id,d.annotations FROM my_map_print_annotation_documents d JOIN my_maps m ON m.id=d.map_id
            WHERE m.user_id=$1 AND EXISTS (SELECT 1 FROM input i WHERE (i.source->>'mapId')::int=d.map_id
                AND (i.source->>'revision')::int=d.revision AND i.version=d.xmin::text)
        ), annotations AS MATERIALIZED (
            SELECT map_id,a->>'id' AS annotation_id,a FROM maps CROSS JOIN LATERAL jsonb_array_elements(annotations) a
        ), matches AS MATERIALIZED (
            SELECT i.position,i.uses,a.a,l.id AS library_id,l.name AS display_name,l.source AS origin,l.drawing,l.area,l.point_count,l.snapshot_sha256
            FROM input i LEFT JOIN annotations a ON a.map_id=(i.source->>'mapId')::int AND a.annotation_id=i.source->>'annotationId'
            LEFT JOIN boundary_library_items l ON l.owner_id=$1 AND l.id=(i.source->>'libraryId')::int
                AND l.revision=(i.source->>'revision')::int AND l.xmin::text=i.version AND l.retired_at IS NULL
        ), sizes AS MATERIALIZED (
            SELECT uses, a IS NOT NULL OR library_id IS NOT NULL AS valid, a->>'type' AS type, a->>'boundarySource' AS kind,
                COALESCE(point_count,
                    CASE WHEN jsonb_typeof(a->'points')='array' THEN jsonb_array_length(a->'points') ELSE 0 END +
                    CASE WHEN jsonb_typeof(a->'controlPoints')='array' THEN jsonb_array_length(a->'controlPoints') ELSE 0 END) AS points,
                COALESCE(octet_length(a::text),octet_length(drawing::text)+octet_length(area::text)+octet_length(display_name)) AS bytes
            FROM matches
        ), admission AS (
            SELECT count(*)=$3 AND bool_and(valid) AS valid, sum(uses::bigint*points)<=$4 AND
                sum(uses::bigint*bytes)<=$5 AND sum(uses::bigint*5*CASE WHEN type='polygon' AND kind IS DISTINCT FROM 'kml'
                THEN least(500,points*10) ELSE greatest(4,points) END)<=$6 AS fits FROM sizes
        )
        SELECT valid,fits,m.position,m.a AS annotation,m.display_name,m.origin,m.drawing,m.area,m.point_count,m.snapshot_sha256
        FROM admission LEFT JOIN matches m ON valid AND fits ORDER BY m.position`,
    [actor.id, json(unique), unique.length, FREEZE_LIMITS.storedPoints, FREEZE_LIMITS.sourceBytes, FREEZE_LIMITS.projectionUnits]);
    if (!records[0]?.valid) throw stale();
    if (!records[0].fits) throw budgetError();
    for (const record of records) {
        const entry = unique[record.position];
        entry.snapshot = record.annotation ? await snapshotSavedBoundary(record.annotation, entry.source)
            : { drawing: record.drawing, area: record.area, pointCount: record.point_count, snapshotSha256: record.snapshot_sha256 };
        entry.reference = record.origin ? { ...entry.source, origin: record.origin, displayName: record.display_name } : entry.source;
    }
    return rows.map((row, position) => {
        const { snapshot, reference, version } = rowSources[position];
        return { ...row, ...snapshot, position, source: reference, sourceVersion: version };
    });
}

export function createBoundaryZoneJobRepository(query, scanner) {

    async function get(owner, id) {
        // A single snapshot also prevents mixed revision/row outcomes during concurrent status reads.
        const [j] = await query(`SELECT j.id,j.revision,j.state,j.snapshot_sha256,j.manifest_sha256,
            (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.position) FROM (SELECT position,${dtoColumns} FROM boundary_zone_job_rows WHERE job_id=j.id) r) AS rows
            FROM boundary_zone_jobs j WHERE j.owner_id=$1 AND j.id=$2`, [owner, id]);
        if (!j)
            throw missing();
        return { id: j.id, revision: j.revision, state: j.state, snapshotSha256: j.snapshot_sha256, manifestSha256: j.manifest_sha256, rows: j.rows.map(responseRow) };
    }

    async function frozenSource(owner, id, rowKey) {
        const [r] = await query(`SELECT row_key AS "rowKey",source,drawing,area,point_count AS "pointCount",r.snapshot_sha256 AS "snapshotSha256",
            save_to_library AS "saveToLibrary",library_name AS "libraryName",library_group_name AS "libraryGroupName"
            FROM boundary_zone_job_rows r JOIN boundary_zone_jobs j ON j.id=r.job_id
            WHERE j.owner_id=$1 AND j.id=$2 AND r.row_key=$3`, [owner, id, rowKey]);
        if (!r)
            throw missing();
        return r;
    }

    async function findPrior(actor, requestId, hash) {
        const [prior] = await query('SELECT id,payload_hash FROM boundary_zone_jobs WHERE owner_id=$1 AND request_id=$2', [actor.id, requestId]);
        if (!prior)
            return null;
        assertBoundaryReplay(prior.payload_hash, hash);
        return get(actor.id, prior.id);
    }

    async function checkPlaces(actor, ids) {
        const places = await query(`SELECT id,subregion_id AS "subregionId" FROM hard_assets WHERE id=ANY($1::int[]) AND is_deleted IS NOT TRUE`, [ids]);
        if (places.length !== ids.length)
            throw denied();
        for (const place of places)
            assertManageableBoundaryPlace(actor, place.id, place);
    }

    async function start(actor, { requestId, rows }) {
        if (!rows.length || rows.length > FREEZE_LIMITS.rows)
            throw budgetError();
        const hash = await boundaryHash({ owner: actor.id, rows });
        // An accepted request is an owner-only historical read, including after Place revocation.
        // Return before source resolution, scanner activity, maintenance or any database mutation.
        const prior = await findPrior(actor, requestId, hash);
        if (prior)
            return prior;
        const ids = [...new Set(rows.map(r => r.hardAssetId))], codes = rows.map(r => r.zoneCode).filter(Boolean);
        if (new Set(rows.map(r => r.rowKey)).size !== rows.length)
            throw error(400, 'BOUNDARY_DUPLICATE_ROW', 'Each row must have a distinct key.');
        if (new Set(codes).size !== codes.length)
            throw codeConflict();
        await checkPlaces(actor, ids);
        if (codes.length && (await query('SELECT 1 FROM audience_zones WHERE zone_code=ANY($1::text[]) LIMIT 1', [codes])).length)
            throw codeConflict();
        const frozen = await resolveSources(query, actor, rows), pin = await scanner.pin();
        const snapshot = await boundaryHash({ hash, pin, rows: frozen.map(r => ({ source:r.source, snapshotSha256:r.snapshotSha256 })) });
        const [out] = await query(`WITH input AS MATERIALIZED (SELECT v FROM jsonb_array_elements($2::jsonb) v),
          places AS (SELECT DISTINCT (v->>'hardAssetId')::int AS id FROM input),allowed AS MATERIALIZED (${allowedPlaces}),
          maps AS MATERIALIZED (SELECT m.id,d.revision,d.xmin::text AS version FROM my_maps m JOIN my_map_print_annotation_documents d ON d.map_id=m.id
            WHERE m.user_id=$1 AND m.id IN (SELECT (v->'source'->>'mapId')::int FROM input) FOR SHARE OF m,d),
          libs AS MATERIALIZED (SELECT id,revision,snapshot_sha256,xmin::text AS version FROM boundary_library_items WHERE owner_id=$1 AND retired_at IS NULL
            AND id IN (SELECT (v->'source'->>'libraryId')::int FROM input) FOR SHARE),
          job AS (INSERT INTO boundary_zone_jobs(owner_id,request_id,payload_hash,snapshot_sha256,manifest_sha256,manifest_identity)
            SELECT $1::int,$3,$4,$5,$6,$7::jsonb WHERE ${authGate} AND NOT EXISTS (SELECT 1 FROM input WHERE
            NOT EXISTS (SELECT 1 FROM maps WHERE id=(v->'source'->>'mapId')::int AND revision=(v->'source'->>'revision')::int AND version=v->>'sourceVersion')
            AND NOT EXISTS (SELECT 1 FROM libs WHERE id=(v->'source'->>'libraryId')::int AND revision=(v->'source'->>'revision')::int AND version=v->>'sourceVersion' AND snapshot_sha256=v->>'snapshotSha256'))
            ON CONFLICT(owner_id,request_id) DO NOTHING RETURNING id),
          saved AS (INSERT INTO boundary_zone_job_rows(job_id,row_key,position,hard_asset_id,name,zone_code,source,drawing,area,
            snapshot_sha256,point_count,save_to_library,library_name,library_group_name,state)
            SELECT id,v->>'rowKey',(v->>'position')::int,(v->>'hardAssetId')::int,v->>'name',v->>'zoneCode',v->'source',v->'drawing',v->'area',
            v->>'snapshotSha256',(v->>'pointCount')::int,(v->>'saveToLibrary')::boolean,v->>'libraryName',v->>'libraryGroupName','pending' FROM job,input RETURNING job_id)
          SELECT DISTINCT job_id FROM saved`, [actor.id, json(frozen), requestId, hash, snapshot, pin.manifestSha256, json(pin)]);
        if (!out) {
            const replay = await findPrior(actor, requestId, hash);
            if (replay)
                return replay;
            throw stale();
        }
        await maintain(actor.id, out.job_id);
        return get(actor.id, out.job_id);
    }

    async function list(owner, { cursor = null, limit = 50 }) {
        const summaries = await query(`SELECT j.id,j.revision,j.state,j.created_at AS "createdAt",j.updated_at AS "updatedAt",
          (SELECT count(*)::int FROM boundary_zone_job_rows WHERE job_id=j.id) AS "rowCount",
          (SELECT count(*)::int FROM boundary_zone_job_rows WHERE job_id=j.id AND state='created') AS "createdCount"
          FROM boundary_zone_jobs j WHERE owner_id=$1 AND ($2::int IS NULL OR id<$2) ORDER BY id DESC LIMIT $3`, [owner, cursor, limit + 1]);
        const items = summaries.slice(0, limit);
        return { items, nextCursor: summaries.length > limit ? String(items.at(-1).id) : null };
    }
    // Keep durable identity/outcome tombstones. Only staging loses its value after
    // a terminal outcome; LIMIT applies to postal records rather than job count.

    async function maintain(owner, currentId) {
        await query(`WITH idle AS MATERIALIZED (SELECT id FROM boundary_zone_jobs WHERE owner_id=$1 AND id<>$2
              AND updated_at<now()-interval '30 days' AND state IN ('ready','paused','preparing','committing') AND ${revFree}
              ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED),
            expired AS (UPDATE boundary_zone_jobs SET state='cancelled',resume_state=NULL,lease_id=NULL,lease_until=NULL,
              revision=revision+1,updated_at=now() FROM idle WHERE boundary_zone_jobs.id=idle.id RETURNING idle.id),
            eligible AS (SELECT id FROM boundary_zone_jobs WHERE owner_id=$1 AND id<>$2 AND state IN ('complete','failed','cancelled')
              AND updated_at<now()-interval '7 days' UNION ALL SELECT id FROM expired),
            one_job AS (SELECT id FROM eligible WHERE EXISTS(SELECT 1 FROM boundary_zone_staged_postals WHERE job_id=eligible.id) ORDER BY id LIMIT 1),
            purge AS (SELECT s.job_id,s.row_key,s.postal_code FROM boundary_zone_staged_postals s JOIN one_job e ON e.id=s.job_id
              ORDER BY s.job_id,s.row_key,s.postal_code LIMIT 256)
            DELETE FROM boundary_zone_staged_postals s USING purge p WHERE
              (s.job_id,s.row_key,s.postal_code)=(p.job_id,p.row_key,p.postal_code)`, [owner, currentId]);
    }

    async function failChanged(params, phase) {
        const [failed] = await query(`WITH ${jobPlaces}, failed AS (
            UPDATE boundary_zone_jobs SET state='failed',revision=revision+1,updated_at=now(),lease_id=NULL,lease_until=NULL
            WHERE owner_id=$1 AND id=$2 AND revision=$3 AND state=$5 AND ${authGate}
              AND (($5='ready' AND $4::text IS NULL AND lease_id IS NULL AND lease_until IS NULL)
                OR ($5 IN ('preparing','committing') AND lease_id=$4 AND lease_until>now()))
            RETURNING id
        ), failed_rows AS (
            UPDATE boundary_zone_job_rows SET state='failed',error_code='BOUNDARY_SNAPSHOT_CHANGED'
            WHERE job_id IN (SELECT id FROM failed) AND state IN ('pending','preparing','ready')
        ) SELECT id FROM failed`, [...params, phase]);
        if (!failed) throw conflict();
    }

    async function current(actor, id, revision) {
        const [j] = await query('SELECT * FROM boundary_zone_jobs WHERE id=$2 AND owner_id=$1', [actor.id, id]);
        if (!j)
            throw missing();
        if (j.revision !== revision)
            throw conflict();
        return j;
    }

    async function checkJobPlaces(actor, id) {
        const places = await query('SELECT DISTINCT hard_asset_id FROM boundary_zone_job_rows WHERE job_id=$1', [id]);
        await checkPlaces(actor, places.map(p => p.hard_asset_id));
    }

    async function control(actor, id, action, revision) {
        const j = await current(actor, id, revision);
        const permitted = { pause: ['preparing', 'committing', 'ready'], resume: ['paused'], cancel: ['preparing', 'ready', 'committing', 'paused'] };
        if (!permitted[action]?.includes(j.state))
            throw conflict();
        if (action === 'resume')
            await checkJobPlaces(actor, id);
        const state = { pause: 'paused', resume: j.resume_state, cancel: 'cancelled' }[action];
        const [ok] = await query(`WITH ${jobPlaces} UPDATE boundary_zone_jobs SET state=$4,resume_state=$5,revision=revision+1,
            lease_id=NULL,lease_until=NULL,updated_at=now() WHERE owner_id=$1 AND id=$2 AND revision=$3
            AND ($6::boolean=false OR ${authGate}) RETURNING id`, [actor.id, id, revision, state, action === 'pause' ? j.state : null, action === 'resume']);
        if (!ok)
            throw conflict();
        return get(actor.id, id);
    }

    async function commit(actor, id, { requestId, expectedRevision }) {
        const [j] = await query('SELECT * FROM boundary_zone_jobs WHERE owner_id=$1 AND id=$2', [actor.id, id]);
        if (!j)
            throw missing();
        const hash = await boundaryHash({ id, expectedRevision, snapshot: j.snapshot_sha256, selection: j.payload_hash });
        async function replay() {
            const [prior] = await query('SELECT payload_hash FROM boundary_zone_commit_requests WHERE owner_id=$1 AND request_id=$2', [actor.id, requestId]);
            if (!prior)
                return null;
            assertBoundaryReplay(prior.payload_hash, hash);
            return get(actor.id, id);
        }
        // The accepted intent can be reconciled after revocation. Only a new intent reaches the authority gate.
        const prior = await replay();
        if (prior)
            return prior;
        if (j.state !== 'ready' || j.revision !== expectedRevision)
            throw conflict();
        await checkJobPlaces(actor, id);
        try {
            await scanner.pin(j.manifest_identity);
        }
        catch (e) {
            if (e.code === 'BOUNDARY_SNAPSHOT_CHANGED')
                await failChanged([actor.id, id, expectedRevision, null], 'ready');
            throw e;
        }
        const [ok] = await query(`WITH ${jobPlaces}, selected AS MATERIALIZED (SELECT * FROM boundary_zone_jobs WHERE owner_id=$1 AND
            id=$2 AND revision=$3 AND state='ready' AND ${authGate} FOR UPDATE),
            claim AS (INSERT INTO boundary_zone_commit_requests(owner_id,request_id,job_id,expected_revision,payload_hash,snapshot_sha256)
            SELECT owner_id,$4,id,revision,$5,snapshot_sha256 FROM selected ON CONFLICT DO NOTHING RETURNING job_id)
            UPDATE boundary_zone_jobs SET state=CASE WHEN EXISTS (SELECT 1 FROM boundary_zone_job_rows WHERE job_id=$2 AND state='ready')
            THEN 'committing' ELSE 'complete' END,revision=revision+1,updated_at=now() FROM claim WHERE id=job_id RETURNING id`, [actor.id, id, expectedRevision, requestId, hash]);
        if (!ok) {
            const accepted = await replay();
            if (accepted)
                return accepted;
            throw conflict();
        }
        return get(actor.id, id);
    }
    const activeLease = `SELECT j.id,j.state AS phase FROM boundary_zone_jobs j WHERE j.owner_id=$1 AND j.id=$2 AND j.revision=$3
        AND j.lease_id=$4 AND j.lease_until>now() AND ${authGate} FOR UPDATE OF j`;

    async function stage(params, step) {
        const [ok] = await query(`WITH ${jobPlaces},locked AS MATERIALIZED (${activeLease}),
            target AS MATERIALIZED (SELECT r.* FROM boundary_zone_job_rows r JOIN locked j ON j.id=r.job_id
              WHERE phase='preparing' AND r.row_key=$5 AND r.state IN ('pending','preparing') FOR UPDATE OF r),
            added AS (INSERT INTO boundary_zone_staged_postals(job_id,row_key,postal_code)
              SELECT job_id,row_key,code FROM target CROSS JOIN unnest($6::text[]) code
              ON CONFLICT DO NOTHING RETURNING 1),
            progress AS (UPDATE boundary_zone_job_rows r SET cursor=$7::jsonb,postal_count=t.postal_count+(SELECT count(*) FROM added),
              state=CASE WHEN NOT $8::boolean THEN 'preparing' WHEN t.postal_count+(SELECT count(*) FROM added)>0 THEN 'ready' ELSE 'empty' END
              FROM target t WHERE r.job_id=t.job_id AND r.row_key=t.row_key RETURNING r.job_id,r.row_key,r.state)
            UPDATE boundary_zone_jobs j SET revision=revision+1,updated_at=now(),lease_id=NULL,lease_until=NULL,
              state=CASE WHEN p.state IN ('ready','empty') AND NOT EXISTS (SELECT 1 FROM boundary_zone_job_rows other WHERE
                other.job_id=p.job_id AND other.row_key<>p.row_key AND other.state IN ('pending','preparing')) THEN 'ready' ELSE 'preparing' END
              FROM progress p WHERE j.id=p.job_id RETURNING id`, [...params, step.postalCodes, json(step.cursor), step.done]);
        if (!ok)
            throw conflict();
    }

    async function materialize(params) {
        const [ok] = await query(`WITH ${jobPlaces},locked AS MATERIALIZED (${activeLease}),
          target AS MATERIALIZED (SELECT r.* FROM boundary_zone_job_rows r JOIN locked j ON j.id=r.job_id
            WHERE phase='committing' AND r.row_key=$5 AND r.state='ready' AND r.zone_id IS NULL AND EXISTS
            (SELECT 1 FROM boundary_zone_commit_requests WHERE owner_id=$1 AND job_id=j.id) FOR UPDATE OF r),
          codes AS MATERIALIZED (SELECT s.postal_code FROM boundary_zone_staged_postals s JOIN target t USING(job_id,row_key)),
          eligible AS (SELECT * FROM target WHERE postal_count>0 AND postal_count=(SELECT count(*) FROM codes)),
          zone AS (INSERT INTO audience_zones(name,zone_code,hard_asset_id,created_by_user_id,sharing_status)
            SELECT name,zone_code,hard_asset_id,$1,'local' FROM eligible ON CONFLICT(zone_code) DO NOTHING RETURNING id),
          members AS (INSERT INTO audience_zone_postal_codes(audience_zone_id,postal_code)
            SELECT id,postal_code FROM zone,codes RETURNING audience_zone_id),
          library AS (INSERT INTO boundary_library_items(owner_id,request_id,payload_hash,name,group_name,source_name,source_group_name,
            type,source,drawing,area,point_count,snapshot_sha256)
            SELECT $1,'job:'||job_id||':'||position,t.snapshot_sha256,COALESCE(library_name,name),library_group_name,
            drawing->>'name',drawing->>'groupName',drawing->>'type',source,drawing,area,point_count,t.snapshot_sha256
            FROM target t,zone WHERE save_to_library AND NOT (source ? 'libraryId') RETURNING id),
          outcome AS (UPDATE boundary_zone_job_rows r SET zone_id=(SELECT id FROM zone),library_item_id=(SELECT id FROM library),
            state=CASE WHEN EXISTS(SELECT 1 FROM members) THEN 'created' ELSE 'failed' END,
            error_code=CASE WHEN NOT EXISTS(SELECT 1 FROM eligible) THEN 'BOUNDARY_STAGING_INCOMPLETE'
            WHEN NOT EXISTS(SELECT 1 FROM zone) THEN 'BOUNDARY_ZONE_CODE_CONFLICT' ELSE NULL END
            FROM target t WHERE r.job_id=t.job_id AND r.row_key=t.row_key RETURNING r.job_id,r.row_key)
          UPDATE boundary_zone_jobs j SET revision=revision+1,lease_id=NULL,lease_until=NULL,updated_at=now(),
            state=CASE WHEN EXISTS (SELECT 1 FROM boundary_zone_job_rows r WHERE r.job_id=o.job_id AND r.row_key<>o.row_key AND r.state='ready')
            THEN 'committing' ELSE 'complete' END FROM outcome o WHERE j.id=o.job_id RETURNING id`, params);
        if (!ok)
            throw conflict();
    }

    async function advance(actor, id, revision, signal) {
        const j = await current(actor, id, revision);
        if (!['preparing', 'committing'].includes(j.state))
            throw conflict();
        await checkJobPlaces(actor, id);
        const lease = crypto.randomUUID();
        const params = [actor.id, id, revision, lease];
        const [row] = await query(`WITH ${jobPlaces},claim AS (UPDATE boundary_zone_jobs SET lease_id=$4,lease_until=now()+interval '60 seconds'
            WHERE owner_id=$1 AND id=$2 AND revision=$3 AND ${revFree} AND state IN ('preparing','committing') AND ${authGate}
            RETURNING id,state)
            SELECT r.row_key,r.area,r.cursor FROM claim CROSS JOIN LATERAL (SELECT row_key,area,cursor FROM boundary_zone_job_rows
              WHERE job_id=claim.id AND ((claim.state='preparing' AND state IN ('pending','preparing')) OR (claim.state='committing' AND state='ready'))
              ORDER BY position LIMIT 1) r`, params);
        if (!row)
            throw conflict();
        try {
            if (j.state === 'preparing') {
                const step = await scanner.scanBoundaryPostalStep({ area: row.area, manifestIdentity: j.manifest_identity, cursor: row.cursor, signal });
                await stage([...params, row.row_key], step);
            }
            else {
                await scanner.pin(j.manifest_identity);
                await materialize([...params, row.row_key]);
            }
        }
        catch (e) {
            // Fence by both token and revision: a late worker never clears a successor's lease.
            if (e.code === 'BOUNDARY_SNAPSHOT_CHANGED') {
                await failChanged(params, j.state);
            }
            else {
                await query('UPDATE boundary_zone_jobs SET lease_id=NULL,lease_until=NULL WHERE owner_id=$1 AND id=$2 AND revision=$3 AND lease_id=$4', params);
            }
            throw e;
        }
        return get(actor.id, id);
    }
    return { get, frozenSource, start, list, control, advance, commit };
}
