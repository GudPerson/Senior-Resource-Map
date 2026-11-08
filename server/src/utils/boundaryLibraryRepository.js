import { canonicalizeBoundaryDrawing, boundaryDrawingToArea, countBoundaryDrawingStoredPoints,
    BoundaryDrawingError } from '../../../shared/boundaryDrawing.js';
import { assertBoundaryReplay, boundaryHash, BoundaryRequestError } from './boundaryRequests.js';

const summaryColumns = 'id, revision, name, group_name, source_group_name, type, source_name, created_at, snapshot_sha256';
const missing = () => new BoundaryRequestError(404, 'BOUNDARY_NOT_FOUND', 'Boundary not found.');
const stale = () => new BoundaryRequestError(409, 'BOUNDARY_SOURCE_STALE', 'Refresh the saved map and select the boundary again.');

function summary(row) {
    return { id: row.id, revision: row.revision, name: row.name, groupName: row.group_name,
        sourceGroupName: row.source_group_name, type: row.type, sourceName: row.source_name,
        createdAt: row.created_at, snapshotSha256: row.snapshot_sha256 };
}

function detail(row) {
    return { ...summary(row), drawing: row.drawing, area: row.area, pointCount: row.point_count, source: row.source };
}

export async function readSavedBoundary(query, ownerId, source) {
    const rows = await query(`SELECT d.revision, a.annotation FROM my_maps m
        LEFT JOIN my_map_print_annotation_documents d ON d.map_id = m.id
        LEFT JOIN LATERAL (SELECT value AS annotation FROM jsonb_array_elements(d.annotations)
            WHERE value ->> 'id' = $3 AND d.revision = $4 LIMIT 2) a ON true
        WHERE m.user_id = $1 AND m.id = $2`, [ownerId, source.mapId, source.annotationId, source.revision]);
    if (!rows.length) throw missing();
    if (rows.length !== 1 || !rows[0].annotation || rows[0].revision !== source.revision) throw stale();
    return snapshotSavedBoundary(rows[0].annotation, source);
}

export async function snapshotSavedBoundary(annotation, source) {
    try {
        const drawing = canonicalizeBoundaryDrawing(annotation);
        const area = boundaryDrawingToArea(drawing);
        return { source, drawing, area, pointCount: countBoundaryDrawingStoredPoints(drawing),
            snapshotSha256: await boundaryHash({ drawing, area }) };
    } catch (error) {
        if (!(error instanceof BoundaryDrawingError)) throw error;
        throw new BoundaryRequestError(422, 'BOUNDARY_SOURCE_UNSUPPORTED', 'Select a supported, complete area drawing.');
    }
}

export function createBoundaryLibraryRepository(query) {
    async function replay(ownerId, requestId, hash) {
        const [row] = await query('SELECT * FROM boundary_library_items WHERE owner_id = $1 AND request_id = $2',
            [ownerId, requestId]);
        if (!row) return null;
        assertBoundaryReplay(row.payload_hash, hash);
        return { item: detail(row), replayed: true };
    }

    return {
        async save(ownerId, { requestId, name, groupName = null, source }) {
            const hash = await boundaryHash({ ownerId, name, groupName, source });
            const prior = await replay(ownerId, requestId, hash);
            if (prior) return prior;
            let snapshot;
            try {
                snapshot = await readSavedBoundary(query, ownerId, source);
            } catch (error) {
                // Another save may have committed before the source was edited/deleted.
                if (error instanceof BoundaryRequestError) {
                    const winner = await replay(ownerId, requestId, hash);
                    if (winner) return winner;
                }
                throw error;
            }
            const { drawing, area, pointCount, snapshotSha256 } = snapshot;
            const [row] = await query(`WITH saved AS (
                SELECT d.map_id FROM my_map_print_annotation_documents d JOIN my_maps m ON m.id = d.map_id
                WHERE m.user_id = $1 AND m.id = $2 AND d.revision = $3 FOR SHARE OF m,d
            ) INSERT INTO boundary_library_items
                (owner_id, request_id, payload_hash, name, group_name, source_name, source_group_name, type,
                 source, drawing, area, point_count, snapshot_sha256)
                SELECT $1,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15 FROM saved
                ON CONFLICT (owner_id,request_id) DO NOTHING RETURNING *`,
            [ownerId, source.mapId, source.revision, requestId, hash, name, groupName, drawing.name ?? null,
                drawing.groupName ?? null, drawing.type, JSON.stringify(source), JSON.stringify(drawing),
                JSON.stringify(area), pointCount, snapshotSha256]);
            if (row) return { item: detail(row), replayed: false };
            const winner = await replay(ownerId, requestId, hash);
            if (winner) return winner;
            throw stale();
        },
        async list(ownerId, { cursor = null, limit = 50, search = '', name = '', group = '' }) {
            // strpos treats wildcard characters literally and only projects small metadata columns.
            const rows = await query(`SELECT ${summaryColumns} FROM boundary_library_items
                WHERE owner_id = $1 AND retired_at IS NULL AND ($2::int IS NULL OR id < $2)
                AND ($3 = '' OR strpos(lower(concat_ws(' ',name,group_name,source_name,source_group_name)),lower($3)) > 0)
                AND ($4 = '' OR lower(name) = lower($4)) AND ($5 = '' OR lower(group_name) = lower($5))
                ORDER BY id DESC LIMIT $6`, [ownerId, cursor, search, name, group, limit + 1]);
            const items = rows.slice(0, limit).map(summary);
            return { items, nextCursor: rows.length > limit ? String(items[items.length - 1].id) : null };
        },
        async get(ownerId, id) {
            const [row] = await query('SELECT * FROM boundary_library_items WHERE owner_id = $1 AND id = $2 AND retired_at IS NULL',
                [ownerId, id]);
            if (!row) throw missing();
            return detail(row);
        },
        async retire(ownerId, id) {
            const [row] = await query(`UPDATE boundary_library_items SET retired_at = COALESCE(retired_at,now())
                WHERE owner_id = $1 AND id = $2 RETURNING id`, [ownerId, id]);
            if (!row) throw missing();
            return { id: row.id, retired: true };
        },
    };
}
