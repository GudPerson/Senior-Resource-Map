import { isSpatialCoordinate } from '../../../shared/addressSnapshotSpatial.js';
import { canManageAudienceZone } from './audienceZones.js';
import { buildMyMapAssetSnapshot } from './myMapDirectory.js';
import { normalizeRole } from './roles.js';
import { assertBoundaryReplay, boundaryHash, BoundaryRequestError } from './boundaryRequests.js';

function unavailable() {
    return new BoundaryRequestError(404, 'BOUNDARY_ZONE_MAP_UNAVAILABLE', 'The original map is unavailable. Choose another map or start a new drawing.');
}

function outcome(row) {
    if (!row.map_id && !row.guidance_cancelled_at) throw unavailable();
    return { requestId: row.request_id, mapId: row.map_id, hardAssetId: row.hard_asset_id,
        name: row.name, state: 'ready', outcomeHash: row.outcome_hash, ...(row.guidance_cancelled_at ? { guidanceCancelled:true } : {}) };
}

export async function readManageableBoundaryPlace(query, actor, hardAssetId) {
    const [place] = await query(`SELECT id,name,lat,lng,address,postal_code AS "postalCode",
        sub_category AS "subCategory",subregion_id AS "subregionId",xmin::text AS version
        FROM hard_assets WHERE id = $1 AND is_deleted IS NOT TRUE`, [hardAssetId]);
    return assertManageableBoundaryPlace(actor, hardAssetId, place);
}

export function assertManageableBoundaryPlace(actor, hardAssetId, place) {
    if (!place) throw new BoundaryRequestError(404, 'BOUNDARY_PLACE_NOT_FOUND', 'Place not found.');
    if (!canManageAudienceZone(actor, { hardAssetId, hardAsset: place })) {
        throw new BoundaryRequestError(403, 'BOUNDARY_ZONE_ACCESS_REQUIRED', 'You need zone management access for this Place.');
    }
    return place;
}

export function createBoundaryWorkflowRepository(query) {
    async function find(ownerId, requestId) {
        const [row] = await query('SELECT * FROM boundary_map_requests WHERE owner_id = $1 AND request_id = $2',
            [ownerId, requestId]);
        return row;
    }

    async function replay(ownerId, requestId, hash) {
        const row = await find(ownerId, requestId);
        if (!row) return null;
        assertBoundaryReplay(row.payload_hash, hash);
        return outcome(row);
    }

    return {
        async get(ownerId, requestId) {
            const row = await find(ownerId, requestId);
            if (!row) throw new BoundaryRequestError(404, 'BOUNDARY_REQUEST_NOT_FOUND', 'No map was found for this drawing request.');
            return outcome(row);
        },
        async cancel(ownerId, requestId) {
            const [row] = await query(`UPDATE boundary_map_requests SET guidance_cancelled_at=now()
                WHERE owner_id=$1 AND request_id=$2 AND guidance_cancelled_at IS NULL RETURNING *`, [ownerId,requestId]);
            return row ? outcome(row) : this.get(ownerId,requestId);
        },
        async start(actor, { requestId, hardAssetId }) {
            const hash = await boundaryHash({ ownerId: actor.id, hardAssetId });
            const prior = await replay(actor.id, requestId, hash);
            if (prior) return prior;
            try {
                const place = await readManageableBoundaryPlace(query, actor, hardAssetId);
                const snapshot = buildMyMapAssetSnapshot('hard', place);
                const pin = snapshot.places[0];
                if (!isSpatialCoordinate([pin.lat, pin.lng])) throw new BoundaryRequestError(409,
                    'BOUNDARY_ZONE_PLACE_LOCATION_REQUIRED', 'Save a valid location in the Place editor before drawing.');
                // Recheck the same Place version, Saved row and live access at the write.
                // Only the winner of the unique request insert can feed the map and asset inserts.
                const [result] = await query(`WITH eligible AS (
                    SELECT p.id,p.name FROM hard_assets p JOIN user_favorites f
                    ON f.resource_id = p.id AND f.resource_type = 'hard' AND f.user_id = $1
                    JOIN users u ON u.id = $1 AND u.role::text = $7
                    WHERE p.id = $2 AND p.xmin::text = $5 AND p.is_deleted IS NOT TRUE AND (
                        u.role = 'super_admin' OR (u.role = 'regional_admin' AND EXISTS (
                            SELECT 1 FROM user_subregions s WHERE s.user_id = u.id AND s.subregion_id = p.subregion_id FOR SHARE))
                        OR (u.role NOT IN ('guest','regional_admin') AND EXISTS (
                            SELECT 1 FROM hard_asset_staff_memberships s WHERE s.user_id = u.id AND s.hard_asset_id = p.id
                            AND lower(trim(s.staff_role)) = 'owner' AND s.revoked_at IS NULL FOR SHARE)))
                    FOR SHARE OF p,f,u
                ), candidate AS MATERIALIZED (
                    SELECT nextval(pg_get_serial_sequence('my_maps','id'))::int AS map_id,id,name FROM eligible
                ), claim AS (
                    INSERT INTO boundary_map_requests(owner_id,request_id,payload_hash,map_id,hard_asset_id,name,outcome_hash)
                    SELECT $1::int,$3::text,$4,map_id,id,name,encode(sha256(convert_to(
                        jsonb_build_array($1::int,$3::text,map_id,id,name)::text,'UTF8')),'hex') FROM candidate
                    ON CONFLICT(owner_id,request_id) DO NOTHING RETURNING *
                ), map AS (
                    INSERT INTO my_maps(id,user_id,name) SELECT map_id,owner_id,name FROM claim RETURNING id
                ), asset AS (
                    INSERT INTO my_map_assets(map_id,resource_type,resource_id,snapshot)
                    SELECT map.id,'hard',claim.hard_asset_id,$6::jsonb FROM map JOIN claim ON claim.map_id=map.id RETURNING map_id
                ) SELECT claim.* FROM claim JOIN asset USING(map_id)`,
                [actor.id, hardAssetId, requestId, hash, place.version, JSON.stringify(snapshot), normalizeRole(actor.role)]);
                if (result) return outcome(result);
                // A losing INSERT may not see the winning tuple in its own statement snapshot.
                const winner = await replay(actor.id, requestId, hash);
                if (winner) return winner;
                const [favorite] = await query(`SELECT 1 FROM user_favorites
                    WHERE user_id = $1 AND resource_type = 'hard' AND resource_id = $2`, [actor.id, hardAssetId]);
                if (!favorite) throw new BoundaryRequestError(409, 'BOUNDARY_ZONE_PLACE_NOT_SAVED',
                    'Save this Place to your directory before drawing.');
                throw new BoundaryRequestError(409, 'BOUNDARY_ZONE_PLACE_CHANGED', 'Refresh the Place and retry this drawing request.');
            } catch (error) {
                if (error instanceof BoundaryRequestError) {
                    const winner = await replay(actor.id, requestId, hash);
                    if (winner) return winner;
                }
                throw error;
            }
        },
    };
}
