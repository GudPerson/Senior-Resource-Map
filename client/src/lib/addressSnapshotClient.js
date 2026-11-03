import { requestWithBaseCandidates } from './api.js';

const SHA256 = /^[a-f0-9]{64}$/;
const ERROR_MESSAGES = {
    ADDRESS_SNAPSHOT_UNAVAILABLE: 'Address suggestions are unavailable. Try again or enter an address manually.',
    ADDRESS_SNAPSHOT_INVALID_QUERY: 'The address search area is invalid. Adjust it and try again.',
    ADDRESS_SNAPSHOT_CHANGED: 'The address snapshot changed. Retry the search before loading or exporting more addresses.',
    ADDRESS_SNAPSHOT_AREA_TOO_LARGE: 'This area is too large to search. Choose a smaller area and try again.',
};

export class AddressSnapshotError extends Error {
    constructor(message, code = 'ADDRESS_SNAPSHOT_UNAVAILABLE', status) {
        super(message || ERROR_MESSAGES[code] || ERROR_MESSAGES.ADDRESS_SNAPSHOT_UNAVAILABLE);
        this.name = 'AddressSnapshotError';
        this.code = code;
        if (status) this.status = status;
    }
}

function validSnapshot(value) {
    return value?.snapshot && typeof value.snapshot.label === 'string' && SHA256.test(value.snapshot.sha256 || '') && value.ready !== false;
}

// The default uses the application's existing cookie/session API transport. The
// optional local provider has one fixed same-origin proxy and never sends cookies.
export function createAddressSnapshotClient({ provider = 'production', apiRequest = requestWithBaseCandidates,
    fetchImpl = (...args) => globalThis.fetch(...args), baseCandidates } = {}) {
    if (!['production', 'local'].includes(provider)) throw new Error('Unknown address snapshot provider.');
    async function requestSnapshot(path, body, signal) {
        try {
            if (provider === 'production') return await apiRequest(body ? 'POST' : 'GET', `/address-snapshot${path}`, body, {
                signal, cache: 'no-store', networkAttemptsPerBase: 1, ...(baseCandidates ? { baseCandidates } : {}),
            });
            const response = await fetchImpl(`/__carearound-addresses${path}`, {
                method: body ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', signal,
                ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
            });
            const value = await response.json();
            if (!response.ok) {
                const code = value?.code || ({ 400: 'ADDRESS_SNAPSHOT_INVALID_QUERY', 409: 'ADDRESS_SNAPSHOT_CHANGED', 422: 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE' })[response.status];
                throw new AddressSnapshotError(undefined, ERROR_MESSAGES[code] ? code : undefined, response.status);
            }
            return value;
        } catch (error) {
            if (error?.name === 'AbortError' || signal?.aborted) throw error;
            if (error instanceof AddressSnapshotError) throw error;
            const code = ERROR_MESSAGES[error?.code] ? error.code : 'ADDRESS_SNAPSHOT_UNAVAILABLE';
            throw new AddressSnapshotError(undefined, code, error?.status);
        }
    }
    async function getAddressSnapshotMetadata({ signal } = {}) {
        const result = await requestSnapshot('/metadata', undefined, signal);
        if (!validSnapshot(result)) throw new AddressSnapshotError();
        return result;
    }
    async function query(path, body, snapshotSha256, signal) {
        const pin = snapshotSha256 ?? (await getAddressSnapshotMetadata({ signal })).snapshot.sha256;
        if (!SHA256.test(pin || '')) throw new AddressSnapshotError(undefined, 'ADDRESS_SNAPSHOT_INVALID_QUERY', 400);
        const result = await requestSnapshot(path, { ...body, snapshotSha256: pin }, signal);
        if (!validSnapshot(result) || !Array.isArray(result.rows) || !Number.isSafeInteger(result.total)
            || !Number.isSafeInteger(result.offset) || !Number.isSafeInteger(result.limit)) throw new AddressSnapshotError();
        if (result.snapshot.sha256 !== pin) throw new AddressSnapshotError(undefined, 'ADDRESS_SNAPSHOT_CHANGED', 409);
        return result;
    }
    function findNearbySnapshotAddresses({ lat, lng, radiusMeters = 100, limit = 10, snapshotSha256, signal } = {}) {
        return query('/nearby', { lat, lng, radiusMeters, limit }, snapshotSha256, signal);
    }
    function findSnapshotAddressesWithinArea({ area, offset = 0, limit = 200, snapshotSha256, signal } = {}) {
        if (offset > 0 && !SHA256.test(snapshotSha256 || '')) return Promise.reject(new AddressSnapshotError(undefined, 'ADDRESS_SNAPSHOT_INVALID_QUERY', 400));
        return query('/area', { area, offset, limit }, snapshotSha256, signal);
    }
    return { getAddressSnapshotMetadata, findNearbySnapshotAddresses, findSnapshotAddressesWithinArea };
}

const client = createAddressSnapshotClient({
    provider: import.meta.env?.DEV && import.meta.env?.VITE_ADDRESS_SNAPSHOT_PROVIDER === 'local' ? 'local' : 'production',
});
export const { getAddressSnapshotMetadata, findNearbySnapshotAddresses, findSnapshotAddressesWithinArea } = client;
export { serializeAddressSnapshotCsv } from './mapSpatialGeometry.js';
