import { createAddressSnapshotRepository } from '../utils/addressSnapshotRepository.js';
import { ADDRESS_SNAPSHOT_CONFIG } from '../utils/addressSnapshotConfig.js';
import { isSpatialCoordinate, normalizeSpatialArea } from '../../../shared/addressSnapshotSpatial.js';

export const ADDRESS_SNAPSHOT_MAX_BODY_BYTES = 1024 * 1024;

const RESPONSES = Object.freeze({
    ADDRESS_SNAPSHOT_INVALID_QUERY: { status: 400, error: 'The address search is invalid. Check the selected point or area and try again.' },
    ADDRESS_SNAPSHOT_BODY_TOO_LARGE: { status: 413, error: 'The address search is too large. Choose a simpler area and try again.' },
    ADDRESS_SNAPSHOT_CHANGED: { status: 409, error: 'The address snapshot changed. Start a new search and try again.' },
    ADDRESS_SNAPSHOT_AREA_TOO_LARGE: { status: 422, error: 'This area is too large to search. Choose a smaller or simpler area and try again.' },
    ADDRESS_SNAPSHOT_UNAVAILABLE: { status: 503, error: 'Address search is temporarily unavailable. Try again later.' },
});

class AddressSnapshotRequestError extends Error {
    constructor(code = 'ADDRESS_SNAPSHOT_INVALID_QUERY') { super(code); this.code = code; }
}

const invalid = () => new AddressSnapshotRequestError();
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOnlyKeys = (value, keys) => isRecord(value) && Object.keys(value).every(key => keys.includes(key));
const isPageNumber = (value, minimum) => Number.isSafeInteger(value) && value >= minimum;

async function readBoundedJson(request) {
    const contentType = request.headers.get('content-type') || '';
    const encoding = (request.headers.get('content-encoding') || '').trim().toLowerCase();
    if (!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(contentType)
        || (encoding && encoding !== 'identity') || !request.body) throw invalid();
    const length = request.headers.get('content-length');
    if (length !== null) {
        if (!/^\d+$/.test(length.trim())) throw invalid();
        if (Number(length) > ADDRESS_SNAPSHOT_MAX_BODY_BYTES) throw new AddressSnapshotRequestError('ADDRESS_SNAPSHOT_BODY_TOO_LARGE');
    }
    const reader = request.body.getReader();
    // One fixed buffer also bounds overhead from a stream split into tiny chunks.
    const bytes = new Uint8Array(ADDRESS_SNAPSHOT_MAX_BODY_BYTES);
    let used = 0;
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!(value instanceof Uint8Array)) throw invalid();
            if (used + value.byteLength > ADDRESS_SNAPSHOT_MAX_BODY_BYTES) {
                await reader.cancel().catch(() => {});
                throw new AddressSnapshotRequestError('ADDRESS_SNAPSHOT_BODY_TOO_LARGE');
            }
            bytes.set(value, used); used += value.byteLength;
        }
    } catch (error) {
        if (error instanceof AddressSnapshotRequestError) throw error;
        throw invalid();
    } finally { reader.releaseLock(); }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, used))); }
    catch { throw invalid(); }
}

function validateQuery(body, kind) {
    const keys = kind === 'nearby'
        ? ['lat', 'lng', 'radiusMeters', 'limit', 'snapshotSha256']
        : ['area', 'offset', 'limit', 'snapshotSha256'];
    if (!hasOnlyKeys(body, keys) || typeof body.snapshotSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(body.snapshotSha256)) throw invalid();
    if (body.limit !== undefined && (!isPageNumber(body.limit, 1) || body.limit > ADDRESS_SNAPSHOT_CONFIG.limits.maxPageSize)) throw invalid();
    if (kind === 'nearby') {
        if (!isSpatialCoordinate([body.lat, body.lng])) throw invalid();
        if (body.radiusMeters !== undefined && (typeof body.radiusMeters !== 'number' || !Number.isFinite(body.radiusMeters)
            || body.radiusMeters <= 0 || body.radiusMeters > ADDRESS_SNAPSHOT_CONFIG.limits.maxNearbyRadiusMeters)) throw invalid();
    } else {
        if (body.offset !== undefined && !isPageNumber(body.offset, 0)) throw invalid();
        const areaKeys = body.area?.type === 'circle' ? ['type', 'center', 'radiusMeters'] : ['type', 'coordinates'];
        if (!hasOnlyKeys(body.area, areaKeys) || !normalizeSpatialArea(body.area)) throw invalid();
    }
    return body;
}

function errorResponse(c, error) {
    const code = Object.hasOwn(RESPONSES, error?.code) ? error.code : 'ADDRESS_SNAPSHOT_UNAVAILABLE';
    const response = RESPONSES[code];
    return c.json({ error: response.error, code, ...(response.status === 503 ? { ready: false } : {}) }, response.status);
}

export function createAddressSnapshotHandlers({
    repositoryForContext = c => createAddressSnapshotRepository(c.env?.HELP_CMS_BUCKET),
} = {}) {
    const query = kind => async c => {
        try {
            const body = validateQuery(await readBoundedJson(c.req.raw), kind);
            return c.json(await repositoryForContext(c)[kind](body));
        } catch (error) { return errorResponse(c, error); }
    };
    return {
        metadata: async c => {
            try { return c.json(await repositoryForContext(c).metadata()); }
            catch (error) { return errorResponse(c, error); }
        },
        nearby: query('nearby'),
        area: query('area'),
    };
}
