import { createReadStream } from 'node:fs';
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvRecords } from './address-snapshot-service.mjs';
import { isSpatialCoordinate } from '../shared/addressSnapshotSpatial.js';
import { ADDRESS_SNAPSHOT_CONFIG } from '../server/src/utils/addressSnapshotConfig.js';

const columns = ['postal_code', 'blk_no', 'road_name', 'building', 'address', 'latitude', 'longitude'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };

// Pure in-memory compiler shared by the production builder and fictional tests.
// Original source field strings determine IDs; source ordinals preserve existing pagination order.
export function compileAddressSnapshotRecords(records, { sourceSha256, preparedAt } = {}) {
    requireValue(/^[a-f0-9]{64}$/.test(sourceSha256 || '') && typeof preparedAt === 'string'
        && new Date(preparedAt).toISOString() === preparedAt, 'A source digest and precise preparation timestamp are required.');
    const cells = new Map(), duplicates = new Map(), postals = new Set(); let count = 0;
    for (const fields of records) {
        requireValue(Array.isArray(fields) && fields.length === 7 && fields.every(value => typeof value === 'string' && value.length <= 65536), 'Invalid address source record.');
        const [postalCode, block, roadName, building, address, latitude, longitude] = fields;
        const lat = latitude.trim() ? Number(latitude) : NaN, lng = longitude.trim() ? Number(longitude) : NaN;
        requireValue(/^\d{6}$/.test(postalCode) && isSpatialCoordinate([lat, lng]), 'Invalid source postal code or coordinates.');
        requireValue(count < 0xffffffff, 'Too many address source records.');
        const hash = digest(JSON.stringify(fields)), occurrence = (duplicates.get(hash) || 0) + 1;
        duplicates.set(hash, occurrence);
        const id = `address_${hash}_${occurrence}`, tile = [Math.floor(lat / .01), Math.floor(lng / .01)], key = tile.join('_');
        if (!cells.has(key)) cells.set(key, { key, tile, rows: [] });
        cells.get(key).rows.push({ id, postalCode, block, roadName, building, address, lat, lng, ordinal: count++ });
        postals.add(postalCode);
    }
    requireValue(count > 0, 'A published address snapshot must contain records.');
    const prefix = `address-snapshot/v1/${sourceSha256}`;
    const manifest = { schemaVersion: 1, snapshot: {
        label: 'Singapore address snapshot', preparedAt, preparationEvidence: 'CSV file modification time; not per-address verification',
        source: 'Existing CSV; mixed source ages; not live verified', coverage: 'Incomplete and potentially outdated',
        sha256: sourceSha256, recordCount: count, postalCodeCount: postals.size,
    }, layout: { cellDegrees: .01, indexRecordBytes: 20,
        indexRecord: 'lat Float64LE, lng Float64LE, original source ordinal Uint32LE; row ordinal is record position',
        rowFields: ['id', 'postalCode', 'block', 'roadName', 'building', 'address'], coordinatePrecision: 'original JavaScript Float64, no rounding',
        paginationOrder: 'original CSV row ordinal' }, tiles: [] };
    const objects = new Map(); let totalBytes = 0;
    for (const cell of [...cells.values()].sort((a, b) => a.tile[0] - b.tile[0] || a.tile[1] - b.tile[1])) {
        const indices = Buffer.alloc(cell.rows.length * 20);
        const tuples = cell.rows.map((row, index) => {
            indices.writeDoubleLE(row.lat, index * 20); indices.writeDoubleLE(row.lng, index * 20 + 8); indices.writeUInt32LE(row.ordinal, index * 20 + 16);
            return [row.id, row.postalCode, row.block, row.roadName, row.building, row.address];
        });
        const entries = {};
        for (const [kind, filename, bytes, contentType] of [['index', 'index.bin', indices, 'application/octet-stream'],
            ['rows', 'rows.json', Buffer.from(JSON.stringify(tuples)), 'application/json']]) {
            const key = `${prefix}/tiles/${cell.key}/${filename}`, sha256 = digest(bytes);
            requireValue(bytes.length <= ADDRESS_SNAPSHOT_CONFIG.limits.maxObjectBytes, 'Address tile exceeds the admitted object size.');
            entries[kind] = { key, bytes: bytes.length, sha256 };
            objects.set(key, { bytes, contentType, sha256 }); totalBytes += bytes.length;
        }
        const lats = cell.rows.map(row => row.lat), lngs = cell.rows.map(row => row.lng);
        manifest.tiles.push({ id: cell.key, count: cell.rows.length,
            bounds: { south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lngs), east: Math.max(...lngs) }, ...entries });
    }
    const bytes = Buffer.from(JSON.stringify(manifest)), manifestSha256 = digest(bytes);
    requireValue(bytes.length <= ADDRESS_SNAPSHOT_CONFIG.limits.maxManifestBytes, 'Address manifest exceeds the admitted size.');
    objects.set(`${prefix}/manifest.json`, { bytes, contentType: 'application/json', sha256: manifestSha256 }); totalBytes += bytes.length;
    const config = { ...ADDRESS_SNAPSHOT_CONFIG, prefix, sourceSha256, manifestSha256, manifestBytes: bytes.length,
        recordCount: count, postalCodeCount: postals.size, tileCount: cells.size, totalBytes, preparedAt };
    return { manifest, config, objects };
}

async function resolvedFuturePath(path) {
    try { return await realpath(path); }
    catch (error) { if (error.code !== 'ENOENT') throw error; return join(await resolvedFuturePath(dirname(path)), basename(path)); }
}

export async function buildAddressSnapshot({ csvPath, outputRoot, expected = ADDRESS_SNAPSHOT_CONFIG } = {}) {
    requireValue(isAbsolute(csvPath || '') && isAbsolute(outputRoot || ''), 'Use absolute source and external output paths.');
    const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..'), output = await resolvedFuturePath(outputRoot);
    const repoRelative = relative(repositoryRoot, output);
    requireValue(repoRelative.startsWith(`..${sep}`) || repoRelative === '..', 'Compiled address payloads must stay outside the repository.');
    const source = await realpath(csvPath);
    requireValue(source !== output && !source.startsWith(output + sep), 'Output must not contain the source CSV.');
    const before = await stat(source);
    requireValue(before.isFile() && before.size <= 64 * 1024 * 1024 && before.mtime.toISOString() === expected.preparedAt, 'Source file preparation evidence does not match the approved snapshot.');
    const hash = createHash('sha256'), records = []; let header = null, positions = null;
    async function* chunks() { for await (const chunk of createReadStream(source)) { hash.update(chunk); yield chunk; } }
    for await (const fields of parseCsvRecords(chunks())) {
        if (!header) {
            header = fields; positions = columns.map(column => header.indexOf(column));
            requireValue(positions.every(index => index >= 0) && new Set(header).size === header.length, 'Invalid address source columns.'); continue;
        }
        if (fields.length === 1 && fields[0] === '') continue;
        requireValue(fields.length === header.length && records.length < expected.recordCount, 'Address source row count or fields do not match the approved snapshot.');
        records.push(positions.map(index => fields[index]));
    }
    requireValue(hash.digest('hex') === expected.sourceSha256 && records.length === expected.recordCount, 'Source bytes/count do not match the approved snapshot.');
    const after = await stat(source);
    requireValue(after.size === before.size && after.mtimeMs === before.mtimeMs, 'Source changed while preparing the snapshot.');
    const result = compileAddressSnapshotRecords(records, { sourceSha256: expected.sourceSha256, preparedAt: before.mtime.toISOString() });
    for (const key of ['manifestSha256', 'manifestBytes', 'recordCount', 'postalCodeCount', 'tileCount', 'totalBytes']) {
        requireValue(result.config[key] === expected[key], `Compiled snapshot ${key} does not match the approved artifact.`);
    }
    // A fresh external root and create-only files prevent accidental overwrite or source commits.
    await mkdir(dirname(output), { recursive: true }); await mkdir(output);
    for (const [key, object] of result.objects) {
        const filename = join(output, key.slice(result.config.prefix.length + 1));
        await mkdir(dirname(filename), { recursive: true }); await writeFile(filename, object.bytes, { flag: 'wx' });
    }
    return { config: result.config, manifest: result.manifest, objectCount: result.objects.size, sourcePreserved: true, outputRoot: output };
}

export function parseSnapshotBuildArguments(args) {
    const options = {};
    for (let index = 0; index < args.length; index++) {
        const key = args[index], value = args[++index];
        requireValue(['--csv', '--out'].includes(key) && value && !value.startsWith('--'), 'Use --csv ABSOLUTE_PATH --out FRESH_EXTERNAL_DIRECTORY.');
        requireValue(!Object.hasOwn(options, key), 'Duplicate builder argument.'); options[key] = value;
    }
    return { csvPath: options['--csv'], outputRoot: options['--out'] };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { const result = await buildAddressSnapshot(parseSnapshotBuildArguments(process.argv.slice(2)));
        console.log(JSON.stringify({ objectCount: result.objectCount, totalBytes: result.config.totalBytes,
            manifestSha256: result.config.manifestSha256, sourcePreserved: result.sourcePreserved })); }
    catch { console.error('Snapshot preparation failed. Check approved CSV, preparation timestamp, and a fresh external output directory.'); process.exitCode = 1; }
}
