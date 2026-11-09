import { containsSpatialPoint, normalizeSpatialArea, spatialAreaBounds } from '../../../shared/addressSnapshotSpatial.js';
import { createAddressSnapshotReader, boundsIntersect, AddressSnapshotRepositoryError } from './addressSnapshotRepository.js';
import { ADDRESS_SNAPSHOT_CONFIG } from './addressSnapshotConfig.js';
import { BoundaryRequestError } from './boundaryRequests.js';
const changed = () => new BoundaryRequestError(409, 'BOUNDARY_SNAPSHOT_CHANGED', 'Address data changed. Start a new preparation.');
const excess = () => new BoundaryRequestError(422, 'BOUNDARY_STEP_BUDGET', 'The verified address tile cannot fit this step budget.');
const corrupt = () => new BoundaryRequestError(503, 'BOUNDARY_SNAPSHOT_UNAVAILABLE', 'Verified address data is unavailable. Retry later.');

export function createBoundaryPostalScanner(bucket, { config = ADDRESS_SNAPSHOT_CONFIG } = {}) {
    const reader = createAddressSnapshotReader(bucket, config);
    const limits = config.limits;

    async function manifest(identity, stats) {
        if (identity && (identity.sourceSha256 !== config.sourceSha256 || identity.manifestSha256 !== config.manifestSha256 ||
            identity.prefix !== config.prefix))
            throw changed();
        stats.expectedEtag = identity?.etag;
        let result;
        try {
            result = await reader.manifestForRequest(stats);
        }
        catch (e) {
            if (e.code === 'ADDRESS_SNAPSHOT_CHANGED')
                throw changed();
            throw e;
        }
        if (!stats.etag)
            throw corrupt();
        if (identity && stats.etag !== identity.etag)
            throw changed();
        return result;
    }

    async function pin(identity) {
        const stats = { bytes: 0, reads: 0 };
        try {
            await manifest(identity, stats);
        }
        catch (e) {
            if (e instanceof AddressSnapshotRepositoryError)
                throw corrupt();
            throw e;
        }
        return { sourceSha256: config.sourceSha256, manifestSha256: config.manifestSha256, prefix: config.prefix, etag: stats.etag };
    }
    // Each step verifies the complete bounded objects; only its row slice enters
    // containment. The manifest's signed row order makes (tile,row) deterministic.

    async function scanBoundaryPostalStep({ area, manifestIdentity, cursor = {}, budget = {}, signal }) {
        signal?.throwIfAborted();
        if (!manifestIdentity || !normalizeSpatialArea(area))
            throw corrupt();
        const byteLimit = Math.min(limits.maxReservedBytes, budget.bytes ?? limits.maxReservedBytes);
        const readLimit = Math.min(limits.maxR2Reads, budget.reads ?? limits.maxR2Reads);
        if (!Number.isSafeInteger(byteLimit) || byteLimit < config.manifestBytes || !Number.isSafeInteger(readLimit) || readLimit < 1)
            throw excess();
        const stats = { reads: 0, bytes: 0 };
        const m = await manifest(manifestIdentity, stats);
        let tileIndex = cursor.tile ?? 0, row = cursor.row ?? 0;
        const bounds = spatialAreaBounds(area), tiles = m.tiles.filter(tile => boundsIntersect(bounds, tile.bounds));
        const edges = area.type === 'circle' ? 1 : (area.type === 'Polygon' ? [area.coordinates] : area.coordinates)
            .reduce((sum, p) => sum + p.reduce((a, r) => a + r.length - 1, 0), 0);
        const geometry = Math.min(limits.maxGeometryWork, budget.geometryWork ?? limits.maxGeometryWork);
        const size = Math.min(512, limits.maxCandidateRows, budget.candidates ?? 512, Math.floor(geometry / edges));
        if (!Number.isSafeInteger(size) || size < 1)
            throw excess();
        if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex > tiles.length || !Number.isInteger(row) || row < 0)
            throw corrupt();
        const tile = tiles[tileIndex], codes = new Set();
        let candidates = 0;
        if (tile) {
            if (row >= tile.count)
                throw corrupt();
            if (readLimit < 3 || stats.bytes + tile.index.bytes + tile.rows.bytes > byteLimit)
                throw excess();
            const bytes = await reader.readObject(tile.index, 'application/octet-stream', stats);
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const rows = reader.json(await reader.readObject(tile.rows, 'application/json', stats));
            if (!Array.isArray(rows) || rows.length !== tile.count)
                throw corrupt();
            let previous = row ? view.getUint32((row - 1) * limits.indexRecordBytes + 16, true) : -1;
            const stop = Math.min(row + size, tile.count);
            for (; row < stop; row++) {
                signal?.throwIfAborted();
                const point = reader.indexPoint(view, tile, row, previous);
                previous = point.ordinal;
                reader.validateRow(rows[row]);
                candidates++;
                if (containsSpatialPoint(area, point))
                    codes.add(rows[row][1]);
            }
            if (row === tile.count) {
                tileIndex++;
                row = 0;
            }
        }
        return { cursor: { tile: tileIndex, row }, done: tileIndex === tiles.length, postalCodes: [...codes],
            diagnostics: { reads: stats.reads, bytes: stats.bytes, candidates, geometryWork: candidates * edges } };
    }
    return { pin, scanBoundaryPostalStep };
}
