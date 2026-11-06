import { containsSpatialPoint, distanceMeters, isSpatialCoordinate, normalizeSpatialArea, spatialAreaBounds } from '../../../shared/addressSnapshotSpatial.js';
import { ADDRESS_SNAPSHOT_CONFIG } from './addressSnapshotConfig.js';
import { normalizeAddressSnapshotLimit } from '../../../shared/addressSnapshotQueryLimits.js';

export class AddressSnapshotRepositoryError extends Error {
    constructor(message, status = 503, code = 'ADDRESS_SNAPSHOT_UNAVAILABLE', addressLimit) {
        super(message); this.name = 'AddressSnapshotRepositoryError'; this.status = status; this.code = code;
        if (code === 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE') this.addressLimit = normalizeAddressSnapshotLimit(addressLimit);
    }
}
const unavailable = () => new AddressSnapshotRepositoryError('Address data is temporarily unavailable. Try again or enter an address manually.');
const invalid = () => new AddressSnapshotRepositoryError('Check the search location, shape and page, then try again.', 400, 'ADDRESS_SNAPSHOT_INVALID_QUERY');
const oversized = (reason, observed, allowed) => new AddressSnapshotRepositoryError('This area is too large or complex. Choose a smaller area and try again.', 422, 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE', { reason, observed, allowed });
const changed = () => new AddressSnapshotRepositoryError('Address data changed. Restart the search before continuing.', 409, 'ADDRESS_SNAPSHOT_CHANGED');
const hashPattern = /^[a-f0-9]{64}$/;
const rowIdPattern = /^address_[a-f0-9]{64}_[1-9]\d{0,6}$/;
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysAre = (value, keys) => plainObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const boundsIntersect = (a, b) => a.south <= b.north && a.north >= b.south && a.west <= b.east && a.east >= b.west;
const pointInBounds = (lat, lng, bounds) => lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;

async function sha256(bytes) {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
}

// Each invocation owns its budget and request data. No cross-request query cache.
export function createAddressSnapshotRepository(bucket, { config = ADDRESS_SNAPSHOT_CONFIG } = {}) {
    const limits = config.limits;
    const budgetForRequest = () => ({ reads: 0, bytes: 0 });
    async function guarded(action) {
        try { return await action(); }
        catch (error) { throw error instanceof AddressSnapshotRepositoryError ? error : unavailable(); }
    }
    async function readObject(descriptor, contentType, budget, maximum = limits.maxObjectBytes) {
        if (!bucket || typeof bucket.get !== 'function' || !Number.isSafeInteger(descriptor.bytes)
            || descriptor.bytes < 1 || descriptor.bytes > maximum || !hashPattern.test(descriptor.sha256)
            || ++budget.reads > limits.maxR2Reads) throw unavailable();
        const object = await bucket.get(descriptor.key);
        if (!object) throw unavailable();
        if (object.size !== descriptor.bytes || object.httpMetadata?.contentType !== contentType || !object.body?.getReader) {
            await object.body?.cancel?.().catch(() => {}); throw unavailable();
        }
        const reader = object.body.getReader(), bytes = new Uint8Array(descriptor.bytes);
        let length = 0;
        try {
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                if (!(value instanceof Uint8Array) || value.byteLength > descriptor.bytes - length
                    || value.byteLength > limits.maxReservedBytes - budget.bytes) throw unavailable();
                bytes.set(value, length); length += value.byteLength; budget.bytes += value.byteLength;
            }
            if (length !== descriptor.bytes || await sha256(bytes) !== descriptor.sha256) throw unavailable();
        } catch (error) { await reader.cancel().catch(() => {}); throw error; }
        finally { reader.releaseLock(); }
        return bytes;
    }
    function json(bytes) {
        try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
        catch { throw unavailable(); }
    }
    function validateManifest(manifest) {
        if (!keysAre(manifest, ['schemaVersion', 'snapshot', 'layout', 'tiles']) || manifest.schemaVersion !== 1
            || !keysAre(manifest.snapshot, ['label', 'preparedAt', 'preparationEvidence', 'source', 'coverage', 'sha256', 'recordCount', 'postalCodeCount'])
            || manifest.snapshot.sha256 !== config.sourceSha256 || manifest.snapshot.recordCount !== config.recordCount
            || manifest.snapshot.postalCodeCount !== config.postalCodeCount || manifest.snapshot.preparedAt !== config.preparedAt
            || !['label', 'preparationEvidence', 'source', 'coverage'].every(key => typeof manifest.snapshot[key] === 'string'
                && manifest.snapshot[key].length > 0 && manifest.snapshot[key].length <= 1000)
            || !keysAre(manifest.layout, ['cellDegrees', 'indexRecordBytes', 'indexRecord', 'rowFields', 'coordinatePrecision', 'paginationOrder'])
            || manifest.layout.cellDegrees !== 0.01 || manifest.layout.indexRecordBytes !== limits.indexRecordBytes
            || manifest.layout.indexRecord !== 'lat Float64LE, lng Float64LE, original source ordinal Uint32LE; row ordinal is record position'
            || JSON.stringify(manifest.layout.rowFields) !== JSON.stringify(['id', 'postalCode', 'block', 'roadName', 'building', 'address'])
            || manifest.layout.coordinatePrecision !== 'original JavaScript Float64, no rounding'
            || manifest.layout.paginationOrder !== 'original CSV row ordinal'
            || !Array.isArray(manifest.tiles) || manifest.tiles.length !== config.tileCount) throw unavailable();
        const ids = new Set(); let count = 0, totalBytes = config.manifestBytes;
        for (const tile of manifest.tiles) {
            if (!keysAre(tile, ['id', 'count', 'bounds', 'index', 'rows']) || typeof tile.id !== 'string'
                || !/^-?\d+_-?\d+$/.test(tile.id) || ids.has(tile.id) || !Number.isSafeInteger(tile.count) || tile.count < 1
                || tile.count > config.recordCount || !keysAre(tile.bounds, ['south', 'north', 'west', 'east'])) throw unavailable();
            const [y, x] = tile.id.split('_').map(Number), b = tile.bounds;
            if (`${y}_${x}` !== tile.id || !isSpatialCoordinate([b.south, b.west]) || !isSpatialCoordinate([b.north, b.east])
                || b.south > b.north || b.west > b.east || Math.floor(b.south / .01) !== y || Math.floor(b.north / .01) !== y
                || Math.floor(b.west / .01) !== x || Math.floor(b.east / .01) !== x) throw unavailable();
            for (const [kind, file] of [['index', 'index.bin'], ['rows', 'rows.json']]) {
                const entry = tile[kind];
                if (!keysAre(entry, ['key', 'bytes', 'sha256']) || entry.key !== `${config.prefix}/tiles/${tile.id}/${file}`
                    || typeof entry.sha256 !== 'string' || !hashPattern.test(entry.sha256) || !Number.isSafeInteger(entry.bytes)
                    || entry.bytes < 1 || entry.bytes > limits.maxObjectBytes) throw unavailable();
                totalBytes += entry.bytes;
            }
            if (tile.index.bytes !== tile.count * limits.indexRecordBytes) throw unavailable();
            ids.add(tile.id); count += tile.count;
        }
        if (count !== config.recordCount || totalBytes !== config.totalBytes) throw unavailable();
        return manifest;
    }
    async function manifestForRequest(budget) {
        return validateManifest(json(await readObject({ key: `${config.prefix}/manifest.json`, bytes: config.manifestBytes,
            sha256: config.manifestSha256 }, 'application/json', budget, limits.maxManifestBytes)));
    }
    function validateInput(input, mode) {
        const allowed = mode === 'area' ? ['area', 'offset', 'limit', 'snapshotSha256'] : ['lat', 'lng', 'radiusMeters', 'limit', 'snapshotSha256'];
        if (!plainObject(input) || Object.keys(input).some(key => !allowed.includes(key))
            || typeof input.snapshotSha256 !== 'string' || !hashPattern.test(input.snapshotSha256)) throw invalid();
        if (input.snapshotSha256 !== config.sourceSha256) throw changed();
        const offset = mode === 'area' ? input.offset ?? 0 : 0, limit = input.limit ?? (mode === 'area' ? 200 : 10);
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > config.recordCount
            || !Number.isSafeInteger(limit) || limit < 1 || limit > limits.maxPageSize) throw invalid();
        let area;
        if (mode === 'area') {
            try { area = normalizeSpatialArea(input.area); } catch { throw invalid(); }
            if (!area) throw invalid();
        } else {
            const radiusMeters = input.radiusMeters ?? 100;
            if (!isSpatialCoordinate([input.lat, input.lng]) || typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters)
                || radiusMeters < 1 || radiusMeters > limits.maxNearbyRadiusMeters) throw invalid();
            area = { type: 'circle', center: [input.lat, input.lng], radiusMeters };
        }
        // Keep validated request geometry private to this invocation across awaits.
        area = area.type === 'circle' ? { ...area, center: [...area.center] }
            : { type: area.type, coordinates: structuredClone(area.coordinates) };
        const polygons = area.type === 'Polygon' ? [area.coordinates] : area.type === 'MultiPolygon' ? area.coordinates : [];
        const edgeCount = area.type === 'circle' ? 1 : polygons.reduce((sum, rings) => sum + rings.reduce((n, ring) => n + ring.length - 1, 0), 0);
        if (edgeCount > limits.maxGeometryPoints) throw invalid();
        return { area, offset, limit, edgeCount };
    }
    function planQuery(manifest, query) {
        const bounds = spatialAreaBounds(query.area), tiles = manifest.tiles.filter(tile => boundsIntersect(tile.bounds, bounds));
        const candidates = tiles.reduce((n, tile) => n + tile.count, 0);
        // Reserve ALL intersected packs, not just page one, so every admitted page can complete.
        const reserved = config.manifestBytes + tiles.reduce((n, tile) => n + tile.index.bytes + tile.rows.bytes, 0);
        for (const [reason, observed, allowed] of [
            ['tiles', tiles.length, limits.maxAreaTiles],
            ['reservedBytes', reserved, limits.maxReservedBytes],
            ['candidateRows', candidates, limits.maxCandidateRows],
            ['geometryWork', candidates * query.edgeCount, limits.maxGeometryWork],
            ['storageReads', 1 + tiles.length * 2, limits.maxR2Reads],
        ]) if (observed > allowed) throw oversized(reason, observed, allowed);
        return { bounds, tiles };
    }
    async function concurrent(values, action) {
        const result = new Array(values.length); let next = 0, failed = false;
        async function worker() {
            while (!failed && next < values.length) {
                const index = next++;
                try { result[index] = await action(values[index]); }
                catch (error) { failed = true; throw error; }
            }
        }
        // Settle started reads before leaving; no floating requests after a failed query.
        const settled = await Promise.allSettled(Array.from({ length: Math.min(limits.maxConcurrentReads, values.length) }, worker));
        const failure = settled.find(value => value.status === 'rejected');
        if (failure) throw failure.reason;
        return result;
    }
    async function execute(query, mode) {
        const budget = budgetForRequest(), manifest = await manifestForRequest(budget), plan = planQuery(manifest, query);
        const ordinals = new Set(), indicesByTile = new Map();
        const matches = (await concurrent(plan.tiles, async tile => {
            const bytes = await readObject(tile.index, 'application/octet-stream', budget);
            const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), values = [], found = [];
            let previous = -1;
            for (let i = 0; i < tile.count; i++) {
                const at = i * limits.indexRecordBytes, lat = data.getFloat64(at, true), lng = data.getFloat64(at + 8, true), ordinal = data.getUint32(at + 16, true);
                if (!isSpatialCoordinate([lat, lng]) || !pointInBounds(lat, lng, tile.bounds) || `${Math.floor(lat / .01)}_${Math.floor(lng / .01)}` !== tile.id
                    || ordinal >= config.recordCount || ordinal <= previous || ordinals.has(ordinal)) throw unavailable();
                previous = ordinal; ordinals.add(ordinal); values.push({ lat, lng, ordinal });
                if (pointInBounds(lat, lng, plan.bounds) && containsSpatialPoint(query.area, { lat, lng })) found.push({ tile, local: i, lat, lng, ordinal,
                    ...(mode === 'nearby' ? { distanceMeters: distanceMeters(query.area.center, [lat, lng]) } : {}) });
            }
            indicesByTile.set(tile.id, values);
            return found;
        })).flat();
        matches.sort(mode === 'nearby' ? (a, b) => a.distanceMeters - b.distanceMeters || a.ordinal - b.ordinal : (a, b) => a.ordinal - b.ordinal);
        const page = matches.slice(query.offset, query.offset + query.limit), pageTiles = [...new Map(page.map(value => [value.tile.id, value.tile])).values()];
        const rowIds = new Set();
        const packs = new Map(await concurrent(pageTiles, async tile => {
            const rows = json(await readObject(tile.rows, 'application/json', budget));
            if (!Array.isArray(rows) || rows.length !== tile.count || indicesByTile.get(tile.id)?.length !== rows.length) throw unavailable();
            for (const row of rows) {
                if (!Array.isArray(row) || row.length !== 6 || !row.every(value => typeof value === 'string' && value.length <= 65536)
                    || !rowIdPattern.test(row[0]) || !/^\d{6}$/.test(row[1]) || rowIds.has(row[0])) throw unavailable();
                rowIds.add(row[0]);
            }
            return [tile.id, rows];
        }));
        return { snapshot: { ...manifest.snapshot }, total: matches.length,
            rows: page.map(item => {
                const [id, postalCode, block, roadName, building, address] = packs.get(item.tile.id)[item.local];
                return { id, postalCode, block, roadName, building, address, lat: item.lat, lng: item.lng,
                    ...(mode === 'nearby' ? { distanceMeters: item.distanceMeters } : {}) };
            }), offset: query.offset, limit: query.limit, truncated: query.offset + query.limit < matches.length };
    }
    return {
        metadata: () => guarded(async () => {
            const manifest = await manifestForRequest(budgetForRequest());
            return { ready: true, snapshot: { ...manifest.snapshot }, capabilities: {
                maxNearbyRadiusMeters: limits.maxNearbyRadiusMeters, maxPageSize: limits.maxPageSize, maxGeometryPoints: limits.maxGeometryPoints,
                maxAreaTiles: limits.maxAreaTiles, maxCandidateRows: limits.maxCandidateRows, maxReservedBytes: limits.maxReservedBytes,
                maxGeometryWork: limits.maxGeometryWork,
            } };
        }),
        nearby: input => guarded(() => execute(validateInput(input, 'nearby'), 'nearby')),
        area: input => guarded(() => execute(validateInput(input, 'area'), 'area')),
    };
}
