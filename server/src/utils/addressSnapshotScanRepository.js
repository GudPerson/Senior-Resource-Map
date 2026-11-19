import { containsSpatialPoint, normalizeSpatialArea, spatialAreaBounds } from '../../../shared/addressSnapshotSpatial.js';
import {
    ADDRESS_SNAPSHOT_SCAN_CAPS as caps,
    isAddressSnapshotScanEtag,
    isAddressSnapshotScanRequest,
    isAddressSnapshotScanSnapshot,
} from '../../../shared/addressSnapshotScanContract.js';
import { ADDRESS_SNAPSHOT_CONFIG } from './addressSnapshotConfig.js';
import { AddressSnapshotRepositoryError, boundsIntersect, createAddressSnapshotReader } from './addressSnapshotRepository.js';

const invalid = () => new AddressSnapshotRepositoryError('Check the selected area and search position.', 400, 'ADDRESS_SNAPSHOT_INVALID_QUERY');
const changed = () => new AddressSnapshotRepositoryError('Address data changed. Restart the search before continuing.', 409, 'ADDRESS_SNAPSHOT_CHANGED');
const unavailable = () => new AddressSnapshotRepositoryError('Verified address data is unavailable. Try again later.');
const oversized = (reason, observed, allowed) => new AddressSnapshotRepositoryError(
    'The address data cannot fit this search step.', 422, 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE', { reason, observed, allowed },
);

const utf8 = new TextEncoder();
const rowArrayLimit = caps.maxResponseBytes - caps.responseEnvelopeReserveBytes;

function normalizeQuery(input, config) {
    if (!isAddressSnapshotScanRequest(input)) throw invalid();
    const { cursor, snapshotSha256 } = input;
    if (snapshotSha256 !== config.sourceSha256
        || (cursor && (cursor.snapshotSha256 !== snapshotSha256 || cursor.manifestSha256 !== config.manifestSha256))) throw changed();
    const normalized = normalizeSpatialArea(input.area);
    if (!normalized) throw invalid();
    // Polygon normalization retains the input arrays. Own the exact geometry across async reads.
    const area = structuredClone(normalized);
    const polygons = area.type === 'Polygon' ? [area.coordinates] : area.coordinates;
    const edges = area.type === 'circle' ? 1 : polygons.reduce(
        (sum, polygon) => sum + polygon.reduce((size, ring) => size + ring.length - 1, 0), 0,
    );
    if (edges > config.limits.maxGeometryPoints) throw invalid();
    return { area, edges };
}

async function areaHash(area) {
    const digest = await crypto.subtle.digest('SHA-256', utf8.encode(JSON.stringify(area)));
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export function createAddressSnapshotScanRepository(bucket, { config = ADDRESS_SNAPSHOT_CONFIG } = {}) {
    const limits = {
        ...config.limits,
        maxAreaTiles: Math.min(config.limits.maxAreaTiles, caps.maxTiles),
        maxR2Reads: Math.min(config.limits.maxR2Reads, caps.maxReads),
        maxReservedBytes: Math.min(config.limits.maxReservedBytes, caps.maxBytes),
        maxConcurrentReads: Math.min(config.limits.maxConcurrentReads, caps.maxConcurrentReads),
        maxCandidateRows: Math.min(config.limits.maxCandidateRows, caps.maxCandidates),
        maxGeometryWork: Math.min(config.limits.maxGeometryWork, caps.maxGeometryWork),
    };
    const reader = createAddressSnapshotReader(bucket, { ...config, limits });

    async function readTile(tile, stats, signal) {
        const read = async (descriptor, contentType) => {
            signal?.throwIfAborted();
            return reader.readObject(descriptor, contentType, stats);
        };
        if (limits.maxConcurrentReads === 1) {
            const index = await read(tile.index, 'application/octet-stream');
            return [index, await read(tile.rows, 'application/json')];
        }
        // Reserve both descriptors before starting either read. Drain both if one rejects.
        const settled = await Promise.allSettled([
            read(tile.index, 'application/octet-stream'),
            read(tile.rows, 'application/json'),
        ]);
        const failure = settled.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
        return settled.map(result => result.value);
    }

    async function execute(input, signal) {
        const { area, edges } = normalizeQuery(input, config);
        const cursor = input.cursor && { ...input.cursor };
        const { snapshotSha256 } = input;
        const areaSha256 = await areaHash(area);
        signal?.throwIfAborted();
        if (cursor && cursor.areaSha256 !== areaSha256) throw invalid();

        if (limits.maxConcurrentReads < 1 || limits.maxR2Reads < 1) throw oversized('storageReads', 1, 0);
        if (config.manifestBytes > limits.maxReservedBytes) throw oversized('reservedBytes', config.manifestBytes, limits.maxReservedBytes);
        const stats = { reads: 0, bytes: 0, expectedEtag: cursor?.manifestEtag };
        const manifest = await reader.manifestForRequest(stats);
        signal?.throwIfAborted();
        if (!isAddressSnapshotScanEtag(stats.etag) || !isAddressSnapshotScanSnapshot(manifest.snapshot)) throw unavailable();

        const bounds = spatialAreaBounds(area);
        const tiles = manifest.tiles.filter(tile => boundsIntersect(tile.bounds, bounds));
        let tileIndex = cursor?.tile ?? 0, rowIndex = cursor?.row ?? 0;
        if (tileIndex > tiles.length || (tileIndex === tiles.length ? rowIndex !== 0 : rowIndex >= tiles[tileIndex].count)) throw invalid();

        const batchCandidateLimit = Math.min(limits.maxCandidateRows, Math.floor(limits.maxGeometryWork / edges));
        if (tileIndex < tiles.length && batchCandidateLimit < 1) {
            if (limits.maxCandidateRows < 1) throw oversized('candidateRows', 1, limits.maxCandidateRows);
            throw oversized('geometryWork', edges, limits.maxGeometryWork);
        }
        const rows = [], ids = new Set(), ordinals = new Set();
        let rowBytes = 2, candidates = 0, consumedCandidates = 0, tilesRead = 0;

        nextTile: while (tileIndex < tiles.length && candidates < batchCandidateLimit) {
            const tile = tiles[tileIndex];
            const reservation = [
                ['tiles', tilesRead + 1, limits.maxAreaTiles],
                ['storageReads', stats.reads + 2, limits.maxR2Reads],
                ['reservedBytes', stats.bytes + tile.index.bytes + tile.rows.bytes, limits.maxReservedBytes],
            ].find(([, observed, allowed]) => observed > allowed);
            if (reservation) {
                if (consumedCandidates === 0) throw oversized(...reservation);
                break;
            }

            const [indexBytes, rowPack] = await readTile(tile, stats, signal);
            signal?.throwIfAborted();
            tilesRead++;

            const data = new DataView(indexBytes.buffer, indexBytes.byteOffset, indexBytes.byteLength);
            const pack = reader.json(rowPack);
            if (!Array.isArray(pack) || pack.length !== tile.count) throw unavailable();
            let previous = -1;
            const points = pack.map((row, i) => {
                reader.validateRow(row);
                const point = reader.indexPoint(data, tile, i, previous);
                if (ids.has(row[0]) || ordinals.has(point.ordinal)) throw unavailable();
                previous = point.ordinal;
                ids.add(row[0]);
                ordinals.add(point.ordinal);
                return point;
            });

            for (; rowIndex < tile.count && candidates < batchCandidateLimit; rowIndex++, consumedCandidates++) {
                signal?.throwIfAborted();
                candidates++;
                const point = points[rowIndex];
                if (!containsSpatialPoint(area, point)) continue;
                const [id, postalCode, block, roadName, building, address] = pack[rowIndex];
                const match = { id, postalCode, block, roadName, building, address, ...point };
                const bytes = utf8.encode(JSON.stringify(match)).byteLength;
                if (bytes + 2 > rowArrayLimit) throw unavailable();
                const addition = bytes + (rows.length ? 1 : 0);
                // The tested match stays at the next cursor if it does not fit.
                if (rowBytes + addition > rowArrayLimit) break nextTile;
                rowBytes += addition;
                rows.push(match);
            }
            if (rowIndex === tile.count) {
                tileIndex++;
                rowIndex = 0;
            }
        }

        const done = tileIndex === tiles.length;
        const identity = { areaSha256, manifestSha256: config.manifestSha256, manifestEtag: stats.etag };
        return {
            schemaVersion: 1,
            snapshot: manifest.snapshot,
            scan: { ...identity, tilesTotal: tiles.length, batchCandidateLimit },
            rows,
            nextCursor: done ? null : { schemaVersion: 1, snapshotSha256, ...identity, tile: tileIndex, row: rowIndex },
            done,
            progress: { tilesCompleted: tileIndex, tilesTotal: tiles.length },
            diagnostics: { reads: stats.reads, bytes: stats.bytes, consumedCandidates, candidates, geometryWork: candidates * edges },
        };
    }

    return {
        async scan(input, { signal } = {}) {
            signal?.throwIfAborted();
            try { return await reader.guarded(() => execute(input, signal)); }
            catch (error) {
                signal?.throwIfAborted();
                throw error;
            }
        },
    };
}
