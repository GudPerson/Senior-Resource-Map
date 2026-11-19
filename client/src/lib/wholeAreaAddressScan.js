import {
    ADDRESS_SNAPSHOT_SCAN_CAPS as caps,
    isAddressSnapshotScanRecordCount,
    isAddressSnapshotScanResponse,
} from '../../../shared/addressSnapshotScanContract.js';
import { normalizeSpatialArea } from '../../../shared/addressSnapshotSpatial.js';
import { AddressSnapshotError } from './addressSnapshotClient.js';

const idle = Object.freeze({ status: 'idle', progress: null, completedRows: null, total: null, error: null, snapshot: null });
const utf8 = new TextEncoder();
const sameFields = (expected, actual) => Object.keys(expected).every(key => expected[key] === actual[key]);
const incomplete = () => new AddressSnapshotError('The whole-area address search is incomplete.');

function freezeGeometry(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freezeGeometry);
        Object.freeze(value);
    }
    return value;
}

async function hashArea(area) {
    // HTTPS and localhost provide Web Crypto. The chain still pins the server area hash through its cursor.
    if (!globalThis.crypto?.subtle) return undefined;
    const digest = await globalThis.crypto.subtle.digest('SHA-256', utf8.encode(JSON.stringify(area)));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function acceptBatch(session, value) {
    const { snapshotSha256, recordCount, areaSha256, cursor } = session;
    if (!isAddressSnapshotScanResponse(value, { snapshotSha256, areaSha256, cursor })
        || value.snapshot.recordCount !== recordCount
        || (session.identity && (!sameFields(session.identity.scan, value.scan)
            || !sameFields(session.identity.snapshot, value.snapshot)))) throw new AddressSnapshotError();

    const consumed = session.consumed + value.diagnostics.consumedCandidates;
    if (consumed > recordCount) throw incomplete();

    const added = new Map(), addedOrdinals = new Set();
    let bytes = session.bytes;
    for (const row of value.rows) {
        const existing = session.byId.get(row.id) ?? added.get(row.id);
        if (existing) {
            if (!sameFields(existing, row)) throw new AddressSnapshotError();
            continue;
        }
        if (session.ordinals.has(row.ordinal) || addedOrdinals.has(row.ordinal)) throw new AddressSnapshotError();
        bytes += utf8.encode(JSON.stringify(row)).byteLength + (session.byId.size + added.size > 0 ? 1 : 0);
        if (bytes > caps.maxRetainedBytes || session.byId.size + added.size >= recordCount) throw incomplete();
        added.set(row.id, Object.freeze({ ...row }));
        addedOrdinals.add(row.ordinal);
    }

    // Commit only after every row and the cursor have passed validation.
    for (const [id, row] of added) session.byId.set(id, row);
    for (const ordinal of addedOrdinals) session.ordinals.add(ordinal);
    session.bytes = bytes;
    session.consumed = consumed;
    session.batches++;
    session.cursor = value.nextCursor && Object.freeze({ ...value.nextCursor });
    session.identity ??= { scan: { ...value.scan }, snapshot: { ...value.snapshot } };
    session.progress = Object.freeze({ ...value.progress });
}

export function createWholeAreaAddressScan({ getMetadata, scanBatch }) {
    const listeners = new Set();
    let view = idle, session = null, active = null;

    function publish(next) {
        view = Object.freeze(next);
        for (const listener of listeners) listener();
    }

    async function run(query) {
        const transport = new AbortController();
        const { signal } = transport;
        active = transport;
        try {
            publish({ ...idle, status: 'scanning', progress: query.progress });
            if (active !== transport) return;
            if (!query.snapshotSha256) {
                const metadata = await getMetadata({ signal });
                if (active !== transport) return;
                const { sha256, recordCount } = metadata?.snapshot ?? {};
                if (metadata?.ready === false || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)
                    || !isAddressSnapshotScanRecordCount(recordCount)) throw new AddressSnapshotError();
                query.snapshotSha256 = sha256;
                query.recordCount = recordCount;
            }
            query.areaSha256 ??= await hashArea(query.area);
            while (active === transport) {
                if (query.batches >= Math.min(caps.maxBatches, query.recordCount)) throw incomplete();
                const { area, snapshotSha256, cursor } = query;
                const value = await scanBatch({ area, snapshotSha256, cursor, signal });
                if (active !== transport) return;
                acceptBatch(query, value);
                if (value.done) {
                    const completedRows = Object.freeze(Array.from(query.byId.values()).sort((a, b) => a.ordinal - b.ordinal));
                    session = null;
                    publish({
                        ...idle, status: 'ready', progress: query.progress, completedRows, total: completedRows.length,
                        snapshot: Object.freeze(query.identity.snapshot),
                    });
                    return;
                }
                publish({ ...idle, status: 'scanning', progress: query.progress });
            }
        } catch (error) {
            if (active !== transport) return;
            const changed = error?.status === 409 && error?.code === 'ADDRESS_SNAPSHOT_CHANGED';
            if (changed) session = null;
            publish({ ...idle, status: changed ? 'changed' : 'error', progress: session?.progress ?? null,
                error: error ?? new AddressSnapshotError() });
        } finally {
            if (active === transport) active = null;
        }
    }

    async function start(area) {
        if (active) return;
        session = null;
        try {
            const normalizedArea = normalizeSpatialArea(area);
            if (!normalizedArea) throw new AddressSnapshotError(undefined, 'ADDRESS_SNAPSHOT_INVALID_QUERY', 400);
            session = {
                area: freezeGeometry(structuredClone(normalizedArea)),
                cursor: null, progress: null, byId: new Map(), ordinals: new Set(), bytes: 2, batches: 0, consumed: 0,
            };
        } catch (error) {
            publish({ ...idle, status: 'error', error });
            return;
        }
        await run(session);
    }

    async function resume() {
        if (!active && session && view.status === 'error') await run(session);
    }

    function reset() {
        const transport = active;
        active = null;
        // An abort-ignoring request can still hold this session until it settles.
        session?.byId.clear();
        session?.ordinals.clear();
        session = null;
        transport?.abort();
        if (view !== idle) publish(idle);
    }

    return {
        start, resume, reset,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getSnapshot: () => view,
    };
}
