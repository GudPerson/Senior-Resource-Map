import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { containsSpatialPoint, distanceMeters, isSpatialCoordinate, normalizeSpatialArea, spatialAreaBounds } from '../client/src/lib/mapSpatialGeometry.js';

const CSV_COLUMNS = ['postal_code', 'blk_no', 'road_name', 'building', 'address', 'latitude', 'longitude'];
const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_PAGE_SIZE = 1000;
const GRID_DEGREES = 0.002;

// Streaming RFC-style CSV reader: quoted commas/newlines, escaped quotes,
// UTF-8 chunk boundaries, BOM, CRLF, and a final record without a newline.
export async function* parseCsvRecords(chunks) {
    const decoder = new StringDecoder('utf8');
    let field = '', record = [], quoted = false, afterQuote = false, skipLF = false, first = true;
    function* consume(text) {
        for (const char of text) {
            if (first) { first = false; if (char === '\uFEFF') continue; }
            if (skipLF) { skipLF = false; if (char === '\n') continue; }
            if (quoted && !afterQuote) {
                if (char === '"') afterQuote = true;
                else field += char;
            } else if (quoted && afterQuote && char === '"') {
                field += '"'; afterQuote = false;
            } else {
                if (quoted) { quoted = false; afterQuote = false; if (![',', '\r', '\n'].includes(char)) throw new Error('Invalid CSV after a closing quote.'); }
                if (char === '"') {
                    if (field) throw new Error('Invalid CSV quote.');
                    quoted = true;
                } else if (char === ',') { record.push(field); field = ''; }
                else if (char === '\r' || char === '\n') {
                    record.push(field); yield record; record = []; field = ''; skipLF = char === '\r';
                } else field += char;
            }
            if (field.length > 65536 || record.length > 64) throw new Error('CSV field or record is too large.');
        }
    }
    for await (const chunk of chunks) yield* consume(typeof chunk === 'string' ? chunk : decoder.write(chunk));
    yield* consume(decoder.end());
    if (quoted && !afterQuote) throw new Error('Unclosed CSV quote.');
    if (field || record.length || afterQuote) { record.push(field); yield record; }
}

function cellFor(lat, lng) {
    return [Math.floor(lat / GRID_DEGREES), Math.floor(lng / GRID_DEGREES)];
}

export function buildAddressSnapshotIndex(rows, snapshot = {}) {
    const cells = new Map();
    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        if (!isSpatialCoordinate([row.lat, row.lng]) || !/^\d{6}$/.test(row.postalCode) || typeof row.postalCode !== 'string') throw new Error('Invalid snapshot address record.');
        const [y, x] = cellFor(row.lat, row.lng), key = `${y}:${x}`;
        if (!cells.has(key)) cells.set(key, { y, x, indices: [] });
        cells.get(key).indices.push(index);
    }
    function candidates(bounds) {
        const [minY, minX] = cellFor(bounds.south, bounds.west);
        const [maxY, maxX] = cellFor(bounds.north, bounds.east);
        const result = [];
        const add = cell => { if (cell) for (const index of cell.indices) result.push(index); };
        // Large/global areas iterate occupied cells rather than billions of empty bins.
        if ((maxY - minY + 1) * (maxX - minX + 1) > cells.size * 4) {
            for (const cell of cells.values()) if (cell.y >= minY && cell.y <= maxY && cell.x >= minX && cell.x <= maxX) add(cell);
        } else {
            for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) add(cells.get(`${y}:${x}`));
        }
        return result;
    }
    function queryArea({ area, offset = 0, limit = 200 }) {
        const normalized = normalizeSpatialArea(area);
        if (!normalized) throw new Error('Invalid area.');
        validatePage(offset, limit);
        const bounds = spatialAreaBounds(normalized), possible = candidates(bounds);
        const matches = possible.filter(index => {
            const row = rows[index];
            return row.lat >= bounds.south && row.lat <= bounds.north && row.lng >= bounds.west && row.lng <= bounds.east
                && containsSpatialPoint(normalized, row);
        }).sort((a, b) => a - b);
        return { snapshot, total: matches.length, rows: matches.slice(offset, offset + limit).map(index => rows[index]),
            offset, limit, truncated: offset + limit < matches.length, candidateCount: possible.length };
    }
    function queryNearby({ lat, lng, radiusMeters = 100, limit = 10 }) {
        if (!isSpatialCoordinate([lat, lng]) || typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters)
            || radiusMeters < 1 || radiusMeters > 10000) throw new Error('Invalid nearby query.');
        validatePage(0, limit);
        const possible = candidates(spatialAreaBounds({ type: 'circle', center: [lat, lng], radiusMeters }));
        const matches = possible.map(index => ({ index, distanceMeters: distanceMeters([lat, lng], rows[index]) }))
            .filter(result => result.distanceMeters <= radiusMeters + 1e-7)
            .sort((a, b) => a.distanceMeters - b.distanceMeters || a.index - b.index);
        return { snapshot, total: matches.length,
            rows: matches.slice(0, limit).map(result => ({ ...rows[result.index], distanceMeters: result.distanceMeters })),
            offset: 0, limit, truncated: matches.length > limit, candidateCount: possible.length };
    }
    return { snapshot, queryArea, queryNearby, rowCount: rows.length, cellCount: cells.size };
}

export async function loadAddressSnapshot(csvPath, { preparedAt, expectedSha256 } = {}) {
    if (!isAbsolute(csvPath)) throw new Error('An absolute CSV path is required.');
    const file = await stat(csvPath);
    if (!file.isFile()) throw new Error('The CSV source must be a regular file.');
    const hash = createHash('sha256'), rows = [], postalCodes = new Set(), duplicateCounts = new Map();
    async function* hashedChunks() {
        for await (const chunk of createReadStream(csvPath)) { hash.update(chunk); yield chunk; }
    }
    let header = null, indices = null, line = 0;
    for await (const fields of parseCsvRecords(hashedChunks())) {
        line += 1;
        if (!header) {
            header = fields;
            indices = CSV_COLUMNS.map(column => header.indexOf(column));
            if (indices.some(index => index < 0) || new Set(header).size !== header.length) throw new Error('The CSV columns do not match the address snapshot format.');
            continue;
        }
        if (fields.length === 1 && fields[0] === '') continue;
        if (fields.length !== header.length) throw new Error(`Invalid CSV record ${line}.`);
        const values = indices.map(index => fields[index]);
        const [postalCode, block, roadName, building, address, latitude, longitude] = values;
        const lat = latitude.trim() ? Number(latitude) : NaN, lng = longitude.trim() ? Number(longitude) : NaN;
        if (!/^\d{6}$/.test(postalCode) || !isSpatialCoordinate([lat, lng])) throw new Error(`Invalid address coordinate or postal code at record ${line}.`);
        const identity = createHash('sha256').update(JSON.stringify(values)).digest('hex');
        const occurrence = (duplicateCounts.get(identity) || 0) + 1;
        duplicateCounts.set(identity, occurrence);
        rows.push({ id: `address_${identity}_${occurrence}`, postalCode, block, roadName, building, address, lat, lng });
        postalCodes.add(postalCode);
    }
    if (!header) throw new Error('The CSV source is empty; a header is required.');
    const sha256 = hash.digest('hex');
    if (expectedSha256 && sha256 !== expectedSha256) throw new Error('The CSV snapshot hash does not match the expected source.');
    const snapshotPreparedAt = preparedAt || file.mtime.toISOString();
    const snapshot = {
        label: 'Local Singapore address snapshot',
        preparedAt: snapshotPreparedAt,
        preparationEvidence: 'CSV file modification time; not per-address verification',
        loadedAt: new Date().toISOString(),
        source: 'Existing Singapore address CSV; mixed source ages; not live verified',
        coverage: 'Incomplete local snapshot. Addresses, buildings and postal codes may be missing or outdated.',
        sha256, recordCount: rows.length, postalCodeCount: postalCodes.size,
    };
    return buildAddressSnapshotIndex(rows, snapshot);
}

function validatePage(offset, limit) {
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) throw new Error('Invalid pagination.');
}

function isLoopbackUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password;
    } catch { return false; }
}

function sendJson(response, status, payload) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff' });
    response.end(JSON.stringify(payload));
}

async function readJson(request) {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) throw new Error('JSON required.');
    return new Promise((resolveBody, rejectBody) => {
        let size = 0, chunks = [], rejected = false;
        request.on('data', chunk => {
            if (rejected) return;
            size += chunk.length;
            if (size > MAX_REQUEST_BYTES) {
                rejected = true; chunks = [];
                const error = new Error('Request too large.'); error.status = 413; rejectBody(error);
                return;
            }
            chunks.push(chunk);
        });
        request.once('end', () => {
            if (rejected) return;
            try {
                const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON object required.');
                resolveBody(value);
            } catch (error) { rejectBody(error); }
        });
        request.once('error', rejectBody);
        request.once('aborted', () => rejectBody(new Error('Request aborted.')));
    });
}

export function createAddressSnapshotServer(index) {
    return createServer(async (request, response) => {
        if (!isLoopbackUrl(`http://${request.headers.host || ''}`) || (request.headers.origin && !isLoopbackUrl(request.headers.origin))) {
            sendJson(response, 403, { error: 'Local access only.' }); return;
        }
        const path = new URL(request.url, 'http://127.0.0.1').pathname;
        try {
            if (request.method === 'GET' && path === '/metadata') { sendJson(response, 200, { snapshot: index.snapshot }); return; }
            if (request.method !== 'POST' || !['/nearby', '/area'].includes(path)) { sendJson(response, 404, { error: 'Not found.' }); return; }
            const body = await readJson(request);
            const allowedKeys = path === '/nearby' ? ['lat', 'lng', 'radiusMeters', 'limit', 'snapshotSha256'] : ['area', 'offset', 'limit', 'snapshotSha256'];
            if (Object.keys(body).some(key => !allowedKeys.includes(key))) throw new Error('Unexpected query field.');
            if (body.snapshotSha256 !== undefined) {
                if (typeof body.snapshotSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(body.snapshotSha256)) throw new Error('Invalid snapshot pin.');
                if (body.snapshotSha256 !== index.snapshot.sha256) { const error = new Error('Snapshot changed.'); error.status = 409; throw error; }
            }
            const { snapshotSha256: _snapshotSha256, ...query } = body;
            const { candidateCount: _candidateCount, ...result } = path === '/nearby' ? index.queryNearby(query) : index.queryArea(query);
            sendJson(response, 200, result);
        } catch (error) {
            // Never return CSV contents, filesystem paths or internal exception text.
            sendJson(response, error.status === 413 ? 413 : error.status === 409 ? 409 : 400, { error: error.status === 413 ? 'Request too large.' : error.status === 409 ? 'Address snapshot changed. Restart the search.' : 'Invalid address query.' });
        }
    });
}

export function parseAddressServiceArguments(args) {
    const options = { port: 8796 };
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--csv' || arg === '--port' || arg === '--expected-sha256') {
            const value = args[++index];
            if (!value || value.startsWith('--')) throw new Error('Each argument requires a value.');
            options[arg === '--expected-sha256' ? 'expectedSha256' : arg.slice(2)] = arg === '--port' ? Number(value) : value;
        } else throw new Error('Use --csv ABSOLUTE_PATH [--port PORT].');
    }
    if (!options.csv || !isAbsolute(options.csv) || !Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) throw new Error('Use --csv ABSOLUTE_PATH [--port PORT, 1024–65535].');
    if (options.expectedSha256 && !/^[a-f0-9]{64}$/.test(options.expectedSha256)) throw new Error('Expected SHA-256 must be 64 lowercase hex characters.');
    return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const { csv, port, expectedSha256 } = parseAddressServiceArguments(process.argv.slice(2));
        const index = await loadAddressSnapshot(csv, { expectedSha256 });
        const server = createAddressSnapshotServer(index);
        server.requestTimeout = 10000;
        server.headersTimeout = 10000;
        server.on('error', () => { console.error('Address snapshot service could not listen on the requested loopback port.'); process.exitCode = 1; });
        server.listen(port, '127.0.0.1', () => console.log(`Address snapshot service: http://127.0.0.1:${port}; ${index.snapshot.recordCount} records; SHA-256 ${index.snapshot.sha256}`));
    } catch {
        console.error('Address snapshot service could not start. Check --csv ABSOLUTE_PATH, CSV format and --port PORT.');
        process.exitCode = 1;
    }
}
