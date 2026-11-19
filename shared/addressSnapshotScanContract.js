import { isSpatialCoordinate } from './addressSnapshotSpatial.js';

/** @typedef {[number, number]} Coordinate */
/** @typedef {Coordinate[][]} PolygonCoordinates */
/**
 * @typedef {{type: 'circle', center: Coordinate, radiusMeters: number}
 *     | {type: 'Polygon', coordinates: PolygonCoordinates}
 *     | {type: 'MultiPolygon', coordinates: PolygonCoordinates[]}} SpatialArea
 */
/**
 * @typedef {{schemaVersion: 1, snapshotSha256: string, manifestSha256: string, manifestEtag: string,
 *     areaSha256: string, tile: number, row: number}} ScanCursor
 */
/** @typedef {{area: SpatialArea, snapshotSha256: string, cursor: ScanCursor | null}} AddressSnapshotScanRequest */
/**
 * @typedef {{label: string, preparedAt: string, preparationEvidence: string, source: string, coverage: string,
 *     sha256: string, recordCount: number, postalCodeCount: number}} Snapshot
 * @typedef {{id: string, postalCode: string, block: string, roadName: string, building: string, address: string,
 *     lat: number, lng: number, ordinal: number}} ScanRow
 * @typedef {{schemaVersion: 1, snapshot: Snapshot, scan: {areaSha256: string, manifestSha256: string,
 *     manifestEtag: string, tilesTotal: number, batchCandidateLimit: number}, rows: ScanRow[],
 *     nextCursor: ScanCursor | null, done: boolean, progress: {tilesCompleted: number, tilesTotal: number},
 *     diagnostics: {reads: number, bytes: number, consumedCandidates: number, candidates: number, geometryWork: number}}}
 *     AddressSnapshotScanResponse
 */

export const ADDRESS_SNAPSHOT_SCAN_CAPS = Object.freeze({
    maxTiles: 16,
    maxReads: 33,
    maxBytes: 4 * 1024 * 1024,
    maxConcurrentReads: 4,
    maxGeometryWork: 250000,
    maxCandidates: 512,
    maxResponseBytes: 2 * 1024 * 1024,
    responseEnvelopeReserveBytes: 32 * 1024,
    maxRetainedBytes: 64 * 1024 * 1024,
    maxBatches: 8192,
    maxRecordCount: 0xffffffff,
});

const cursorKeys = ['schemaVersion', 'snapshotSha256', 'manifestSha256', 'manifestEtag', 'areaSha256', 'tile', 'row'];
const snapshotKeys = ['label', 'preparedAt', 'preparationEvidence', 'source', 'coverage', 'sha256', 'recordCount', 'postalCodeCount'];
const rowKeys = ['id', 'postalCode', 'block', 'roadName', 'building', 'address', 'lat', 'lng', 'ordinal'];

const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const count = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value <= max;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function isAddressSnapshotScanRecordCount(value) {
    return count(value, ADDRESS_SNAPSHOT_SCAN_CAPS.maxRecordCount) && value > 0;
}

export function isAddressSnapshotScanEtag(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/\p{Cc}/u.test(value);
}

/** @param {*} value @returns {value is ScanCursor} */
export function isAddressSnapshotScanCursor(value) {
    return exactKeys(value, cursorKeys) && value.schemaVersion === 1
        && hash(value.snapshotSha256) && hash(value.manifestSha256) && isAddressSnapshotScanEtag(value.manifestEtag)
        && hash(value.areaSha256) && count(value.tile) && count(value.row);
}

/**
 * Checks the request envelope and area keys. Geometry values are validated during normalization.
 * @param {*} value
 * @returns {value is {area: {type: unknown}, snapshotSha256: string, cursor: ScanCursor | null}}
 */
export function isAddressSnapshotScanRequest(value) {
    return exactKeys(value, ['area', 'snapshotSha256', 'cursor']) && hash(value.snapshotSha256)
        && (value.cursor === null || isAddressSnapshotScanCursor(value.cursor))
        && exactKeys(value.area, value.area?.type === 'circle' ? ['type', 'center', 'radiusMeters'] : ['type', 'coordinates']);
}

export function isAddressSnapshotScanSnapshot(value) {
    if (!exactKeys(value, snapshotKeys) || !hash(value.sha256) || !isAddressSnapshotScanRecordCount(value.recordCount)
        || !count(value.postalCodeCount, value.recordCount) || value.postalCodeCount < 1
        || !['label', 'preparationEvidence', 'source', 'coverage'].every(key => typeof value[key] === 'string'
            && value[key].length > 0 && value[key].length <= 1000)
        || typeof value.preparedAt !== 'string' || ![24, 27].includes(value.preparedAt.length)) return false;
    const time = Date.parse(value.preparedAt);
    return Number.isFinite(time) && new Date(time).toISOString() === value.preparedAt;
}

function validRow(row, recordCount) {
    return exactKeys(row, rowKeys)
        && typeof row.id === 'string' && /^address_[a-f0-9]{64}_[1-9]\d{0,6}$/.test(row.id)
        && typeof row.postalCode === 'string' && /^\d{6}$/.test(row.postalCode)
        && ['block', 'roadName', 'building', 'address'].every(key => typeof row[key] === 'string' && row[key].length <= 65536)
        && isSpatialCoordinate([row.lat, row.lng]) && count(row.ordinal, recordCount - 1);
}

function sameIdentity(cursor, snapshot, scan) {
    return cursor.snapshotSha256 === snapshot.sha256 && cursor.areaSha256 === scan.areaSha256
        && cursor.manifestSha256 === scan.manifestSha256 && cursor.manifestEtag === scan.manifestEtag;
}

/**
 * Pass the accepted request cursor (null on the first step) to check relative progress.
 * @param {*} value
 * @param {{snapshotSha256?: string, areaSha256?: string, cursor?: ScanCursor | null}} [context]
 * @returns {value is AddressSnapshotScanResponse}
 */
export function isAddressSnapshotScanResponse(value, { snapshotSha256, areaSha256, cursor } = {}) {
    if (!exactKeys(value, ['schemaVersion', 'snapshot', 'scan', 'rows', 'nextCursor', 'done', 'progress', 'diagnostics'])
        || value.schemaVersion !== 1 || typeof value.done !== 'boolean') return false;
    const { snapshot, scan, rows, nextCursor, done, progress, diagnostics } = value;
    const caps = ADDRESS_SNAPSHOT_SCAN_CAPS;
    if (!isAddressSnapshotScanSnapshot(snapshot) || (snapshotSha256 !== undefined && snapshot.sha256 !== snapshotSha256)
        || !exactKeys(scan, ['areaSha256', 'manifestSha256', 'manifestEtag', 'tilesTotal', 'batchCandidateLimit'])
        || !hash(scan.areaSha256) || (areaSha256 !== undefined && scan.areaSha256 !== areaSha256)
        || !hash(scan.manifestSha256) || !isAddressSnapshotScanEtag(scan.manifestEtag)
        || !count(scan.tilesTotal, snapshot.recordCount) || !count(scan.batchCandidateLimit, caps.maxCandidates)
        || !exactKeys(progress, ['tilesCompleted', 'tilesTotal']) || progress.tilesTotal !== scan.tilesTotal
        || !count(progress.tilesCompleted, scan.tilesTotal)) return false;
    if (!exactKeys(diagnostics, ['reads', 'bytes', 'consumedCandidates', 'candidates', 'geometryWork'])
        || !count(diagnostics.reads, caps.maxReads) || diagnostics.reads < 1
        || !count(diagnostics.bytes, caps.maxBytes) || diagnostics.bytes < 1
        || !count(diagnostics.candidates, scan.batchCandidateLimit) || diagnostics.candidates > snapshot.recordCount
        || !count(diagnostics.consumedCandidates, diagnostics.candidates)
        || !count(diagnostics.geometryWork, caps.maxGeometryWork)
        || diagnostics.geometryWork < diagnostics.candidates || (diagnostics.candidates === 0 && diagnostics.geometryWork !== 0)
        || !Array.isArray(rows) || rows.length > diagnostics.consumedCandidates
        || !rows.every(row => validRow(row, snapshot.recordCount))) return false;

    if (cursor != null && (!isAddressSnapshotScanCursor(cursor) || !sameIdentity(cursor, snapshot, scan)
        || cursor.tile > scan.tilesTotal || cursor.row >= snapshot.recordCount
        || (cursor.tile === scan.tilesTotal && cursor.row !== 0))) return false;
    const tilesAdvanced = progress.tilesCompleted - (cursor?.tile ?? 0);
    const { consumedCandidates } = diagnostics;
    if (tilesAdvanced < 0 || (cursor !== undefined && tilesAdvanced > caps.maxTiles)) return false;
    if (done) {
        return nextCursor === null && progress.tilesCompleted === scan.tilesTotal
            && (cursor === undefined || (tilesAdvanced === 0 ? consumedCandidates === 0 : consumedCandidates >= tilesAdvanced));
    }
    if (consumedCandidates === 0 || !isAddressSnapshotScanCursor(nextCursor) || !sameIdentity(nextCursor, snapshot, scan)
        || nextCursor.tile !== progress.tilesCompleted || nextCursor.tile >= scan.tilesTotal || nextCursor.row >= snapshot.recordCount) return false;
    if (cursor === undefined) return tilesAdvanced > 0 || nextCursor.row > 0;

    if (tilesAdvanced === 0) return nextCursor.row - (cursor?.row ?? 0) === consumedCandidates;
    // Each completed tile consumes at least one position, plus the prefix of the destination tile.
    return tilesAdvanced + nextCursor.row <= consumedCandidates;
}
